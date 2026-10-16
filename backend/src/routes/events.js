const router = require('express').Router();
const { userFromToken } = require('../middleware/auth');
const { addClient } = require('../services/realtime');
const { unauthorized } = require('../utils/errors');

/**
 * GET /api/events?token=<jwt>
 * Browsers' EventSource cannot send an Authorization header, so the JWT is accepted
 * as a query parameter on this one endpoint only (it is validated exactly the same way).
 */
router.get('/', async (req, res) => {
  const token = String(req.query.token || '');
  if (!token) throw unauthorized();
  const user = await userFromToken(token);

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  const remove = addClient(user, res);
  req.on('close', remove);
});

module.exports = router;
