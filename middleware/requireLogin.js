// Shared middleware (Accounts component – Muin Ahmed)
// Lets a request through only when a student is logged in and their account is still active.
const db = require('../db/database');

const findActiveUser = db.prepare('SELECT UserID FROM Users WHERE UserID = ? AND IsActive = 1');

// True if the session belongs to an active student.
// A deactivated or deleted student is logged out straight away.
function hasActiveSession(req) {
  const userId = req.session.userId;
  if (!userId) return false;
  if (findActiveUser.get(userId)) return true;
  delete req.session.userId;
  return false;
}

// For API routes: answer 401 so the browser can send the student to the login page
function requireLogin(req, res, next) {
  if (hasActiveSession(req)) return next();
  res.status(401).json({ error: 'Please log in to continue.' });
}

// For student HTML pages: redirect logged-out visitors to the login page
function requireLoginPage(req, res, next) {
  if (hasActiveSession(req)) return next();
  res.redirect('/login.html');
}

module.exports = { requireLogin, requireLoginPage };
