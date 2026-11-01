// Accounts component – Muin Ahmed
// Admin log in and log out, using the Admins table (separate from student accounts).
const express = require('express');
const db = require('../../db/database');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { cleanText } = require('../../utils/validation');
const { passwordMatches } = require('../../utils/passwords');
const { startSession, endSession } = require('../../utils/session');

const router = express.Router();

const findAdminByUsername = db.prepare('SELECT AdminID, PasswordHash FROM Admins WHERE Username = ?');
const getAdminName = db.prepare('SELECT Username AS username FROM Admins WHERE AdminID = ?');

// POST /api/admin/auth/login – { username, password }
router.post('/login', async (req, res) => {
  const username = cleanText(req.body.username);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!username || !password) return res.status(400).json({ error: 'Please enter your username and password.' });

  const admin = findAdminByUsername.get(username);
  if (!(await passwordMatches(password, admin && admin.PasswordHash))) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }

  await startSession(req, { adminId: admin.AdminID });
  res.json({ username });
});

// POST /api/admin/auth/logout
router.post('/logout', async (req, res) => {
  await endSession(req, res);
  res.json({ message: 'Logged out' });
});

// GET /api/admin/auth/me – the logged-in admin's username
router.get('/me', requireAdmin, (req, res) => {
  res.json(getAdminName.get(req.session.adminId));
});

module.exports = router;
