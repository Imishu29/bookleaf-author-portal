/**
 * Deterministic fallback used when the LLM is unavailable (no key, outage,
 * rate limit). Intentionally simple: it keeps the queue usable and sorted
 * until AI recovers; admins can still override everything.
 */
const CATEGORY_KEYWORDS = {
  'Royalty & Payments': ['royalty', 'royalties', 'payment', 'payout', 'paid', 'bank', 'earning', 'commission', 'threshold'],
  'ISBN & Metadata Issues': ['isbn', 'metadata', 'wrong book', 'duplicate', 'barcode', 'description', 'author name', 'imprint'],
  'Printing & Quality': ['print', 'blurry', 'misprint', 'binding', 'quality', 'pages', 'reprint', 'damaged', 'colour', 'color', 'misaligned'],
  'Distribution & Availability': ['amazon', 'flipkart', 'unavailable', 'listing', 'listed', 'not showing', 'out of stock', 'available', 'store'],
  'Book Status & Production Updates': ['status', 'typesetting', 'cover design', 'proofreading', 'editing', 'when will', 'how long', 'production', 'stage', 'proof'],
};

const CRITICAL = ['legal', 'lawyer', 'fraud', 'scam', 'cheat', 'consumer court', 'police', 'refund', 'wrong isbn', 'different isbn'];
const HIGH = ['isbn', 'not received', "haven't received", 'havent received', 'months', 'overdue', 'urgent', 'unavailable', 'terrible', 'defect', 'blurry', 'misprint', 'duplicate', 'too low'];
const LOW = ['bio', 'update my', 'can i change', 'curious', 'just wondering', 'suggestion'];

function classifyByRules({ subject, description }) {
  const text = `${subject} ${description}`.toLowerCase();

  let category = 'General Inquiry';
  let best = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
    if (score > best) { best = score; category = cat; }
  }

  let priority = 'Medium';
  if (CRITICAL.some((w) => text.includes(w))) priority = 'Critical';
  else if (HIGH.some((w) => text.includes(w))) priority = 'High';
  else if (LOW.some((w) => text.includes(w)) || category === 'General Inquiry') priority = 'Low';

  return { category, priority, reason: 'Rule-based fallback (AI unavailable)' };
}

/** Template draft: uses the same facts as the AI path so admins still start from something useful. */
function templateDraft({ ticket, context }) {
  const name = (context.authorName || 'there').split(' ')[0];
  const bookLine = context.book ? ` regarding "${context.book.title}"` : '';
  const steps = {
    'Royalty & Payments': 'Royalties are calculated quarterly and paid within 45 days of the quarter ending, via bank transfer to the account linked in your dashboard (minimum payout Rs.1,000, otherwise it rolls over). Our team will review your royalty statement and get back to you within 48 hours.',
    'ISBN & Metadata Issues': 'ISBN issues are treated as high priority. We are escalating this to our production team now and will confirm the resolution within 48 hours.',
    'Printing & Quality': 'Please share clear photos of the affected copies. Once verified, we will arrange a free reprint, which takes 5-7 business days.',
    'Distribution & Availability': 'This is usually a stock sync issue. We are asking our distribution team to trigger a re-sync, which typically takes 24-48 hours.',
    'Book Status & Production Updates': 'We are checking the current production stage with the team and will share a specific updated timeline within 48 hours.',
    'General Inquiry': 'Our team will review this and get back to you within 48 hours.',
  };
  return `Hi ${name},

Thank you for reaching out${bookLine}. We understand how important this is to you, and we want to get it right.

${steps[ticket.category] || steps['General Inquiry']}

Warm regards,
BookLeaf Support Team`;
}

module.exports = { classifyByRules, templateDraft };
