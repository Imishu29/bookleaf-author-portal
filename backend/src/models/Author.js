const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true, unique: true }, // e.g. AUTH001 (from dataset)
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: String,
    city: String,
    joinedDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Author', authorSchema);
