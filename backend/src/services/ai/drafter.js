const llm = require('./llmClient');
const { CORE, TONE, knowledgeFor } = require('./knowledgeBase');
const { templateDraft } = require('./rules');
const { nextPayoutWindow } = require('../../utils/payouts');

const MAX_HISTORY_MESSAGES = 4; // only the latest exchange, not the whole thread
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'never');
const inr = (n) => (n == null ? 'n/a' : `Rs.${Number(n).toLocaleString('en-IN')}`);

const ROLE = `You are a senior support representative at BookLeaf Publishing writing a reply to an author. Write the reply the admin will review and send.

RULES
- Use ONLY facts from the knowledge base and AUTHOR DATA. Never invent numbers, dates, tracking info or policies. If a fact is missing, say the team will confirm it and give a 48-hour timeline.
- Quote concrete figures from AUTHOR DATA when relevant (copies sold, royalty earned / paid / pending, last payout date, book status).
- 120-200 words. Plain text, no markdown, no bullet-heavy corporate language, no "I hope this email finds you well".
- Start with "Hi <first name>," and end with a clear next step, then "Warm regards,\\nBookLeaf Support Team".`;

/** Compact, relevant-only facts about the author's book(s). Keeps token use low and answers grounded. */
function buildAuthorData(context) {
  const lines = [`Author: ${context.authorName} (${context.authorCity || 'city n/a'}), joined ${fmtDate(context.joinedDate)}`];
  const books = context.book ? [context.book] : context.allBooks.slice(0, 6);
  for (const b of books) {
    lines.push(
      `- "${b.title}" [${b.status}] ISBN ${b.isbn}; MRP ${inr(b.mrp)}; sold ${b.totalCopiesSold}; ` +
        `royalty earned ${inr(b.totalRoyaltyEarned)}, paid ${inr(b.royaltyPaid)}, pending ${inr(b.royaltyPending)}; ` +
        `last payout ${fmtDate(b.lastRoyaltyPayoutDate)}; published ${fmtDate(b.publicationDate)}; ` +
        `print partner ${b.printPartner || 'n/a'}; available on ${b.availableOn.join(', ') || 'not yet listed'}`
    );
  }
  const window = nextPayoutWindow();
  lines.push(`Next royalty cycle: quarter ends ${window.quarterEnd}, payout due by ${window.payoutBy}.`);
  return lines.join('\n');
}

/**
 * Generate an admin-reviewable draft.
 * Returns { text, source: 'ai' | 'template' }. Never throws: on any LLM failure the
 * admin gets a policy-correct template and can edit / write manually.
 */
async function draftResponse({ ticket, context }) {
  const history = ticket.messages.slice(-MAX_HISTORY_MESSAGES)
    .map((m) => `${m.sender === 'author' ? 'AUTHOR' : 'BOOKLEAF'}: ${m.body}`).join('\n');

  const user = `AUTHOR DATA
${buildAuthorData(context)}

TICKET (${ticket.category}, priority ${ticket.priority})
Subject: ${ticket.subject}
Original message: ${ticket.description.slice(0, 2000)}
${history ? `\nRECENT THREAD\n${history}` : ''}

Write the reply.`;

  try {
    // Static prefix first (cacheable), ticket-specific content last.
    const { text } = await llm.complete({
      systemBlocks: [ROLE, `${CORE}\n\n${TONE}`, knowledgeFor(ticket.category)],
      user,
      maxTokens: 450,
      temperature: 0.4,
    });
    return { text, source: 'ai' };
  } catch (err) {
    console.warn(`[ai] draft fallback: ${err.message}`);
    return { text: templateDraft({ ticket, context }), source: 'template' };
  }
}

module.exports = { draftResponse };
