/**
 * Seeds the database from data/bookleaf_sample_data.json (idempotent: wipes and reloads).
 *   npm run seed
 * Logins created:  every author -> their email / Author@123 ;  admin@bookleaf.com / Admin@123
 */
const mongoose = require('mongoose');
const config = require('../src/config');
const data = require('../data/bookleaf_sample_data.json');
const Author = require('../src/models/Author');
const Book = require('../src/models/Book');
const User = require('../src/models/User');
const Ticket = require('../src/models/Ticket');
const { nextSeq } = require('../src/models/Counter');

const AUTHOR_PASSWORD = 'Author@123';
const ADMIN = { email: 'admin@bookleaf.com', password: 'Admin@123', name: 'Riya (Ops)' };
const ADMIN2 = { email: 'ops2@bookleaf.com', password: 'Admin@123', name: 'Karan (Ops)' };

const day = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);

async function main() {
  await mongoose.connect(config.mongoUri);
  await Promise.all([Author, Book, User, Ticket, mongoose.connection.collection('counters')].map((m) => (m.deleteMany ? m.deleteMany({}) : m.drop().catch(() => {}))));

  const authorHash = await User.hashPassword(AUTHOR_PASSWORD);
  const byAuthorId = {};
  const byBookId = {};

  for (const a of data.authors) {
    const author = await Author.create({
      authorId: a.author_id, name: a.name, email: a.email, phone: a.phone, city: a.city, joinedDate: a.joined_date,
    });
    byAuthorId[a.author_id] = author;
    await User.create({ email: a.email, passwordHash: authorHash, role: 'author', name: a.name, author: author._id });

    for (const b of a.books) {
      byBookId[b.book_id] = await Book.create({
        bookId: b.book_id, author: author._id, title: b.title, isbn: b.isbn, genre: b.genre,
        publicationDate: b.publication_date, status: b.status, mrp: b.mrp,
        authorRoyaltyPerCopy: b.author_royalty_per_copy, totalCopiesSold: b.total_copies_sold,
        totalRoyaltyEarned: b.total_royalty_earned, royaltyPaid: b.royalty_paid, royaltyPending: b.royalty_pending,
        lastRoyaltyPayoutDate: b.last_royalty_payout_date, printPartner: b.print_partner, availableOn: b.available_on,
      });
    }
  }

  const admin = await User.create({ email: ADMIN.email, passwordHash: await User.hashPassword(ADMIN.password), role: 'admin', name: ADMIN.name });
  await User.create({ email: ADMIN2.email, passwordHash: await User.hashPassword(ADMIN2.password), role: 'admin', name: ADMIN2.name });

  // A few realistic tickets so both portals have something to show on first login.
  const samples = [
    { a: 'AUTH003', b: 'BK005', subject: 'No royalty received for my book', description: 'My book Between Two Temples has been live for over 3 months and I have not received any royalty payment yet. 67 copies have sold according to my dashboard. Please tell me what is going on.', category: 'Royalty & Payments', priority: 'High', created: 6 },
    { a: 'AUTH006', b: 'BK010', subject: 'Haven\'t been paid anything in 6 months', description: 'I published Turban Tales and it has been about 6 months. Zero royalty received so far despite 88 copies sold. This is really frustrating, I need an answer urgently.', category: 'Royalty & Payments', priority: 'Critical', created: 9 },
    { a: 'AUTH007', b: 'BK013', subject: 'Cover design stuck for weeks', description: 'Midnight in Mysore has been in cover design for several weeks now. Can you tell me when the cover will be ready and what you need from me?', category: 'Book Status & Production Updates', priority: 'Medium', created: 3 },
    { a: 'AUTH002', b: 'BK004', subject: 'Amazon shows wrong ISBN', description: 'The ISBN shown on the Amazon page for Startup Sutra is different from the one printed on my physical copy. Readers are getting confused.', category: 'ISBN & Metadata Issues', priority: 'High', created: 2 },
    { a: 'AUTH004', b: null, subject: 'Can I update my author bio?', description: 'I would like to update the short author bio shown on my book pages. How do I go about doing that?', category: 'General Inquiry', priority: 'Low', created: 1 },
  ];

  for (const s of samples) {
    const seq = await nextSeq('ticket');
    await Ticket.create({
      ticketNumber: `BL-${String(seq).padStart(5, '0')}`,
      author: byAuthorId[s.a]._id, book: s.b ? byBookId[s.b]._id : null,
      subject: s.subject, description: s.description,
      category: s.category, priority: s.priority, categorySource: 'rules', prioritySource: 'rules',
      aiReason: 'Seeded sample', createdAt: day(s.created),
    });
  }

  console.log(`Seeded ${data.authors.length} authors, ${Object.keys(byBookId).length} books, ${samples.length} sample tickets.`);
  console.log(`Author login: <author email> / ${AUTHOR_PASSWORD}   |   Admin login: ${ADMIN.email} / ${ADMIN.password}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
