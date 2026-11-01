// Workouts & Progress component – Priyanka Pant
// Weight log (add, edit, delete) and chart data for the progress page (FF-19, FF-20).
// Every query is limited to req.session.userId, so students only see and change their own entries.
const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/requireLogin');
const { today, isDateString, firstWeekStart, countByWeek } = require('../utils/dates');
const { readNumber } = require('../utils/validation');

const router = express.Router();
const CHART_WEEKS = 8;
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

router.use(requireLogin);

const getWeights = db.prepare(`SELECT WeightLogID AS weightLogId, WeightKg AS weightKg, LogDate AS logDate
                               FROM WeightLog WHERE UserID = ? ORDER BY LogDate, WeightLogID`);
const findWeight = db.prepare('SELECT WeightLogID FROM WeightLog WHERE WeightLogID = ? AND UserID = ?');
// Another entry on the same date (excludeId lets an entry keep its own date when edited)
const findOtherWeightOnDate = db.prepare('SELECT 1 FROM WeightLog WHERE UserID = ? AND LogDate = ? AND WeightLogID <> ?');
const insertWeight = db.prepare('INSERT INTO WeightLog (UserID, WeightKg, LogDate) VALUES (?, ?, ?)');
const updateWeight = db.prepare('UPDATE WeightLog SET WeightKg = ?, LogDate = ? WHERE WeightLogID = ? AND UserID = ?');
const deleteWeight = db.prepare('DELETE FROM WeightLog WHERE WeightLogID = ? AND UserID = ?');
const getWorkoutDatesSince = db.prepare('SELECT LogDate FROM WorkoutLog WHERE UserID = ? AND IsCompleted = 1 AND LogDate >= ?');

// Check { weightKg, logDate } from the request. Returns { error } or the cleaned values.
function readWeightEntry(body) {
  const weightKg = readNumber(body.weightKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG);
  if (weightKg === null) {
    return { error: `Weight must be a number between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.` };
  }
  if (!isDateString(body.logDate)) return { error: 'Please choose a valid date.' };
  if (body.logDate > today()) return { error: 'The date cannot be in the future.' };
  return { weightKg: Math.round(weightKg * 100) / 100, logDate: body.logDate };
}

// The id in /weights/:id if it belongs to this student, otherwise null
function ownWeightId(req) {
  const weightLogId = Number(req.params.id);
  return Number.isInteger(weightLogId) && findWeight.get(weightLogId, req.session.userId) ? weightLogId : null;
}

const DUPLICATE_DATE_ERROR = 'You already logged your weight on this date. Edit that entry instead.';

// GET /api/progress/weights – all weight entries, oldest first
router.get('/weights', (req, res) => {
  res.json(getWeights.all(req.session.userId));
});

// POST /api/progress/weights – add an entry { weightKg, logDate }
router.post('/weights', (req, res) => {
  const entry = readWeightEntry(req.body);
  if (entry.error) return res.status(400).json({ error: entry.error });
  if (findOtherWeightOnDate.get(req.session.userId, entry.logDate, 0)) return res.status(409).json({ error: DUPLICATE_DATE_ERROR });

  const { lastInsertRowid } = insertWeight.run(req.session.userId, entry.weightKg, entry.logDate);
  res.status(201).json({ weightLogId: Number(lastInsertRowid), ...entry });
});

// PUT /api/progress/weights/:id – change an entry's weight and/or date
router.put('/weights/:id', (req, res) => {
  const weightLogId = ownWeightId(req);
  if (!weightLogId) return res.status(404).json({ error: 'Weight entry not found.' });

  const entry = readWeightEntry(req.body);
  if (entry.error) return res.status(400).json({ error: entry.error });
  if (findOtherWeightOnDate.get(req.session.userId, entry.logDate, weightLogId)) return res.status(409).json({ error: DUPLICATE_DATE_ERROR });

  updateWeight.run(entry.weightKg, entry.logDate, weightLogId, req.session.userId);
  res.json({ weightLogId, ...entry });
});

// DELETE /api/progress/weights/:id – remove an entry
router.delete('/weights/:id', (req, res) => {
  const weightLogId = ownWeightId(req);
  if (!weightLogId) return res.status(404).json({ error: 'Weight entry not found.' });

  deleteWeight.run(weightLogId, req.session.userId);
  res.status(204).end();
});

// GET /api/progress/workouts-per-week – completed workouts in each of the last 8 weeks (oldest first)
router.get('/workouts-per-week', (req, res) => {
  const dates = getWorkoutDatesSince.all(req.session.userId, firstWeekStart(CHART_WEEKS)).map((row) => row.LogDate);
  res.json(countByWeek(dates, CHART_WEEKS));
});

module.exports = router;
