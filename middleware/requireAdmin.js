// Shared middleware (Accounts component – Muin Ahmed)
// Lets a request through only when an administrator is logged in.
// Student sessions never have an adminId, so students can never pass.
const db = require('../db/database');

const findAdmin = db.prepare('SELECT AdminID FROM Admins WHERE AdminID = ?');

// True if the session belongs to an admin that still exists
function hasAdminSession(req) {
  const adminId = req.session.adminId;
  if (!adminId) return false;
  if (findAdmin.get(adminId)) return true;
  delete req.session.adminId;
  return false;
}

// For /api/admin routes
function requireAdmin(req, res, next) {
  if (hasAdminSession(req)) return next();
  res.status(401).json({ error: 'Please log in as an administrator.' });
}

// For admin HTML pages
function requireAdminPage(req, res, next) {
  if (hasAdminSession(req)) return next();
  res.redirect('/admin/login.html');
}

module.exports = { requireAdmin, requireAdminPage };
