// Workouts & Progress component – Priyanka Pant
// Weekly workout plan with exercise instructions, logging a workout and workout history
// for the logged-in student (FF-16, FF-17, FF-18).
const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/requireLogin');
const { today, weekStart, addDays } = require('../utils/dates');
const { readNumber } = require('../utils/validation');

const router = express.Router();
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Training days per week -> which weekdays to train (spread out to leave rest days)
const TRAINING_SCHEDULES = {
  2: ['Monday', 'Thursday'],
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
};

router.use(requireLogin);

const getProfile = db.prepare('SELECT Goal AS goal, TrainingDays AS trainingDays FROM UserProfile WHERE UserID = ?');
const updateTrainingDays = db.prepare('UPDATE UserProfile SET TrainingDays = ? WHERE UserID = ?');
// Workouts for a goal: beginner-friendly first, then easiest first
const getWorkoutsForGoal = db.prepare(`
  SELECT WorkoutID AS workoutId, WorkoutName AS workoutName, Goal AS goal, Difficulty AS difficulty,
         DurationMinutes AS durationMinutes, IsBeginnerFriendly AS isBeginnerFriendly
  FROM Workouts WHERE Goal = ?
  ORDER BY IsBeginnerFriendly DESC, CASE Difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, WorkoutID`);
const getExercises = db.prepare(`
  SELECT ExerciseName AS exerciseName, Sets AS sets, Reps AS reps, Instructions AS instructions, MediaURL AS mediaUrl,
         ImagePath AS imageUrl
  FROM WorkoutExercise WHERE WorkoutID = ? ORDER BY ExerciseID`);
const findWorkout = db.prepare('SELECT WorkoutName FROM Workouts WHERE WorkoutID = ?');
const getWeekLogCounts = db.prepare(`
  SELECT WorkoutID, COUNT(*) AS count FROM WorkoutLog
  WHERE UserID = ? AND IsCompleted = 1 AND LogDate BETWEEN ? AND ? GROUP BY WorkoutID`);
const findLogOnDate = db.prepare('SELECT 1 FROM WorkoutLog WHERE UserID = ? AND WorkoutID = ? AND LogDate = ? AND IsCompleted = 1');
const insertLog = db.prepare('INSERT INTO WorkoutLog (UserID, WorkoutID, LogDate, IsCompleted) VALUES (?, ?, ?, 1)');
const getHistory = db.prepare(`
  SELECT l.LogID AS logId, l.LogDate AS logDate, w.WorkoutID AS workoutId, w.WorkoutName AS workoutName,
         w.DurationMinutes AS durationMinutes
  FROM WorkoutLog l JOIN Workouts w ON w.WorkoutID = l.WorkoutID
  WHERE l.UserID = ? AND l.IsCompleted = 1
  ORDER BY l.LogDate DESC, l.LogID DESC
  LIMIT 30`);

// The student's plan for this week: one session per training day, cycling through the
// workouts for their goal (beginner-friendly first). Sessions done this week are marked,
// and nextSession is the first session from today on that is not done yet.
function buildPlan(userId) {
  const { goal, trainingDays } = getProfile.get(userId);
  const empty = { goal, trainingDays, sessions: [], nextSession: null };
  if (!goal || !trainingDays) return empty;

  const workouts = getWorkoutsForGoal.all(goal).map((workout) => ({
    ...workout,
    isBeginnerFriendly: Boolean(workout.isBeginnerFriendly),
    exercises: getExercises.all(workout.workoutId),
  }));
  if (workouts.length === 0) return empty;

  const monday = weekStart();
  // Completed logs this week per workout, used up session by session so a workout
  // that appears twice in the week is only marked done as often as it was logged
  const logsLeft = new Map(getWeekLogCounts.all(userId, monday, addDays(monday, 6)).map((row) => [row.WorkoutID, row.count]));

  const sessions = TRAINING_SCHEDULES[trainingDays].map((day, index) => {
    const workout = workouts[index % workouts.length];
    const left = logsLeft.get(workout.workoutId) || 0;
    if (left > 0) logsLeft.set(workout.workoutId, left - 1);
    const date = addDays(monday, WEEKDAYS.indexOf(day));
    return { day, date, isToday: date === today(), isDone: left > 0, workout };
  });

  // After this week's last session, the next one is the first session next week
  const upcoming = sessions.find((session) => !session.isDone && session.date >= today())
    || { ...sessions[0], date: addDays(sessions[0].date, 7), isToday: false, isDone: false };
  const { workoutId, workoutName, durationMinutes, difficulty } = upcoming.workout;
  const nextSession = { day: upcoming.day, date: upcoming.date, isToday: upcoming.isToday, workout: { workoutId, workoutName, durationMinutes, difficulty } };

  return { goal, trainingDays, sessions, nextSession };
}

// GET /api/workouts/plan – this week's workout plan with exercises
router.get('/plan', (req, res) => {
  res.json(buildPlan(req.session.userId));
});

// PUT /api/workouts/plan – choose how many days a week to train { trainingDays: 2–5 }
router.put('/plan', (req, res) => {
  const trainingDays = readNumber(req.body.trainingDays, 2, 5, { integer: true });
  if (trainingDays === null) {
    return res.status(400).json({ error: 'Please choose between 2 and 5 training days per week.' });
  }
  updateTrainingDays.run(trainingDays, req.session.userId);
  res.json(buildPlan(req.session.userId));
});

// GET /api/workouts/history – the student's most recent completed workouts
router.get('/history', (req, res) => {
  res.json(getHistory.all(req.session.userId));
});

// POST /api/workouts/:id/log – mark a workout as done today
router.post('/:id/log', (req, res) => {
  const workoutId = Number(req.params.id);
  const workout = Number.isInteger(workoutId) ? findWorkout.get(workoutId) : undefined;
  if (!workout) return res.status(404).json({ error: 'Workout not found.' });

  const logDate = today();
  if (findLogOnDate.get(req.session.userId, workoutId, logDate)) {
    return res.status(409).json({ error: 'You have already logged this workout today.' });
  }

  const { lastInsertRowid } = insertLog.run(req.session.userId, workoutId, logDate);
  res.status(201).json({ logId: Number(lastInsertRowid), workoutId, workoutName: workout.WorkoutName, logDate });
});

module.exports = router;
