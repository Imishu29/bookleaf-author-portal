const mongoose = require('mongoose');
const { CATEGORIES, PRIORITIES, PRIORITY_RANK, STATUSES, ACTIVE_STATUSES } = require('../constants');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ['author', 'admin'], required: true },
    senderName: { type: String, required: true },
    body: { type: String, required: true },
    // true when the admin sent the AI draft without editing it (useful metric)
    fromAiDraft: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const noteSchema = new mongoose.Schema(
  {
    authorName: { type: String, required: true },
    body: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, index: true }, // BL-00001
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: true, index: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: null }, // null = General / Account Level
    subject: { type: String, required: true },
    description: { type: String, required: true },
    attachments: { type: [{ name: String, size: Number }], default: [] }, // metadata only (UI-level support)

    status: { type: String, enum: STATUSES, default: 'Open', index: true },
    category: { type: String, enum: CATEGORIES, default: 'General Inquiry', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },

    // Provenance of the labels, so the UI can show "AI" vs "Admin" and we can measure override rate.
    categorySource: { type: String, enum: ['pending', 'ai', 'rules', 'admin'], default: 'pending' },
    prioritySource: { type: String, enum: ['pending', 'ai', 'rules', 'admin'], default: 'pending' },
    aiReason: String,

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    messages: [messageSchema],
    internalNotes: [noteSchema],

    // Cached AI draft so reopening a ticket does not cost another LLM call.
    aiDraft: {
      text: String,
      generatedAt: Date,
      source: { type: String, enum: ['ai', 'template'] },
    },

    // Denormalised sort keys: lets Mongo sort "active first, most urgent first, oldest first".
    priorityRank: { type: Number, index: true },
    isActive: { type: Boolean, index: true },
    resolvedAt: Date,
  },
  { timestamps: true }
);

ticketSchema.pre('validate', function setDerived() {
  this.priorityRank = PRIORITY_RANK[this.priority];
  this.isActive = ACTIVE_STATUSES.includes(this.status);
  if (this.isModified('status') && !this.isActive) this.resolvedAt = this.resolvedAt || new Date();
  if (this.isModified('status') && this.isActive) this.resolvedAt = undefined;
});

module.exports = mongoose.model('Ticket', ticketSchema);
