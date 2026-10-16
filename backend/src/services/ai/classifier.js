const { CATEGORIES, PRIORITIES } = require('../../constants');
const llm = require('./llmClient');
const { classifyByRules } = require('./rules');

// Classification needs definitions only, NOT the full knowledge base -> tiny, cheap prompt.
const SYSTEM = `You triage support tickets for BookLeaf Publishing, a self-publishing company. Authors write in about royalties, ISBNs, printing, distribution and production status.

Return ONLY a JSON object: {"category": string, "priority": string, "reason": string}

category must be exactly one of:
- "Royalty & Payments": royalty amounts, payout timing, bank details, missing payments
- "ISBN & Metadata Issues": wrong/duplicate ISBN, book title/description/author-name metadata errors
- "Printing & Quality": misprints, binding, blurry images, damaged copies, print turnaround
- "Distribution & Availability": book missing/unavailable on Amazon, Flipkart, BookLeaf Store etc.
- "Book Status & Production Updates": where a book is in editing/cover/typesetting/proofreading; delays
- "General Inquiry": anything else (bio changes, how-to, policy questions)

priority must be exactly one of:
- "Critical": money long overdue (months) with no response, data corruption that harms sales (wrong ISBN live on a platform), legal/fraud threats, book completely unavailable after launch
- "High": ISBN errors, defective printed copies, royalty missing or disputed, repeated follow-ups, deadline pressure
- "Medium": status questions on a delayed book, small royalty discrepancies, metadata fixes
- "Low": informational questions, cosmetic updates, no time pressure

reason: one short sentence (max 20 words). No text outside the JSON.`;

function parse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no JSON in model output');
  const obj = JSON.parse(match[0]);
  if (!CATEGORIES.includes(obj.category) || !PRIORITIES.includes(obj.priority)) {
    throw new Error('model returned out-of-vocabulary label');
  }
  return { category: obj.category, priority: obj.priority, reason: String(obj.reason || '').slice(0, 200) };
}

/**
 * Never throws. Returns { category, priority, reason, source: 'ai' | 'rules' }.
 * Only the subject, description (truncated) and book title are sent: no author PII.
 */
async function classifyTicket({ subject, description, bookTitle }) {
  const user = `Book: ${bookTitle || 'General / Account level'}
Subject: ${subject}
Message: ${description.slice(0, 1500)}`;

  try {
    const { text } = await llm.complete({ systemBlocks: [SYSTEM], user, maxTokens: 120, temperature: 0 });
    return { ...parse(text), source: 'ai' };
  } catch (err) {
    console.warn(`[ai] classify fallback: ${err.message}`);
    return { ...classifyByRules({ subject, description }), source: 'rules' };
  }
}

module.exports = { classifyTicket };
