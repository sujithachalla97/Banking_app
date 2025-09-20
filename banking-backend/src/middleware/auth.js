// src/middleware/auth.js
import jwt from 'jsonwebtoken';// src/middleware/auth.js


/**
 * Auth middleware: verifies JWT and attaches user payload.
 */
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Missing token' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload should contain { id, role }
    req.user = {
      id: payload.id,
      role: payload.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}

/**
 * Require a specific role (e.g., "admin")
 * Usage: router.get('/admin', authMiddleware, requireRole('admin'), handler);
 */
export const requireRole = (role) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (req.user.role !== role) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }
  next();
};
