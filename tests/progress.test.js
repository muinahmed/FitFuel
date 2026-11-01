// Workouts & Progress component – Priyanka Pant
// Tests for the weight log and the workouts-per-week chart data (FF-19, FF-20).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, signedUpAgent } = require('./helpers');
const { daysAgo, weekStart, addDays, parseDateString } = require('../utils/dates');

describe('Log weight (FF-19)', () => {
  test('needs a login', async () => {
    await request(app).get('/api/progress/weights').expect(401);
  });

  test('adds entries with a date and lists them oldest first', async () => {
    const { agent } = await signedUpAgent();
    await agent.post('/api/progress/weights').send({ weightKg: 70.5, logDate: daysAgo(0) }).expect(201);
    const res = await agent.post('/api/progress/weights').send({ weightKg: '71.25', logDate: daysAgo(7) }).expect(201);
    assert.equal(res.body.weightKg, 71.25);

    const list = await agent.get('/api/progress/weights').expect(200);
    assert.deepEqual(list.body.map((entry) => entry.logDate), [daysAgo(7), daysAgo(0)]);
  });

  test('rejects invalid weights and dates', async () => {
    const { agent } = await signedUpAgent();
    const bad = [
      { weightKg: -5, logDate: daysAgo(0) },
      { weightKg: 0, logDate: daysAgo(0) },
      { weightKg: 1000, logDate: daysAgo(0) },
      { weightKg: 'heavy', logDate: daysAgo(0) },
      { weightKg: '', logDate: daysAgo(0) },
      { weightKg: 70, logDate: '2026-02-30' },
      { weightKg: 70, logDate: 'yesterday' },
      { weightKg: 70, logDate: daysAgo(-1) }, // tomorrow
    ];
    for (const entry of bad) await agent.post('/api/progress/weights').send(entry).expect(400);
  });

  test('one entry per date', async () => {
    const { agent } = await signedUpAgent();
    await agent.post('/api/progress/weights').send({ weightKg: 70, logDate: daysAgo(1) }).expect(201);
    await agent.post('/api/progress/weights').send({ weightKg: 71, logDate: daysAgo(1) }).expect(409);
  });

  test('edits an entry', async () => {
    const { agent } = await signedUpAgent();
    const { body: entry } = await agent.post('/api/progress/weights').send({ weightKg: 70, logDate: daysAgo(3) }).expect(201);

    // Keeping the same date is fine; moving onto another entry's date is not
    await agent.put(`/api/progress/weights/${entry.weightLogId}`).send({ weightKg: 69.4, logDate: daysAgo(3) }).expect(200);
    await agent.post('/api/progress/weights').send({ weightKg: 70, logDate: daysAgo(10) }).expect(201);
    await agent.put(`/api/progress/weights/${entry.weightLogId}`).send({ weightKg: 69.4, logDate: daysAgo(10) }).expect(409);

    const list = await agent.get('/api/progress/weights').expect(200);
    assert.equal(list.body.find((row) => row.weightLogId === entry.weightLogId).weightKg, 69.4);
  });

  test('deletes an entry', async () => {
    const { agent } = await signedUpAgent();
    const { body: entry } = await agent.post('/api/progress/weights').send({ weightKg: 70, logDate: daysAgo(2) }).expect(201);
    await agent.delete(`/api/progress/weights/${entry.weightLogId}`).expect(204);
    const list = await agent.get('/api/progress/weights').expect(200);
    assert.deepEqual(list.body, []);
  });

  test("cannot edit or delete another student's entries", async () => {
    const { agent: owner } = await signedUpAgent();
    const { body: entry } = await owner.post('/api/progress/weights').send({ weightKg: 70, logDate: daysAgo(2) }).expect(201);

    const { agent: other } = await signedUpAgent();
    await other.put(`/api/progress/weights/${entry.weightLogId}`).send({ weightKg: 50, logDate: daysAgo(2) }).expect(404);
    await other.delete(`/api/progress/weights/${entry.weightLogId}`).expect(404);
    assert.equal(db.prepare('SELECT WeightKg FROM WeightLog WHERE WeightLogID = ?').get(entry.weightLogId).WeightKg, 70);
  });
});

describe('Progress chart data (FF-20)', () => {
  test('workouts per week: the last 8 weeks, oldest first, counted from WorkoutLog', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'emma@example.com', password: 'Student123!' }).expect(200);
    const { body: weeks } = await agent.get('/api/progress/workouts-per-week').expect(200);

    assert.equal(weeks.length, 8);
    assert.equal(weeks[7].weekStart, weekStart());
    assert.equal(weeks[0].weekStart, addDays(weekStart(), -49));

    // Same counts worked out directly from the database
    const userId = db.prepare("SELECT UserID FROM Users WHERE Email = 'emma@example.com'").get().UserID;
    const expected = new Map(weeks.map((week) => [week.weekStart, 0]));
    for (const { LogDate } of db.prepare('SELECT LogDate FROM WorkoutLog WHERE UserID = ? AND IsCompleted = 1').all(userId)) {
      const monday = weekStart(parseDateString(LogDate));
      if (expected.has(monday)) expected.set(monday, expected.get(monday) + 1);
    }
    assert.deepEqual(weeks.map((week) => week.count), [...expected.values()]);
    assert.ok(weeks.some((week) => week.count > 0), 'demo data has workouts');
  });

  test('a new student gets 8 weeks of zero', async () => {
    const { agent } = await signedUpAgent();
    const { body: weeks } = await agent.get('/api/progress/workouts-per-week').expect(200);
    assert.deepEqual(weeks.map((week) => week.count), [0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
