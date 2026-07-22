const jwt = require('jsonwebtoken');

function signToken(judge) {
  const secret = process.env.JWT_SECRET || 'local-dev-secret-change-me';
  return jwt.sign(
    {
      id: judge._id.toString(),
      username: judge.username,
      isAdmin: !!judge.isAdmin
    },
    secret,
    { expiresIn: '12h' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'local-dev-secret-change-me';
    req.user = jwt.verify(token, secret);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

module.exports = {
  signToken,
  requireAuth,
  requireAdmin
};
