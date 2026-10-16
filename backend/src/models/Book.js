const mongoose = require('mongoose');

/**
 * Books live in their own collection (rather than embedded in Author) so that
 * tickets can reference them and admins can query across authors.
 * Fields that don't exist for in-production books are null, not 0.
 */
const bookSchema = new mongoose.Schema(
  {
    bookId: { type: String, required: true, unique: true }, // e.g. BK001
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: true, index: true },
    title: { type: String, required: true },
    isbn: String,
    genre: String,
    publicationDate: { type: Date, default: null },
    status: { type: String, required: true }, // "Published & Live" | "In Production - Cover Design" ...
    mrp: { type: Number, default: null },
    authorRoyaltyPerCopy: { type: Number, default: null },
    totalCopiesSold: { type: Number, default: 0 },
    totalRoyaltyEarned: { type: Number, default: 0 },
    royaltyPaid: { type: Number, default: 0 },
    royaltyPending: { type: Number, default: 0 },
    lastRoyaltyPayoutDate: { type: Date, default: null },
    printPartner: { type: String, default: null },
    availableOn: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
