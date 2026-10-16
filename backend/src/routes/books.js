const router = require('express').Router();
const Book = require('../models/Book');
const { authenticate } = require('../middleware/auth');
const { notFound } = require('../utils/errors');

router.use(authenticate);

const populate = { path: 'author', select: 'authorId name email' };

// Authors: their own books only. Admins: every book, optionally ?authorId=AUTH001.
router.get('/', async (req, res) => {
  const filter = {};
  if (req.user.role === 'author') filter.author = req.user.author;
  else if (req.query.authorId) {
    const Author = require('../models/Author');
    const a = await Author.findOne({ authorId: String(req.query.authorId) });
    filter.author = a?._id ?? null;
  }
  const books = await Book.find(filter).populate(populate).sort({ bookId: 1 });
  res.json({ books });
});

router.get('/:bookId', async (req, res) => {
  const book = await Book.findOne({ bookId: req.params.bookId }).populate(populate);
  // 404 (not 403) for other authors' books so IDs can't be probed.
  if (!book || (req.user.role === 'author' && String(book.author._id) !== String(req.user.author))) {
    throw notFound('Book not found');
  }
  res.json({ book });
});

module.exports = router;
