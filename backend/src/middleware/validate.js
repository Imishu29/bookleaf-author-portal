const { badRequest } = require('../utils/errors');

/**
 * Validate req[source] against a zod schema and replace it with the parsed
 * (trimmed / coerced) value. Failures become a 400 with per-field details.
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.') || source,
      message: i.message,
    }));
    throw badRequest('Validation failed', details);
  }
  // req.query is a getter in Express 5, so stash parsed values separately.
  req.valid = { ...(req.valid || {}), [source]: result.data };
  next();
};

module.exports = { validate };
