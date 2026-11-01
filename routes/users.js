// Accounts component – Muin Ahmed
// The logged-in student's own account: details, goal and diet, budget and password (FF-9, FF-10).
// Every route works on req.session.userId only, so students can never touch another student's data.
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/database');
const { requireLogin } = require('../middleware/requireLogin');
const { cleanText, checkFullName, checkEmail, checkNewPassword, checkPositiveAmount } = require('../utils/validation');
const { DIET_TYPES } = require('../utils/dietFilter');

const router = express.Router();
const BCRYPT_COST = 10;
const GOALS = ['lose weight', 'build muscle', 'stay healthy'];

router.use(requireLogin);

// Never selects PasswordHash
const getAccount = db.prepare(`
  SELECT u.UserID AS userId, u.FullName AS fullName, u.Email AS email, u.WeeklyBudget AS weeklyBudget,
         u.DateJoined AS dateJoined, p.Goal AS goal, p.DietType AS dietType,
         p.ReminderDay AS reminderDay, p.TrainingDays AS trainingDays
  FROM Users u LEFT JOIN UserProfile p ON p.UserID = u.UserID
  WHERE u.UserID = ?`);
const findOtherUserWithEmail = db.prepare('SELECT UserID FROM Users WHERE Email = ? AND UserID <> ?');
const updateDetails = db.prepare('UPDATE Users SET FullName = ?, Email = ? WHERE UserID = ?');
const updateBudget = db.prepare('UPDATE Users SET WeeklyBudget = ? WHERE UserID = ?');
const updateGoalAndDiet = db.prepare('UPDATE UserProfile SET Goal = ?, DietType = ? WHERE UserID = ?');
const getPasswordHash = db.prepare('SELECT PasswordHash FROM Users WHERE UserID = ?');
const updatePasswordHash = db.prepare('UPDATE Users SET PasswordHash = ? WHERE UserID = ?');

// GET /api/users/me – account details and profile of the logged-in student
router.get('/me', (req, res) => {
  res.json(getAccount.get(req.session.userId));
});

// PUT /api/users/me/details – change name and email
router.put('/me/details', (req, res) => {
  const fullName = cleanText(req.body.fullName);
  const email = cleanText(req.body.email).toLowerCase();

  const error = checkFullName(fullName) || checkEmail(email);
  if (error) return res.status(400).json({ error });
  if (findOtherUserWithEmail.get(email, req.session.userId)) {
    return res.status(409).json({ error: 'This email is already in use' });
  }

  updateDetails.run(fullName, email, req.session.userId);
  res.json(getAccount.get(req.session.userId));
});

// PUT /api/users/me/budget – set the weekly food budget (kr)
router.put('/me/budget', (req, res) => {
  const error = checkPositiveAmount(req.body.weeklyBudget, 'Weekly budget');
  if (error) return res.status(400).json({ error });

  const weeklyBudget = Math.round(Number(req.body.weeklyBudget) * 100) / 100;
  updateBudget.run(weeklyBudget, req.session.userId);
  res.json(getAccount.get(req.session.userId));
});

// PUT /api/users/me/profile – choose fitness goal and diet type
router.put('/me/profile', (req, res) => {
  const { goal, dietType } = req.body;
  if (!GOALS.includes(goal)) return res.status(400).json({ error: 'Please choose a fitness goal.' });
  if (!DIET_TYPES.includes(dietType)) return res.status(400).json({ error: 'Please choose a diet type.' });

  updateGoalAndDiet.run(goal, dietType, req.session.userId);
  res.json(getAccount.get(req.session.userId));
});

// PUT /api/users/me/password – change password (current password required)
router.put('/me/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ error: 'Please enter your current password.' });
  }

  const { PasswordHash } = getPasswordHash.get(req.session.userId);
  if (!(await bcrypt.compare(currentPassword, PasswordHash))) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }

  const error = checkNewPassword(newPassword, confirmPassword);
  if (error) return res.status(400).json({ error });

  updatePasswordHash.run(await bcrypt.hash(newPassword, BCRYPT_COST), req.session.userId);
  res.json({ message: 'Password changed' });
});

module.exports = router;
