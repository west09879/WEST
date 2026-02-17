const jwt = require('jsonwebtoken');

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
  try {
    const payload = jwt.verify(token, secret);
    // attach admin info if needed
    req.admin = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = adminAuth;
