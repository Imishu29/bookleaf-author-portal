# BookLeaf Author Support & Communication Portal

Angular 20 + Node.js/Express + MongoDB. Authors raise support tickets; the ops team triages them with AI-assisted classification, priority scoring and drafted replies grounded in the BookLeaf knowledge base. Updates reach both sides in real time (SSE).

## Quick start (local)

Prerequisites: Node 20+, MongoDB running on `localhost:27017`.

```bash
# 1. API
cd backend
cp .env.example .env          # set JWT_SECRET; optionally ANTHROPIC_API_KEY
npm install
npm run seed                  # loads the 10 authors / 18 books + 5 sample tickets
npm run dev                   # http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
npm install
npx ng serve --port 4200      # http://localhost:4200  (proxies /api -> :4000)
```

`node backend/scripts/smoke.js` runs an end-to-end API check (auth, RBAC, validation, ticket lifecycle).

### Test credentials (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bookleaf.com` | `Admin@123` |
| Admin | `ops2@bookleaf.com` | `Admin@123` |
| Author | any author's email from the dataset, e.g. `priya.sharma@email.com` | `Author@123` |

Good edge-case authors: **Ananya Reddy** (zero payouts), **Sneha Kulkarni** (a book in production: no MRP / royalties), **Kavita Deshmukh** (one live + one in typesetting), **Rohit Kapoor** (large pending royalties).

## Architecture

```
frontend (Angular, standalone + signals, lazy routes per portal)
   │  REST /api  +  SSE /api/events
backend (Express 5)
   routes/        thin HTTP layer: auth, books, tickets, events
   middleware/    authenticate (JWT), requireRole, validate (zod), errorHandler
   services/
     ticketService   orchestration: create -> triage (async) -> draft -> admin updates
     realtime        SSE hub
     ai/             llmClient, classifier, drafter, knowledgeBase, rules (fallback)
   models/        Mongoose: User, Author, Book, Ticket, Counter
MongoDB
```

Key decisions
- **Separate `Book` collection** (not embedded in Author): tickets reference books, and ops can query across authors. Books in production keep `null` for MRP/royalty rate rather than a misleading `0`.
- **Tickets embed messages and internal notes**: they are always read with the ticket and have no independent lifecycle. Authors' responses strip `internalNotes`, `aiDraft` and triage provenance server-side (not just hidden in the UI).
- **Denormalised sort keys** (`priorityRank`, `isActive`) let Mongo return the queue as *active first → highest priority → oldest first* with a plain index sort.
- **Triage is asynchronous**: `POST /tickets` returns immediately; classification runs in the background and pushes an SSE update. The ticket exists even if the AI is down.
- **RBAC in one place**: `authenticate` + `requireRole` on routers; author scoping is done in the query (`author = req.user.author`) and returns **404** (not 403) for others' resources so IDs can't be probed.
- **Real-time via SSE**: traffic is server→client only, auto-reconnects, no extra infra. Events carry only ticket IDs; clients refetch over REST so authorization lives in one place. (`EventSource` can't send headers, so `/api/events` alone accepts the JWT as a query param.)

## AI integration

**Providers:** Anthropic (`ANTHROPIC_API_KEY`) or Google Gemini (`GEMINI_API_KEY`, free tier at aistudio.google.com/apikey), chosen by whichever key is set (or `AI_PROVIDER`). Adapters live in `llmClient.js`; the rest of the AI code is provider-agnostic.

**Model choice:** a small, fast model: Claude Haiku (`claude-haiku-5-5`) or Gemini Flash (`gemini-2.5-flash`), overridable with `AI_MODEL`. Both tasks are short, structured, latency-sensitive and high-volume (1,200+ books/month), so a small, cheap model is the right fit; the knowledge base supplies the domain accuracy, not model size. The model is a single env var, so swapping up or to another provider only touches `llmClient.js`.

**Two separate calls, different cost profiles**
1. *Classification + priority* (`classifier.js`): one call returns `{category, priority, reason}` as strict JSON. The prompt contains category/priority *definitions only* (no knowledge base, no author PII, message truncated to 1,500 chars), `max_tokens` 120, `temperature` 0. Output is validated against the allowed enums; anything else is rejected → fallback.
2. *Draft reply* (`drafter.js`): generated **on demand when an admin opens the ticket**, then cached on the ticket (so reopening is free; "Regenerate" is explicit).

**Prompt strategy:** role + hard rules (use only supplied facts, never invent dates/numbers, 120–200 words, no AI filler) → company core + tone guidelines → the **one** knowledge-base section for the ticket's category (incl. the sample-response guidance from the brief) → live `AUTHOR DATA` (the ticket's book: status, sales, royalty earned/paid/pending, last payout, platforms, plus the computed next payout date from the quarterly + 45-day rule) → the ticket. Replies therefore quote real numbers and follow the "own the mistake, give a timeline, end with a next step" tone.

**Cost awareness**
- Per-category KB section instead of the whole KB; only the relevant book instead of the whole account; only the last 4 thread messages instead of full history.
- Static prompt prefix first and marked `cache_control` so the provider's prompt cache can bill it at the cached rate.
- Classification is tiny; drafts are lazy + cached; changing the category invalidates the cached draft.

**Graceful degradation** (`llmClient.js`, `rules.js`): 15 s timeout, one retry on 429/5xx honouring `Retry-After`; if the key is missing or the call still fails:
- classification falls back to keyword rules (labelled **Auto** in the UI vs **AI** vs **Admin**),
- the draft falls back to a policy-correct template (banner: *"AI unavailable – review and personalise"*),
- the admin can always write the reply manually. Tickets are never blocked by AI.

**Key security:** The AI key (`GEMINI_API_KEY` / `ANTHROPIC_API_KEY`) is read from the server environment only. It is never sent to the browser, never logged, and `.env` is git-ignored. The app runs without a key (fallback mode) – `/api/health` reports `ai: configured | fallback-mode`.

**Overrides:** admins can change category and priority; the change is stored with `categorySource/prioritySource = admin` (so override rate is measurable) and survives later AI re-runs unless "Re-run AI triage" is pressed.

## API reference

All routes are under `/api`, JSON in/out, `Authorization: Bearer <jwt>` unless noted. Errors share one shape: `{ "error": { "code", "message", "details?" } }` with 400 validation, 401 unauthenticated, 403 wrong role, 404 not found / not yours, 429 rate-limited.

| Method & path | Role | Description |
|---|---|---|
| `GET /health` | public | Liveness + AI mode |
| `POST /auth/login` | public | `{email, password}` → `{token, user}`. Rate limited |
| `GET /auth/me` | any | Current user |
| `GET /books` | any | Author: own books. Admin: all, optional `?authorId=AUTH001` |
| `GET /books/:bookId` | any | One book (404 if it belongs to another author) |
| `GET /tickets` | any | Author: own. Admin: all. Filters: `status, category, priority, assigned=me\|unassigned, from, to, q, sort=urgency\|oldest\|newest, page, limit` |
| `POST /tickets` | author | `{bookId\|null, subject(5-150), description(20-5000), attachments[{name,size}]}` → 201; triage runs async |
| `GET /tickets/:id` | any | Ticket thread (internal notes/AI data only for admins) |
| `POST /tickets/:id/messages` | any | Reply. Admin: `{body, fromAiDraft?, status?}` (Open→In Progress, auto-assign). Author reply reopens a Resolved ticket; Closed tickets reject |
| `PATCH /tickets/:id` | admin | `{status?, category?, priority?, assignedTo?: "me"\|null}` |
| `POST /tickets/:id/notes` | admin | Internal note `{body}` |
| `POST /tickets/:id/ai-draft` | admin | Cached draft or generate; `?regenerate=true` forces a new one → `{draft:{text,source:"ai"\|"template"}}` |
| `POST /tickets/:id/reclassify` | admin | Re-run AI triage |
| `GET /tickets/stats/summary` | admin | Counts by status, critical-active, unassigned-active |
| `GET /events?token=<jwt>` | any | SSE stream: `ticket.created`, `ticket.updated` (`{ticketId}`); authors only receive their own tickets |

## Edge cases handled
Books in production (no MRP/royalty → friendly empty state, no fake zeros), zero payouts / `null` payout dates, authors with no tickets, General/Account-level tickets, AI down / no key, expired token (auto logout), closed tickets, author follow-up on resolved tickets, race between AI triage and an admin override.

## Known limitations / next steps
- File attachments store only name + size (UI-level, per the brief); real uploads would go to S3-compatible storage with signed URLs.
- Passwords are seeded; there is no registration / reset flow. JWT is kept in `localStorage` (httpOnly cookie + CSRF protection would be the production choice).
- SSE hub is in-memory (single instance). Scaling out needs Redis pub/sub; AI triage should move to a job queue (BullMQ) with retries.
- No automated unit tests beyond the API smoke script; the classifier needs an offline eval set (labelled tickets) to track accuracy and catch prompt regressions.
- Possible next: author-visible royalty breakdown per platform, SLA timers/escalation, AI confidence + "similar past tickets" retrieval, token/cost metrics per call.

## Deployment
Build the UI with `npx ng build` and serve `frontend/dist/frontend/browser` behind the same origin as the API (or any reverse proxy forwarding `/api`), set `CLIENT_ORIGIN`, `JWT_SECRET`, `MONGODB_URI`, `ANTHROPIC_API_KEY` as environment variables.
