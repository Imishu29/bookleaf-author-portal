/**
 * Server-Sent Events hub. SSE was chosen over WebSockets because traffic is
 * one-directional (server -> browser), it reconnects automatically, and it
 * works through plain HTTP proxies without extra infrastructure.
 *
 * Events carry only IDs; clients refetch via the normal REST API, so
 * authorisation rules live in exactly one place.
 */
const clients = new Set(); // { res, userId, role, authorId }

function addClient(user, res) {
  const client = { res, userId: String(user._id), role: user.role, authorId: user.author ? String(user.author) : null };
  clients.add(client);
  return () => clients.delete(client);
}

/** Notify the ticket's author and every admin. */
function publishTicketEvent(type, ticket) {
  const payload = `event: ${type}\ndata: ${JSON.stringify({ ticketId: String(ticket._id) })}\n\n`;
  for (const c of clients) {
    if (c.role === 'admin' || c.authorId === String(ticket.author)) c.res.write(payload);
  }
}

// Keep idle connections alive through proxies.
setInterval(() => {
  for (const c of clients) c.res.write(': ping\n\n');
}, 25000).unref();

module.exports = { addClient, publishTicketEvent };
