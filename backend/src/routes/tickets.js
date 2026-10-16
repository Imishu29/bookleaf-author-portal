const router = require('express').Router();
const { z } = require('zod');
const Ticket = require('../models/Ticket');
const Author = require('../models/Author');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CATEGORIES, PRIORITIES, STATUSES, ACTIVE_STATUSES } = require('../constants');
const svc = require('../services/ticketService');
const { publishTicketEvent } = require('../services/realtime');
const { notFound, forbidden, badRequest } = require('../utils/errors');

router.use(authenticate);

// ---------- schemas ----------
const createSchema = z.object({
  bookId: z.string().trim().min(1).nullish(), // null / omitted = General / Account Level
  subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(150),
  description: z.string().trim().min(20, 'Please describe the issue in at least 20 characters').max(5000),
  attachments: z.array(z.object({ name: z.string().max(200), size: z.number().int().nonnegative().max(10_000_000) })).max(5).default([]),
});

const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigned: z.enum(['me', 'unassigned']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['urgency', 'newest', 'oldest']).default('urgency'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const messageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(5000),
  fromAiDraft: z.boolean().optional(), // admin only: sent the AI draft unedited
  status: z.enum(STATUSES).optional(), // admin only: set status in the same action
});

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedTo: z.enum(['me']).nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const noteSchema = z.object({ body: z.string().trim().min(1).max(3000) });

// ---------- helpers ----------
/** Load a ticket the caller may see. Authors get 404 for tickets that aren't theirs. */
async function loadTicket(req) {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket || (req.user.role === 'author' && String(ticket.author) !== String(req.user.author))) {
    throw notFound('Ticket not found');
  }
  return ticket;
}
const repopulate = (ticket) => ticket.populate(svc.POPULATE);

// ---------- routes ----------
router.get('/', validate(listQuerySchema, 'query'), async (req, res) => {
  const f = req.valid.query;
  const filter = {};
  if (req.user.role === 'author') filter.author = req.user.author;
  if (f.status) filter.status = f.status;
  if (f.category) filter.category = f.category;
  if (f.priority) filter.priority = f.priority;
  if (f.assigned === 'me') filter.assignedTo = req.user._id;
  if (f.assigned === 'unassigned') filter.assignedTo = null;
  if (f.from || f.to) filter.createdAt = { ...(f.from && { $gte: f.from }), ...(f.to && { $lte: f.to }) };
  if (f.q) {
    const rx = new RegExp(f.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ subject: rx }, { description: rx }, { ticketNumber: rx }];
  }

  const [items, total] = await Promise.all([
    Ticket.find(filter).populate(svc.POPULATE).sort(svc.sortFor(f.sort)).skip((f.page - 1) * f.limit).limit(f.limit),
    Ticket.countDocuments(filter),
  ]);
  res.json({ tickets: items.map((t) => svc.serialize(t, req.user.role)), total, page: f.page, limit: f.limit });
});

// Registered before /:id so "stats" isn't treated as an id.
router.get('/stats/summary', requireRole('admin'), async (_req, res) => {
  const [byStatus, critical, unassigned] = await Promise.all([
    Ticket.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Ticket.countDocuments({ priority: 'Critical', status: { $in: ACTIVE_STATUSES } }),
    Ticket.countDocuments({ assignedTo: null, status: { $in: ACTIVE_STATUSES } }),
  ]);
  const status = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  byStatus.forEach((r) => { status[r._id] = r.n; });
  res.json({ status, criticalActive: critical, unassignedActive: unassigned });
});

router.post('/', requireRole('author'), validate(createSchema), async (req, res) => {
  const author = await Author.findById(req.user.author);
  const { bookId, subject, description, attachments } = req.valid.body;
  const ticket = await svc.createTicket({ authorDoc: author, bookId, subject, description, attachments });
  await repopulate(ticket);
  res.status(201).json({ ticket: svc.serialize(ticket, 'author') });
});

router.get('/:id', async (req, res) => {
  const ticket = await loadTicket(req);
  await repopulate(ticket);
  res.json({ ticket: svc.serialize(ticket, req.user.role) });
});

// Reply on the thread. Authors reply to their own tickets; admins send the response.
router.post('/:id/messages', validate(messageSchema), async (req, res) => {
  const ticket = await loadTicket(req);
  const { body, fromAiDraft, status } = req.valid.body;
  const isAdmin = req.user.role === 'admin';

  if (ticket.status === 'Closed') throw badRequest('This ticket is closed. Please open a new ticket.');

  ticket.messages.push({
    sender: req.user.role,
    senderName: isAdmin ? `${req.user.name} (BookLeaf Support)` : req.user.name,
    body,
    fromAiDraft: isAdmin ? Boolean(fromAiDraft) : false,
  });

  if (isAdmin) {
    ticket.status = status || (ticket.status === 'Open' ? 'In Progress' : ticket.status);
    if (!ticket.assignedTo) ticket.assignedTo = req.user._id; // replying implies ownership
    ticket.aiDraft = undefined; // consumed; next reply gets a fresh draft
  } else if (ticket.status === 'Resolved') {
    ticket.status = 'Open'; // author follow-up reopens
  }

  await ticket.save();
  await repopulate(ticket);
  publishTicketEvent('ticket.updated', ticket);
  res.status(201).json({ ticket: svc.serialize(ticket, req.user.role) });
});

// ---- admin only below ----
router.patch('/:id', requireRole('admin'), validate(patchSchema), async (req, res) => {
  const ticket = await loadTicket(req);
  svc.applyAdminUpdate(ticket, req.valid.body, req.user);
  await ticket.save();
  await repopulate(ticket);
  publishTicketEvent('ticket.updated', ticket);
  res.json({ ticket: svc.serialize(ticket, 'admin') });
});

router.post('/:id/notes', requireRole('admin'), validate(noteSchema), async (req, res) => {
  const ticket = await loadTicket(req);
  ticket.internalNotes.push({ authorName: req.user.name, body: req.valid.body.body });
  await ticket.save();
  await repopulate(ticket);
  // Deliberately no SSE to the author: notes are internal.
  res.status(201).json({ ticket: svc.serialize(ticket, 'admin') });
});

// Returns the cached draft, or generates one. ?regenerate=true forces a fresh LLM call.
router.post('/:id/ai-draft', requireRole('admin'), async (req, res) => {
  const ticket = await loadTicket(req);
  const draft = await svc.getDraft(ticket._id, { regenerate: req.query.regenerate === 'true' });
  res.json({ draft });
});

// Re-run AI triage (e.g. after the author adds detail). Resets provenance so AI may overwrite.
router.post('/:id/reclassify', requireRole('admin'), async (req, res) => {
  const ticket = await loadTicket(req);
  ticket.categorySource = 'pending';
  ticket.prioritySource = 'pending';
  await ticket.save();
  await ticket.populate('book');
  await svc.triage(ticket._id, ticket.book?.title);
  const fresh = await Ticket.findById(ticket._id).populate(svc.POPULATE);
  res.json({ ticket: svc.serialize(fresh, 'admin') });
});

module.exports = router;
