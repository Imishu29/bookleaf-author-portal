const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { unauthorized, forbidden } = require('../utils/errors');

/** Resolve the user behind a JWT. Re-reads the DB so deactivated users lose access immediately. */
async function userFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('User no longer exists');
  return user;
}

/** Protects every route it is mounted on. Expects `Authorization: Bearer <token>`. */
async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();
  req.user = await userFromToken(token);
  next();
}

/** Role-based access control. Usage: requireRole('admin'). */
const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw forbidden();
  next();
};

module.exports = { authenticate, requireRole, userFromToken };
