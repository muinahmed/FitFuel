// Workouts & Progress component – Priyanka Pant
// Tests for the workouts admin.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { db, signedUpAgent, adminAgent } = require('./helpers');

// A valid workout body; change parts with overrides
function newWorkout(overrides = {}) {
  return {
    workoutName: 'Admin Test Stretch',
    goal: 'stay healthy',
    difficulty: 'easy',
    durationMinutes: 12,
    isBeginnerFriendly: true,
    exercises: [
      { exerciseName: 'Neck Rolls', sets: 2, reps: 10, instructions: 'Roll your head slowly in a circle.', mediaUrl: 'https://example.com/neck' },
      { exerciseName: 'Shoulder Shrugs', sets: 2, reps: 15, instructions: '', mediaUrl: '' },
    ],
    ...overrides,
  };
}

describe('Workouts admin', () => {
  test('adds a workout with exercises', async () => {
    const admin = await adminAgent();
    const { body: created } = await admin.post('/api/admin/workouts').send(newWorkout()).expect(201);
    assert.equal(created.workoutName, 'Admin Test Stretch');
    assert.equal(created.isBeginnerFriendly, true);
    assert.equal(created.exercises.length, 2);
    assert.equal(created.exercises[0].mediaUrl, 'https://example.com/neck');
    assert.equal(created.exercises[1].mediaUrl, null);
    assert.equal(created.exercises[1].instructions, null);
  });

  test('rejects invalid workouts, including unsafe video links', async () => {
    const admin = await adminAgent();
    const exercise = { exerciseName: 'Squats', sets: 3, reps: 10, instructions: '', mediaUrl: '' };
    const bad = [
      { workoutName: '' },
      { goal: 'get famous' },
      { difficulty: 'extreme' },
      { durationMinutes: 0 },
      { durationMinutes: 12.5 },
      { isBeginnerFriendly: 'yes' },
      { exercises: [] },
      { exercises: [{ ...exercise, exerciseName: '' }] },
      { exercises: [{ ...exercise, sets: 0 }] },
      { exercises: [{ ...exercise, reps: 'lots' }] },
      { exercises: [{ ...exercise, mediaUrl: 'javascript:alert(1)' }] },
      { exercises: [{ ...exercise, mediaUrl: 'not a link' }] },
    ];
    for (const overrides of bad) {
      const res = await admin.post('/api/admin/workouts').send(newWorkout(overrides));
      assert.equal(res.status, 400, JSON.stringify(overrides));
    }
  });

  test('edits a workout, replacing its exercises', async () => {
    const admin = await adminAgent();
    const { body: created } = await admin.post('/api/admin/workouts').send(newWorkout()).expect(201);
    const { body: edited } = await admin.put(`/api/admin/workouts/${created.workoutId}`).send(newWorkout({
      workoutName: 'Edited Stretch',
      difficulty: 'medium',
      isBeginnerFriendly: false,
      exercises: [{ exerciseName: 'Side Bends', sets: 3, reps: 12, instructions: 'Bend to each side.', mediaUrl: '' }],
    })).expect(200);

    assert.equal(edited.workoutName, 'Edited Stretch');
    assert.equal(edited.difficulty, 'medium');
    assert.equal(edited.isBeginnerFriendly, false);
    assert.deepEqual(edited.exercises.map((exercise) => exercise.exerciseName), ['Side Bends']);
    await admin.put('/api/admin/workouts/99999').send(newWorkout()).expect(404);
  });

  test('deletes a workout with its exercises and logs', async () => {
    const admin = await adminAgent();
    const { body: created } = await admin.post('/api/admin/workouts').send(newWorkout()).expect(201);
    const { agent: student } = await signedUpAgent();
    await student.post(`/api/workouts/${created.workoutId}/log`).expect(201);

    await admin.delete(`/api/admin/workouts/${created.workoutId}`).expect(204);
    await admin.get(`/api/admin/workouts/${created.workoutId}`).expect(404);
    for (const table of ['WorkoutExercise', 'WorkoutLog']) {
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE WorkoutID = ?`).get(created.workoutId).n, 0, table);
    }
  });

  test('filters by goal, difficulty and beginner-friendly', async () => {
    const admin = await adminAgent();
    const { body } = await admin.get('/api/admin/workouts?goal=lose weight&difficulty=easy&beginner=true').expect(200);
    assert.ok(body.length > 0);
    for (const workout of body) {
      assert.deepEqual([workout.goal, workout.difficulty, workout.isBeginnerFriendly], ['lose weight', 'easy', true]);
      assert.ok(workout.exerciseCount > 0);
    }
    const notBeginner = await admin.get('/api/admin/workouts?beginner=false').expect(200);
    assert.ok(notBeginner.body.every((workout) => workout.isBeginnerFriendly === false));
    await admin.get('/api/admin/workouts?difficulty=extreme').expect(400);
  });

  test('activity counts completed WorkoutLog rows per workout, most logged first', async () => {
    const admin = await adminAgent();
    const { body: activity } = await admin.get('/api/admin/workouts/activity').expect(200);
    assert.equal(activity.length, db.prepare('SELECT COUNT(*) AS n FROM Workouts').get().n);
    const counts = activity.map((row) => row.timesLogged);
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
    for (const row of activity) {
      const expected = db.prepare('SELECT COUNT(*) AS n FROM WorkoutLog WHERE WorkoutID = ? AND IsCompleted = 1').get(row.workoutId).n;
      assert.equal(row.timesLogged, expected, row.workoutName);
    }
    assert.ok(counts[0] > 0, 'demo data has logged workouts');
  });
});
