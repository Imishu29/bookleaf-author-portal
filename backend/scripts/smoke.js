/** End-to-end API smoke test. Run with the server up:  node scripts/smoke.js */
const BASE = process.env.API || 'http://localhost:4000/api';
let failures = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
function check(name, cond, extra = '') {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`);
}

(async () => {
  const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } }));
  const a = await login('priya.sharma@email.com', 'Author@123');
  const b = await login('rohit.kapoor@email.com', 'Author@123');
  const adm = await login('admin@bookleaf.com', 'Admin@123');
  check('author login', a.status === 200 && a.data.token);
  check('bad password -> 401', (await login('priya.sharma@email.com', 'nope')).status === 401);
  check('invalid email -> 400', (await login('not-an-email', 'x')).status === 400);

  check('no token -> 401', (await call('GET', '/books')).status === 401);
  const books = await call('GET', '/books', { token: a.data.token });
  check('author sees only own books (2)', books.data.books.length === 2, JSON.stringify(books.data).slice(0, 120));
  check('admin sees all 18 books', (await call('GET', '/books', { token: adm.data.token })).data.books.length === 18);
  check("other author's book -> 404", (await call('GET', '/books/BK003', { token: a.data.token })).status === 404);

  const t = await call('POST', '/tickets', {
    token: a.data.token,
    body: { bookId: 'BK001', subject: 'Royalty amount seems too low', description: 'I sold 342 copies of my book but my royalty seems far too low. Please explain.' },
  });
  check('create ticket 201', t.status === 201, JSON.stringify(t.data));
  check('author payload hides internal fields', t.data.ticket && !('internalNotes' in t.data.ticket) && !('aiDraft' in t.data.ticket));
  check('short description -> 400', (await call('POST', '/tickets', { token: a.data.token, body: { subject: 'Hello there', description: 'short' } })).status === 400);
  check('wrong book -> 404', (await call('POST', '/tickets', { token: a.data.token, body: { bookId: 'BK003', subject: 'Hello there', description: 'x'.repeat(30) } })).status === 404);
  check('admin cannot create ticket -> 403', (await call('POST', '/tickets', { token: adm.data.token, body: { subject: 'Hello there', description: 'x'.repeat(30) } })).status === 403);

  await new Promise((r) => setTimeout(r, 800)); // let background triage finish
  const id = t.data.ticket._id;
  check("other author can't read ticket -> 404", (await call('GET', `/tickets/${id}`, { token: b.data.token })).status === 404);
  const adminView = await call('GET', `/tickets/${id}`, { token: adm.data.token });
  check('triage applied', adminView.data.ticket.categorySource !== 'pending', JSON.stringify(adminView.data.ticket.categorySource));
  console.log('      ->', adminView.data.ticket.category, '/', adminView.data.ticket.priority, `(${adminView.data.ticket.categorySource})`);

  check('author cannot PATCH -> 403', (await call('PATCH', `/tickets/${id}`, { token: a.data.token, body: { status: 'Closed' } })).status === 403);
  const ov = await call('PATCH', `/tickets/${id}`, { token: adm.data.token, body: { priority: 'Critical', assignedTo: 'me' } });
  check('admin override priority', ov.data.ticket.priority === 'Critical' && ov.data.ticket.prioritySource === 'admin');
  check('bad enum -> 400', (await call('PATCH', `/tickets/${id}`, { token: adm.data.token, body: { priority: 'Urgent' } })).status === 400);

  await call('POST', `/tickets/${id}/notes`, { token: adm.data.token, body: { body: 'Check Q3 statement' } });
  const draft = await call('POST', `/tickets/${id}/ai-draft`, { token: adm.data.token });
  check('draft generated', draft.status === 200 && draft.data.draft.text.length > 50);
  console.log('      draft source:', draft.data.draft.source);

  const reply = await call('POST', `/tickets/${id}/messages`, { token: adm.data.token, body: { body: draft.data.draft.text, fromAiDraft: true } });
  check('admin reply -> In Progress', reply.status === 201 && reply.data.ticket.status === 'In Progress');
  const authorView = await call('GET', `/tickets/${id}`, { token: a.data.token });
  check('author sees reply, not notes', authorView.data.ticket.messages.length === 1 && !('internalNotes' in authorView.data.ticket));

  const list = await call('GET', '/tickets?status=Open&sort=urgency', { token: adm.data.token });
  check('admin list filter', list.status === 200 && list.data.tickets.every((x) => x.status === 'Open'));
  check('author list scoped', (await call('GET', '/tickets', { token: b.data.token })).data.tickets.every((x) => x.author.authorId === 'AUTH002'));
  check('stats', (await call('GET', '/tickets/stats/summary', { token: adm.data.token })).status === 200);
  check('unknown route -> 404 json', (await call('GET', '/nope')).status === 404);

  console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
