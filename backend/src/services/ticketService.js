const Ticket = require('../models/Ticket');
const Book = require('../models/Book');
const Author = require('../models/Author');
const { nextSeq } = require('../models/Counter');
const { PRIORITY_RANK } = require('../constants');
const { classifyTicket } = require('./ai/classifier');
const { draftResponse } = require('./ai/drafter');
const { publishTicketEvent } = require('./realtime');
const { notFound } = require('../utils/errors');

const POPULATE = [
  { path: 'author', select: 'authorId name email' },
  { path: 'book', select: 'bookId title status' },
  { path: 'assignedTo', select: 'name email' },
];

/** Shape a ticket for the caller. Authors never see internal notes, AI drafts or triage provenance. */
function serialize(ticket, role) {
  const t = ticket.toObject ? ticket.toObject() : ticket;
  if (role === 'admin') return t;
  const { internalNotes, aiDraft, aiReason, categorySource, prioritySource, assignedTo, priorityRank, isActive, ...visible } = t;
  return { ...visible, assignedTo: assignedTo ? { name: assignedTo.name } : null };
}

async function createTicket({ authorDoc, bookId, subject, description, attachments }) {
  let book = null;
  if (bookId) {
    book = await Book.findOne({ bookId, author: authorDoc._id });
    if (!book) throw notFound('Book not found on your account');
  }

  const seq = await nextSeq('ticket');
  const ticket = await Ticket.create({
    ticketNumber: `BL-${String(seq).padStart(5, '0')}`,
    author: authorDoc._id,
    book: book?._id ?? null,
    subject,
    description,
    attachments,
    messages: [],
  });

  // Triage runs in the background: the author gets an instant response and the
  // ticket exists even if the AI provider is down.
  triage(ticket._id, book?.title).catch((e) => console.error('[triage]', e));
  publishTicketEvent('ticket.created', ticket);
  return ticket;
}

/** Classify + prioritise. Skips fields an admin already overrode while we were waiting. */
async function triage(ticketId, bookTitle) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return;
  const result = await classifyTicket({ subject: ticket.subject, description: ticket.description, bookTitle });

  const fresh = await Ticket.findById(ticketId);
  if (fresh.categorySource === 'pending') { fresh.category = result.category; fresh.categorySource = result.source; }
  if (fresh.prioritySource === 'pending') { fresh.priority = result.priority; fresh.prioritySource = result.source; }
  fresh.aiReason = result.reason;
  await fresh.save();
  publishTicketEvent('ticket.updated', fresh);
}

/** Get (or generate and cache) the AI draft for a ticket. */
async function getDraft(ticketId, { regenerate = false } = {}) {
  const ticket = await Ticket.findById(ticketId).populate('book');
  if (!ticket) throw notFound('Ticket not found');
  if (ticket.aiDraft?.text && !regenerate) return ticket.aiDraft;

  const author = await Author.findById(ticket.author);
  const allBooks = await Book.find({ author: author._id }).sort({ bookId: 1 });
  const context = {
    authorName: author.name,
    authorCity: author.city,
    joinedDate: author.joinedDate,
    book: ticket.book,
    allBooks,
  };
  const draft = await draftResponse({ ticket, context });
  ticket.aiDraft = { ...draft, generatedAt: new Date() };
  await ticket.save();
  return ticket.aiDraft;
}

/** Admin changes to triage fields are recorded as overrides. */
function applyAdminUpdate(ticket, patch, adminUser) {
  if (patch.status) ticket.status = patch.status;
  if (patch.category && patch.category !== ticket.category) {
    ticket.category = patch.category;
    ticket.categorySource = 'admin';
    ticket.aiDraft = undefined; // draft was written for the old category
  }
  if (patch.priority && patch.priority !== ticket.priority) {
    ticket.priority = patch.priority;
    ticket.prioritySource = 'admin';
  }
  if (patch.assignedTo !== undefined) ticket.assignedTo = patch.assignedTo === 'me' ? adminUser._id : null;
}

const sortFor = (sort) =>
  sort === 'newest' ? { createdAt: -1 }
  : sort === 'oldest' ? { createdAt: 1 }
  // Default "urgency": active tickets first, then highest priority, then oldest first.
  : { isActive: -1, priorityRank: -1, createdAt: 1 };

module.exports = { POPULATE, serialize, createTicket, triage, getDraft, applyAdminUpdate, sortFor, PRIORITY_RANK };
