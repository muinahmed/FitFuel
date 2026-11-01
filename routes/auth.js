// Accounts component – Muin Ahmed
// Student sign up, log in and log out (FF-7, FF-8).
const express = require('express');
const db = require('../db/database');
const { today } = require('../utils/dates');
const { cleanText, checkFullName, checkEmail, checkNewPassword } = require('../utils/validation');
const { hashPassword, passwordMatches } = require('../utils/passwords');
const { startSession, endSession } = require('../utils/session');

const router = express.Router();

const findUserByEmail = db.prepare('SELECT UserID, PasswordHash, IsActive FROM Users WHERE Email = ?');
const insertUser = db.prepare(`INSERT INTO Users (FullName, Email, PasswordHash, WeeklyBudget, IsActive, DateJoined)
                               VALUES (?, ?, ?, 0, 1, ?)`);
const insertProfile = db.prepare("INSERT INTO UserProfile (UserID, DietType) VALUES (?, 'none')");

// POST /api/auth/signup – create an account and log the student in
router.post('/signup', async (req, res) => {
  const fullName = cleanText(req.body.fullName);
  const email = cleanText(req.body.email).toLowerCase();
  const { password, confirmPassword } = req.body;

  const error = checkFullName(fullName) || checkEmail(email) || checkNewPassword(password, confirmPassword);
  if (error) return res.status(400).json({ error });
  if (findUserByEmail.get(email)) return res.status(409).json({ error: 'This email is already in use' });

  const passwordHash = await hashPassword(password);
  let userId;
  try {
    userId = db.transaction(() => {
      const { lastInsertRowid } = insertUser.run(fullName, email, passwordHash, today());
      insertProfile.run(lastInsertRowid);
      return Number(lastInsertRowid);
    })();
  } catch (dbError) {
    // Another sign-up with the same email can finish while we were hashing
    if (dbError.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'This email is already in use' });
    throw dbError;
  }

  await startSession(req, { userId });
  res.status(201).json({ userId, fullName, email });
});

// POST /api/auth/login – check email + password and start a session
router.post('/login', async (req, res) => {
  const email = cleanText(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: 'Please enter your email and password.' });

  const user = findUserByEmail.get(email);
  if (!(await passwordMatches(password, user && user.PasswordHash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  if (!user.IsActive) {
    return res.status(403).json({ error: 'Your account has been deactivated. Please contact support.' });
  }

  await startSession(req, { userId: user.UserID });
  res.json({ userId: user.UserID });
});

// POST /api/auth/logout – end the session
router.post('/logout', async (req, res) => {
  await endSession(req, res);
  res.json({ message: 'Logged out' });
});

module.exports = router;
