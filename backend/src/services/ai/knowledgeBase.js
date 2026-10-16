/**
 * BookLeaf knowledge base, split into sections so each AI call only receives
 * what is relevant (cost control). CORE + TONE are always sent; the topical
 * section is chosen from the ticket's category.
 */
const CORE = `BookLeaf Publishing is a self-publishing company operating in India and the US.
Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid; marketing and distribution add-ons).
BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management.
In-house printing facility and warehouse are in Delhi. Print partners: Repro India and Epitome Books.`;

const TONE = `TONE GUIDELINES
- Always empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before jumping to solutions.
- Be specific: use actual numbers, dates and statuses from the AUTHOR DATA instead of vague reassurance.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If the issue needs escalation or investigation, give a clear timeline (e.g. "Our team will look into this and get back to you within 48 hours"). Never open-ended promises.
- Always end with a clear next step for the author and/or the BookLeaf team.`;

const SECTIONS = {
  'Royalty & Payments': `ROYALTY POLICY
- 80/20 split: 80% of net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold is Rs.1,000; below that, royalties roll over to the next quarter.
- Payouts are by bank transfer to the account linked in the author's dashboard.
- Authors can see a detailed royalty breakdown (sales per platform) in their dashboard.
GUIDANCE: If no royalty received, explain the quarterly cycle + 45-day window, ask them to confirm bank details are linked, give the specific next payout date, and if genuinely overdue escalate with a 48-hour timeline. If the amount seems low, explain the net-profit calculation without being defensive and offer a line-by-line breakdown.`,

  'ISBN & Metadata Issues': `ISBN POLICY
- Every book gets a unique ISBN assigned by BookLeaf, registered under BookLeaf's publisher imprint.
- An author who wants an ISBN under their own imprint must obtain it independently.
- ISBN errors (duplicate, wrong book linked) are HIGH PRIORITY and escalated to the production team.
- Metadata updates (e.g. description) can be submitted via the dashboard or by emailing the team; changes reflect on platforms in 3-5 business days.
GUIDANCE: For an ISBN error, acknowledge it is a serious data issue, confirm immediate escalation to production, and give a 48-hour resolution timeline.`,

  'Printing & Quality': `PRINTING & QUALITY
- In-house printing handles most orders; overflow or specific formats go to Repro India or Epitome Books.
- Standard print turnaround: 5-7 business days from order confirmation.
- For quality issues (misprints, binding defects, colour inconsistency) BookLeaf arranges a FREE reprint after verification. The author may need to share photos of the defective copy.
GUIDANCE: Apologise sincerely, ask for photos of the defective copies, confirm a free reprint once verified, and state the 5-7 business day timeline.`,

  'Distribution & Availability': `DISTRIBUTION
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings typically go live 7-10 business days after publication is complete.
- A book showing "unavailable" on a platform usually means a stock sync issue; the team can trigger a re-sync within 24-48 hours.
GUIDANCE: Explain it is typically a stock sync issue, confirm you are triggering a re-sync with the distribution team, and set a 24-48 hour expectation.`,

  'Book Status & Production Updates': `PRODUCTION STAGES
Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Authors are emailed at each stage. Delays typically occur at Cover Design (waiting for author approval) and Proofreading (revision rounds).
GUIDANCE: Use the book's actual status from AUTHOR DATA. If delayed, be honest about why and give a specific updated timeline. Never blame the author even if the delay is on their side; frame it collaboratively.`,

  'General Inquiry': `GENERAL
- Metadata updates (e.g. a book description on Amazon after going live) can be submitted through the dashboard or by emailing the BookLeaf team; changes reflect on platforms within 3-5 business days.
GUIDANCE: Answer directly using the policies above; if unsure, say so and promise a follow-up within 48 hours rather than guessing.`,
};

const knowledgeFor = (category) => SECTIONS[category] || SECTIONS['General Inquiry'];

module.exports = { CORE, TONE, knowledgeFor };
