// Accounts component – Muin Ahmed
// Users admin: view, sort, search, edit, deactivate/reactivate and delete student accounts,
// and user statistics. Passwords are never returned or changed here.
const express = require('express');
const db = require('../../db/database');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { cleanText, checkFullName, checkEmail, readNumber } = require('../../utils/validation');
const { containsPattern } = require('../../utils/search');
const { firstWeekStart, countByWeek } = require('../../utils/dates');

const router = express.Router();
const SIGNUP_WEEKS = 8;

// Allowed sort columns -> fixed SQL (never built from user text)
const SORT_COLUMNS = { name: 'LOWER(FullName)', dateJoined: 'DateJoined' };

router.use(requireAdmin);

const USER_COLUMNS = `UserID AS userId, FullName AS fullName, Email AS email, WeeklyBudget AS weeklyBudget,
  IsActive AS isActive, DateJoined AS dateJoined`;
const getUser = db.prepare(`SELECT ${USER_COLUMNS} FROM Users WHERE UserID = ?`);
const findOtherUserWithEmail = db.prepare('SELECT 1 FROM Users WHERE Email = ? AND UserID <> ?');
const updateDetails = db.prepare('UPDATE Users SET FullName = ?, Email = ?, WeeklyBudget = ? WHERE UserID = ?');
const updateActive = db.prepare('UPDATE Users SET IsActive = ? WHERE UserID = ?');
const deleteUser = db.prepare('DELETE FROM Users WHERE UserID = ?');
const countUsers = db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS active FROM Users');
const getJoinDatesSince = db.prepare('SELECT DateJoined FROM Users WHERE DateJoined >= ?');

function toUser(row) {
  return { ...row, isActive: Boolean(row.isActive) };
}

// The user in /users/:id, or undefined
function findUser(req) {
  const userId = Number(req.params.id);
  return Number.isInteger(userId) ? getUser.get(userId) : undefined;
}

// GET /api/admin/users?search=&sort=name|dateJoined&order=asc|desc
router.get('/', (req, res) => {
  const { search = '', sort = 'name', order = 'asc' } = req.query;
  if (typeof search !== 'string' || search.length > 100) return res.status(400).json({ error: 'Search text is too long.' });
  if (!SORT_COLUMNS[sort]) return res.status(400).json({ error: 'Sort by name or dateJoined.' });
  if (order !== 'asc' && order !== 'desc') return res.status(400).json({ error: 'Order must be asc or desc.' });

  const where = search.trim() ? "WHERE LOWER(FullName) LIKE ? ESCAPE '\\' OR LOWER(Email) LIKE ? ESCAPE '\\'" : '';
  const params = search.trim() ? [containsPattern(search), containsPattern(search)] : [];
  const direction = order === 'desc' ? 'DESC' : 'ASC';
  const rows = db.prepare(`SELECT ${USER_COLUMNS} FROM Users ${where}
                           ORDER BY ${SORT_COLUMNS[sort]} ${direction}, UserID ${direction}`).all(...params);
  res.json(rows.map(toUser));
});

// GET /api/admin/users/stats – totals and new sign-ups per week (last 8 weeks)
router.get('/stats', (req, res) => {
  const { total, active } = countUsers.get();
  const joinDates = getJoinDatesSince.all(firstWeekStart(SIGNUP_WEEKS)).map((row) => row.DateJoined);
  res.json({
    total,
    active: active || 0,
    inactive: total - (active || 0),
    signupsPerWeek: countByWeek(joinDates, SIGNUP_WEEKS),
  });
});

// PUT /api/admin/users/:id – edit { fullName, email, weeklyBudget } (0 = not set yet)
router.put('/:id', (req, res) => {
  const user = findUser(req);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const fullName = cleanText(req.body.fullName);
  const email = cleanText(req.body.email).toLowerCase();
  const error = checkFullName(fullName) || checkEmail(email);
  if (error) return res.status(400).json({ error });
  const weeklyBudget = readNumber(req.body.weeklyBudget, 0, 9999.99);
  if (weeklyBudget === null) return res.status(400).json({ error: 'Weekly budget must be between 0 and 9999.99 kr.' });
  if (findOtherUserWithEmail.get(email, user.userId)) return res.status(409).json({ error: 'This email is already in use' });

  updateDetails.run(fullName, email, Math.round(weeklyBudget * 100) / 100, user.userId);
  res.json(toUser(getUser.get(user.userId)));
});

// PUT /api/admin/users/:id/status – deactivate or reactivate { isActive: true | false }
router.put('/:id/status', (req, res) => {
  const user = findUser(req);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be true or false.' });

  updateActive.run(req.body.isActive ? 1 : 0, user.userId);
  res.json(toUser(getUser.get(user.userId)));
});

// DELETE /api/admin/users/:id – delete the account and (by cascade) all of the student's data
router.delete('/:id', (req, res) => {
  const user = findUser(req);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  deleteUser.run(user.userId);
  res.status(204).end();
});

module.exports = router;
