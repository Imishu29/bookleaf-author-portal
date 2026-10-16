/**
 * Royalties are calculated quarterly and paid within 45 days of quarter end.
 * Returns the current quarter's end and the payout deadline (ISO dates).
 */
function nextPayoutWindow(now = new Date()) {
  const q = Math.floor(now.getUTCMonth() / 3);
  const quarterEnd = new Date(Date.UTC(now.getUTCFullYear(), q * 3 + 3, 0));
  const payoutBy = new Date(quarterEnd.getTime() + 45 * 24 * 3600 * 1000);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { quarterEnd: iso(quarterEnd), payoutBy: iso(payoutBy) };
}

module.exports = { nextPayoutWindow };
