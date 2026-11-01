// Accounts component – Muin Ahmed
// Tests for admin login, admin-only access and the users admin.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, signedUpAgent, adminAgent } = require('./helpers');
const { weekStart } = require('../utils/dates');

const userIdFor = (email) => db.prepare('SELECT UserID FROM Users WHERE Email = ?').get(email).UserID;

describe('Admin login and protection', () => {
  test('correct username and password logs in; wrong details give one message', async () => {
    await adminAgent();
    const wrong = await request(app).post('/api/admin/auth/login').send({ username: 'admin', password: 'nope1234' }).expect(401);
    const unknown = await request(app).post('/api/admin/auth/login').send({ username: 'nobody', password: 'Admin123!' }).expect(401);
    assert.equal(wrong.body.error, 'Incorrect username or password');
    assert.equal(unknown.body.error, 'Incorrect username or password');
  });

  test('student accounts cannot log in as admin', async () => {
    await request(app).post('/api/admin/auth/login').send({ username: 'emma@example.com', password: 'Student123!' }).expect(401);
  });

  test('every admin API needs an admin login – logged-out visitors and students are refused', async () => {
    const { agent: student } = await signedUpAgent();
    const paths = ['/api/admin/users', '/api/admin/users/stats', '/api/admin/recipes', '/api/admin/recipes/usage',
      '/api/admin/workouts', '/api/admin/workouts/activity', '/api/admin/auth/me'];
    for (const path of paths) {
      await request(app).get(path).expect(401);
      await student.get(path).expect(401);
    }
    await student.delete(`/api/admin/users/${userIdFor('ali@example.com')}`).expect(401);
    assert.ok(db.prepare("SELECT 1 FROM Users WHERE Email = 'ali@example.com'").get(), 'student could not delete a user');
  });

  test('admin pages redirect logged-out visitors and students to the admin login', async () => {
    const { agent: student } = await signedUpAgent();
    for (const page of ['/admin/dashboard.html', '/admin/users.html', '/admin/recipes.html', '/admin/workouts.html']) {
      const anonymous = await request(app).get(page).expect(302);
      assert.equal(anonymous.headers.location, '/admin/login.html');
      const asStudent = await student.get(page).expect(302);
      assert.equal(asStudent.headers.location, '/admin/login.html');
    }
    await request(app).get('/admin/login.html').expect(200);
  });

  test('a logged-in admin can open admin pages and log out', async () => {
    const admin = await adminAgent();
    await admin.get('/admin/dashboard.html').expect(200);
    const me = await admin.get('/api/admin/auth/me').expect(200);
    assert.equal(me.body.username, 'admin');
    await admin.post('/api/admin/auth/logout').expect(200);
    await admin.get('/api/admin/users').expect(401);
  });
});

describe('Users admin', () => {
  test('lists all users without passwords', async () => {
    const admin = await adminAgent();
    const res = await admin.get('/api/admin/users').expect(200);
    assert.equal(res.body.length, db.prepare('SELECT COUNT(*) AS n FROM Users').get().n);
    assert.ok(!JSON.stringify(res.body).includes('$2b$'));
    assert.ok(res.body.every((user) => !('passwordHash' in user) && typeof user.isActive === 'boolean'));
  });

  test('sorts by name or date joined', async () => {
    const admin = await adminAgent();
    const byName = (await admin.get('/api/admin/users?sort=name').expect(200)).body.map((user) => user.fullName.toLowerCase());
    assert.deepEqual(byName, [...byName].sort());
    const byNameDesc = (await admin.get('/api/admin/users?sort=name&order=desc').expect(200)).body.map((user) => user.fullName.toLowerCase());
    assert.deepEqual(byNameDesc, [...byName].reverse());
    const byDate = (await admin.get('/api/admin/users?sort=dateJoined').expect(200)).body.map((user) => user.dateJoined);
    assert.deepEqual(byDate, [...byDate].sort());
    await admin.get('/api/admin/users?sort=PasswordHash').expect(400);
  });

  test('searches by name or email', async () => {
    const admin = await adminAgent();
    const byName = await admin.get('/api/admin/users?search=SOFIE').expect(200);
    assert.deepEqual(byName.body.map((user) => user.email), ['sofie@example.com']);
    const byEmail = await admin.get('/api/admin/users?search=ali@').expect(200);
    assert.deepEqual(byEmail.body.map((user) => user.fullName), ['Ali Hassan']);
  });

  test('edits name, email and budget', async () => {
    const admin = await adminAgent();
    const { student } = await signedUpAgent();
    const userId = userIdFor(student.email);

    const res = await admin.put(`/api/admin/users/${userId}`)
      .send({ fullName: 'Edited Name', email: 'Edited@Test.dk', weeklyBudget: 380 }).expect(200);
    assert.deepEqual([res.body.fullName, res.body.email, res.body.weeklyBudget], ['Edited Name', 'edited@test.dk', 380]);

    await admin.put(`/api/admin/users/${userId}`).send({ fullName: 'X', email: 'emma@example.com', weeklyBudget: 300 }).expect(409);
    await admin.put(`/api/admin/users/${userId}`).send({ fullName: '', email: 'ok@test.dk', weeklyBudget: 300 }).expect(400);
    await admin.put(`/api/admin/users/${userId}`).send({ fullName: 'X', email: 'ok@test.dk', weeklyBudget: -1 }).expect(400);
    await admin.put('/api/admin/users/99999').send({ fullName: 'X', email: 'ok@test.dk', weeklyBudget: 1 }).expect(404);
  });

  test('cannot change passwords', async () => {
    const admin = await adminAgent();
    const { student } = await signedUpAgent();
    const userId = userIdFor(student.email);
    const before = db.prepare('SELECT PasswordHash FROM Users WHERE UserID = ?').get(userId).PasswordHash;
    await admin.put(`/api/admin/users/${userId}`)
      .send({ fullName: 'Name', email: student.email, weeklyBudget: 100, password: 'Hacked123!', passwordHash: 'x' }).expect(200);
    assert.equal(db.prepare('SELECT PasswordHash FROM Users WHERE UserID = ?').get(userId).PasswordHash, before);
  });

  test('deactivating stops the student logging in; reactivating lets them back in', async () => {
    const admin = await adminAgent();
    const { agent: studentAgent, student } = await signedUpAgent();
    const userId = userIdFor(student.email);

    const off = await admin.put(`/api/admin/users/${userId}/status`).send({ isActive: false }).expect(200);
    assert.equal(off.body.isActive, false);
    await studentAgent.get('/api/users/me').expect(401); // logged out straight away
    await request(app).post('/api/auth/login').send({ email: student.email, password: student.password }).expect(403);

    await admin.put(`/api/admin/users/${userId}/status`).send({ isActive: true }).expect(200);
    await request(app).post('/api/auth/login').send({ email: student.email, password: student.password }).expect(200);

    await admin.put(`/api/admin/users/${userId}/status`).send({ isActive: 'no' }).expect(400);
  });

  test('deleting a user also deletes their related records', async () => {
    const admin = await adminAgent();
    const { agent: studentAgent, student } = await signedUpAgent();
    await studentAgent.put('/api/users/me/budget').send({ weeklyBudget: 400 }).expect(200);
    await studentAgent.post('/api/mealplans/generate?week=this').expect(201);
    await studentAgent.post('/api/progress/weights').send({ weightKg: 70, logDate: '2026-01-05' }).expect(201);
    const userId = userIdFor(student.email);

    await admin.delete(`/api/admin/users/${userId}`).expect(204);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Users WHERE UserID = ?').get(userId).n, 0);
    for (const table of ['UserProfile', 'MealPlanEntry', 'WeightLog']) {
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE UserID = ?`).get(userId).n, 0, table);
    }
    await admin.delete(`/api/admin/users/${userId}`).expect(404);
  });

  test('statistics: total, active, inactive and new sign-ups per week', async () => {
    const admin = await adminAgent();
    const { body: stats } = await admin.get('/api/admin/users/stats').expect(200);

    const counts = db.prepare('SELECT COUNT(*) AS total, SUM(IsActive) AS active FROM Users').get();
    assert.equal(stats.total, counts.total);
    assert.equal(stats.active, counts.active);
    assert.equal(stats.inactive, counts.total - counts.active);

    assert.equal(stats.signupsPerWeek.length, 8);
    const thisWeek = stats.signupsPerWeek[7];
    assert.equal(thisWeek.weekStart, weekStart());
    assert.equal(thisWeek.count, db.prepare('SELECT COUNT(*) AS n FROM Users WHERE DateJoined >= ?').get(weekStart()).n);
  });
});
