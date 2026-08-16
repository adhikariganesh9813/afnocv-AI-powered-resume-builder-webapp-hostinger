const jwt = require('jsonwebtoken');

// Blocks the request unless it carries a valid token, and attaches the decoded
// user to req.user so controllers below never have to re-check who's calling.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Not signed in.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

module.exports = { requireAuth };
