// Workouts & Progress component – Priyanka Pant
// Workouts admin: add, edit, delete and filter workouts, and view workout activity.
// Jira epic FF-27 (Admin back end).
const express = require('express');
const db = require('../../db/database');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { cleanText, readNumber, readWebAddress } = require('../../utils/validation');
const { readImagePath, deleteUnusedImages } = require('../../utils/uploads');

const router = express.Router();
const GOALS = ['lose weight', 'build muscle', 'stay healthy'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const MAX_EXERCISES = 20;

router.use(requireAdmin);

const WORKOUT_COLUMNS = `w.WorkoutID AS workoutId, w.WorkoutName AS workoutName, w.Goal AS goal, w.Difficulty AS difficulty,
  w.DurationMinutes AS durationMinutes, w.IsBeginnerFriendly AS isBeginnerFriendly, w.DateCreated AS dateCreated`;
const getWorkout = db.prepare(`SELECT ${WORKOUT_COLUMNS} FROM Workouts w WHERE w.WorkoutID = ?`);
const getExercises = db.prepare(`SELECT ExerciseName AS exerciseName, Sets AS sets, Reps AS reps,
                                        Instructions AS instructions, MediaURL AS mediaUrl, ImagePath AS imagePath
                                 FROM WorkoutExercise WHERE WorkoutID = ? ORDER BY ExerciseID`);
const insertWorkout = db.prepare(`INSERT INTO Workouts (WorkoutName, Goal, Difficulty, DurationMinutes, IsBeginnerFriendly)
                                  VALUES (?, ?, ?, ?, ?)`);
const updateWorkout = db.prepare(`UPDATE Workouts SET WorkoutName = ?, Goal = ?, Difficulty = ?, DurationMinutes = ?, IsBeginnerFriendly = ?
                                  WHERE WorkoutID = ?`);
const deleteWorkout = db.prepare('DELETE FROM Workouts WHERE WorkoutID = ?');
const insertExercise = db.prepare(`INSERT INTO WorkoutExercise (WorkoutID, ExerciseName, Sets, Reps, Instructions, MediaURL, ImagePath)
                                   VALUES (?, ?, ?, ?, ?, ?, ?)`);
const getExerciseImages = db.prepare('SELECT ImagePath FROM WorkoutExercise WHERE WorkoutID = ? AND ImagePath IS NOT NULL');
const deleteExercises = db.prepare('DELETE FROM WorkoutExercise WHERE WorkoutID = ?');
const getActivity = db.prepare(`
  SELECT w.WorkoutID AS workoutId, w.WorkoutName AS workoutName, w.Goal AS goal,
         SUM(CASE WHEN l.IsCompleted = 1 THEN 1 ELSE 0 END) AS timesLogged
  FROM Workouts w LEFT JOIN WorkoutLog l ON l.WorkoutID = w.WorkoutID
  GROUP BY w.WorkoutID, w.WorkoutName, w.Goal
  ORDER BY timesLogged DESC, w.WorkoutName`);

function toWorkout(row) {
  return { ...row, isBeginnerFriendly: Boolean(row.isBeginnerFriendly) };
}

// One workout with its exercises, or undefined
function getWorkoutDetail(workoutId) {
  const row = Number.isInteger(workoutId) ? getWorkout.get(workoutId) : undefined;
  return row ? { ...toWorkout(row), exercises: getExercises.all(workoutId) } : undefined;
}

// Check a workout from the admin form. Returns { error } or the cleaned workout.
function readWorkoutInput(body) {
  const workoutName = cleanText(body.workoutName);
  if (!workoutName || workoutName.length > 60) return { error: 'Workout name is required (up to 60 characters).' };
  if (!GOALS.includes(body.goal)) return { error: 'Please choose a goal.' };
  if (!DIFFICULTIES.includes(body.difficulty)) return { error: 'Please choose a difficulty.' };
  const durationMinutes = readNumber(body.durationMinutes, 1, 300, { integer: true });
  if (durationMinutes === null) return { error: 'Duration must be a whole number of minutes between 1 and 300.' };
  if (typeof body.isBeginnerFriendly !== 'boolean') return { error: 'Say whether the workout is beginner-friendly.' };

  if (!Array.isArray(body.exercises) || body.exercises.length === 0 || body.exercises.length > MAX_EXERCISES) {
    return { error: `Add between 1 and ${MAX_EXERCISES} exercises.` };
  }
  const exercises = [];
  for (const [index, item] of body.exercises.entries()) {
    const row = `Exercise ${index + 1}`;
    const exerciseName = cleanText(item && item.exerciseName);
    const sets = readNumber(item && item.sets, 1, 20, { integer: true });
    const reps = readNumber(item && item.reps, 1, 500, { integer: true });
    const instructions = cleanText(item && item.instructions);
    const mediaText = cleanText(item && item.mediaUrl);
    const mediaUrl = mediaText ? readWebAddress(mediaText) : null;
    if (!exerciseName || exerciseName.length > 60) return { error: `${row}: name is required (up to 60 characters).` };
    if (sets === null) return { error: `${row}: sets must be a whole number from 1 to 20.` };
    if (reps === null) return { error: `${row}: reps must be a whole number from 1 to 500.` };
    if (instructions.length > 255) return { error: `${row}: instructions can be up to 255 characters.` };
    if (mediaText && (!mediaUrl || mediaUrl.length > 255)) return { error: `${row}: the video link must be a web address starting with http:// or https://.` };
    const imagePath = readImagePath(item && item.imagePath);
    if (imagePath === undefined) return { error: `${row}: the photo was not found. Upload it again.` };
    exercises.push({ exerciseName, sets, reps, instructions: instructions || null, mediaUrl, imagePath });
  }

  return { workoutName, goal: body.goal, difficulty: body.difficulty, durationMinutes, isBeginnerFriendly: body.isBeginnerFriendly, exercises };
}

function insertExercises(workoutId, exercises) {
  for (const item of exercises) {
    insertExercise.run(workoutId, item.exerciseName, item.sets, item.reps, item.instructions, item.mediaUrl, item.imagePath);
  }
}

// Jira: FF-43 Filter workouts
// GET /api/admin/workouts?goal=&difficulty=&beginner=true|false – filtered list with activity counts
router.get('/', (req, res) => {
  const { goal = '', difficulty = '', beginner = '' } = req.query;
  if (goal && !GOALS.includes(goal)) return res.status(400).json({ error: 'Unknown goal.' });
  if (difficulty && !DIFFICULTIES.includes(difficulty)) return res.status(400).json({ error: 'Unknown difficulty.' });
  if (beginner && beginner !== 'true' && beginner !== 'false') return res.status(400).json({ error: 'beginner must be true or false.' });

  const conditions = [];
  const params = [];
  if (goal) { conditions.push('w.Goal = ?'); params.push(goal); }
  if (difficulty) { conditions.push('w.Difficulty = ?'); params.push(difficulty); }
  if (beginner) { conditions.push('w.IsBeginnerFriendly = ?'); params.push(beginner === 'true' ? 1 : 0); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT ${WORKOUT_COLUMNS},
           (SELECT COUNT(*) FROM WorkoutExercise x WHERE x.WorkoutID = w.WorkoutID) AS exerciseCount,
           (SELECT COUNT(*) FROM WorkoutLog l WHERE l.WorkoutID = w.WorkoutID AND l.IsCompleted = 1) AS timesLogged
    FROM Workouts w ${where}
    ORDER BY w.Goal, CASE w.Difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, w.WorkoutName`).all(...params);
  res.json(rows.map(toWorkout));
});

// Jira: FF-44 View workout activity
// GET /api/admin/workouts/activity – completed logs per workout, most logged first
router.get('/activity', (req, res) => {
  res.json(getActivity.all());
});

// Jira: FF-41 Edit workout
// GET /api/admin/workouts/:id – one workout with exercises (for the edit form)
router.get('/:id', (req, res) => {
  const workout = getWorkoutDetail(Number(req.params.id));
  if (!workout) return res.status(404).json({ error: 'Workout not found.' });
  res.json(workout);
});

// Jira: FF-40 Add workout
// POST /api/admin/workouts – add a workout with exercises
router.post('/', (req, res) => {
  const workout = readWorkoutInput(req.body);
  if (workout.error) return res.status(400).json({ error: workout.error });

  const workoutId = db.transaction(() => {
    const { lastInsertRowid } = insertWorkout.run(workout.workoutName, workout.goal, workout.difficulty,
      workout.durationMinutes, workout.isBeginnerFriendly ? 1 : 0);
    insertExercises(lastInsertRowid, workout.exercises);
    return Number(lastInsertRowid);
  })();
  res.status(201).json(getWorkoutDetail(workoutId));
});

// Jira: FF-41 Edit workout
// PUT /api/admin/workouts/:id – replace a workout's details and exercises
router.put('/:id', (req, res) => {
  const workoutId = Number(req.params.id);
  if (!getWorkoutDetail(workoutId)) return res.status(404).json({ error: 'Workout not found.' });
  const workout = readWorkoutInput(req.body);
  if (workout.error) return res.status(400).json({ error: workout.error });

  const oldImages = getExerciseImages.all(workoutId).map((row) => row.ImagePath);
  db.transaction(() => {
    updateWorkout.run(workout.workoutName, workout.goal, workout.difficulty, workout.durationMinutes,
      workout.isBeginnerFriendly ? 1 : 0, workoutId);
    deleteExercises.run(workoutId);
    insertExercises(workoutId, workout.exercises);
  })();
  deleteUnusedImages(oldImages); // photos removed from exercises in this edit
  res.json(getWorkoutDetail(workoutId));
});

// Jira: FF-42 Delete workout
// DELETE /api/admin/workouts/:id – delete a workout, its exercises and (by cascade) its logs
router.delete('/:id', (req, res) => {
  const workoutId = Number(req.params.id);
  if (!getWorkoutDetail(workoutId)) return res.status(404).json({ error: 'Workout not found.' });
  const oldImages = getExerciseImages.all(workoutId).map((row) => row.ImagePath);
  deleteWorkout.run(workoutId);
  deleteUnusedImages(oldImages);
  res.status(204).end();
});

module.exports = router;
