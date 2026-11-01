// Workouts & Progress component – Priyanka Pant
// Tests for the workout plan, exercise instructions, logging and history (FF-16, FF-17, FF-18).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, signedUpAgent } = require('./helpers');
const { today } = require('../utils/dates');

// A logged-in student with a goal and (optionally) training days
async function studentWith(goal, trainingDays) {
  const { agent, student } = await signedUpAgent();
  await agent.put('/api/users/me/profile').send({ goal, dietType: 'none' }).expect(200);
  if (trainingDays) await agent.put('/api/workouts/plan').send({ trainingDays }).expect(200);
  return { agent, student };
}

// Pretend "now" is the given local date and time (only Date is faked)
const pretendNow = (t, ...dateParts) => t.mock.timers.enable({ apis: ['Date'], now: new Date(...dateParts) });

describe('Workout plan (FF-16)', () => {
  test('needs a login', async () => {
    await request(app).get('/api/workouts/plan').expect(401);
  });

  test('is empty until the student has chosen training days', async () => {
    const { agent } = await studentWith('build muscle');
    const res = await agent.get('/api/workouts/plan').expect(200);
    assert.equal(res.body.trainingDays, null);
    assert.deepEqual(res.body.sessions, []);
  });

  test('training days must be 2 to 5 and are saved in UserProfile', async () => {
    const { agent, student } = await studentWith('build muscle');
    for (const trainingDays of [1, 6, 2.5, 'lots', true, null]) {
      await agent.put('/api/workouts/plan').send({ trainingDays }).expect(400);
    }
    await agent.put('/api/workouts/plan').send({ trainingDays: 4 }).expect(200);
    const row = db.prepare('SELECT p.TrainingDays FROM UserProfile p JOIN Users u ON u.UserID = p.UserID WHERE u.Email = ?').get(student.email);
    assert.equal(row.TrainingDays, 4);
  });

  test('suggests one workout per training day matching the goal, beginner-friendly first', async () => {
    const { agent } = await studentWith('lose weight', 3);
    const { body } = await agent.get('/api/workouts/plan').expect(200);

    assert.deepEqual(body.sessions.map((session) => session.day), ['Monday', 'Wednesday', 'Friday']);
    for (const session of body.sessions) assert.equal(session.workout.goal, 'lose weight');
    assert.equal(body.sessions[0].workout.isBeginnerFriendly, true);

    const beginnerFlags = body.sessions.map((session) => session.workout.isBeginnerFriendly);
    assert.deepEqual(beginnerFlags, [...beginnerFlags].sort((a, b) => b - a), 'beginner-friendly workouts come first');
  });

  test('more training days than workouts cycles through them again', async () => {
    const { agent } = await studentWith('stay healthy', 5);
    const { body } = await agent.get('/api/workouts/plan').expect(200);
    const ids = body.sessions.map((session) => session.workout.workoutId);
    assert.equal(ids.length, 5);
    assert.deepEqual(ids.slice(3), ids.slice(0, 2));
  });

  test('changing the goal changes the suggested workouts', async () => {
    const { agent } = await studentWith('lose weight', 2);
    await agent.put('/api/users/me/profile').send({ goal: 'build muscle', dietType: 'none' }).expect(200);
    const { body } = await agent.get('/api/workouts/plan').expect(200);
    for (const session of body.sessions) assert.equal(session.workout.goal, 'build muscle');
  });
});

describe('Exercise instructions (FF-18)', () => {
  test('each workout shows exercises with sets, reps, instructions and a video link', async () => {
    const { agent } = await studentWith('build muscle', 3);
    const { body } = await agent.get('/api/workouts/plan').expect(200);
    for (const { workout } of body.sessions) {
      assert.ok(workout.exercises.length >= 4);
      for (const exercise of workout.exercises) {
        assert.ok(exercise.exerciseName);
        assert.ok(Number.isInteger(exercise.sets) && exercise.sets > 0);
        assert.ok(Number.isInteger(exercise.reps) && exercise.reps > 0);
        assert.ok(exercise.instructions.length > 10);
        assert.match(exercise.mediaUrl, /^https:\/\//);
      }
    }
  });
});

describe('Log a workout (FF-17)', () => {
  test('marking a workout done saves a completed WorkoutLog row for today and shows it in history', async () => {
    const { agent, student } = await studentWith('lose weight', 3);
    const { body: plan } = await agent.get('/api/workouts/plan').expect(200);
    const { workoutId } = plan.sessions[0].workout;

    const res = await agent.post(`/api/workouts/${workoutId}/log`).expect(201);
    assert.equal(res.body.logDate, today());

    const row = db.prepare(`SELECT l.LogDate, l.IsCompleted FROM WorkoutLog l JOIN Users u ON u.UserID = l.UserID
                            WHERE u.Email = ? AND l.WorkoutID = ?`).get(student.email, workoutId);
    assert.deepEqual({ ...row }, { LogDate: today(), IsCompleted: 1 });

    const history = await agent.get('/api/workouts/history').expect(200);
    assert.equal(history.body[0].workoutId, workoutId);
    assert.equal(history.body[0].logDate, today());
  });

  test('the same workout cannot be logged twice on one day', async () => {
    const { agent } = await studentWith('lose weight', 2);
    const { body: plan } = await agent.get('/api/workouts/plan').expect(200);
    const { workoutId } = plan.sessions[0].workout;
    await agent.post(`/api/workouts/${workoutId}/log`).expect(201);
    await agent.post(`/api/workouts/${workoutId}/log`).expect(409);
  });

  test('unknown workouts give 404', async () => {
    const { agent } = await studentWith('lose weight', 2);
    await agent.post('/api/workouts/99999/log').expect(404);
    await agent.post('/api/workouts/abc/log').expect(404);
  });

  test('history only shows the student\'s own workouts', async () => {
    const { agent } = await studentWith('lose weight', 2);
    const res = await agent.get('/api/workouts/history').expect(200);
    assert.deepEqual(res.body, []);
  });

  test('a logged session is marked done and the next workout moves on', async (t) => {
    pretendNow(t, 2026, 10, 4, 9); // Wednesday 4 November 2026
    const { agent } = await studentWith('lose weight', 3); // Monday, Wednesday, Friday

    let { body: plan } = await agent.get('/api/workouts/plan').expect(200);
    assert.equal(plan.nextSession.day, 'Wednesday');
    assert.equal(plan.nextSession.isToday, true);

    const wednesday = plan.sessions[1];
    await agent.post(`/api/workouts/${wednesday.workout.workoutId}/log`).expect(201);

    ({ body: plan } = await agent.get('/api/workouts/plan').expect(200));
    assert.equal(plan.sessions[1].isDone, true);
    assert.equal(plan.sessions[0].isDone, false, 'Monday was not logged');
    assert.equal(plan.nextSession.day, 'Friday');
    assert.equal(plan.nextSession.date, '2026-11-06');
  });

  test('after the last session of the week, the next workout is next week\'s first', async (t) => {
    pretendNow(t, 2026, 10, 7, 9); // Saturday 7 November 2026
    const { agent } = await studentWith('stay healthy', 2); // Monday, Thursday
    const { body: plan } = await agent.get('/api/workouts/plan').expect(200);
    assert.equal(plan.nextSession.day, 'Monday');
    assert.equal(plan.nextSession.date, '2026-11-09');
  });
});
