# Approach write-up

**Prioritised.** The brief weights AI integration and architecture at 50%, so I built the ticket lifecycle end-to-end first (author → ticket → AI triage → admin reply → author sees it live), then hardened the AI path. UI is deliberately plain: clear status/priority badges, an urgency-sorted queue with stale-ticket highlighting, and an AI draft that is always editable.

**Key trade-offs.**
- *Async triage over blocking.* Ticket creation never waits on the LLM; classification lands via SSE a moment later. Cost: a brief "Auto/AI…" window where the default label is shown.
- *Lazy, cached drafts.* Drafts are generated only when an admin opens a ticket (most tickets are opened once), cached, and invalidated when the category changes. Cost: first open has ~1–2 s latency.
- *Small model + tight context.* Haiku-class model, one KB section per category, only the relevant book's data, last 4 messages. Accuracy comes from grounding, not model size.
- *Rules fallback instead of failure.* Keyword classification and a policy template keep ops moving during an AI outage and are labelled as such, so no one mistakes them for AI output.
- *SSE over WebSockets, polling-free.* One-directional, auto-reconnect, trivial to deploy. In-memory hub limits it to one instance.
- *Simplicity in auth.* JWT in localStorage and seeded users, as the brief allows.

**To production.** Redis pub/sub for SSE and a queue (BullMQ) for triage with retries/dead-lettering; an offline eval set of real tickets to measure classification accuracy and track override rate (already stored via `*Source` fields); per-call token/cost metrics and budget alarms; PII redaction before prompts; real royalty-statement data fed into drafts; attachments in object storage with virus scanning; httpOnly-cookie sessions, audit log of admin actions, SLA timers with auto-escalation of Critical tickets; unit/integration tests and CI.
