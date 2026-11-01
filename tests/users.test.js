// Accounts component – Muin Ahmed
// Tests for goal and diet, weekly budget, account details and password (FF-9, FF-10, edit profile).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, signedUpAgent } = require('./helpers');

describe('Own account', () => {
  test('GET /me returns the account and never the password hash', async () => {
    const { agent, student } = await signedUpAgent();
    const res = await agent.get('/api/users/me').expect(200);

    assert.equal(res.body.fullName, student.fullName);
    assert.equal(res.body.email, student.email);
    assert.equal(res.body.weeklyBudget, 0);
    assert.equal(res.body.dietType, 'none');
    assert.ok(!JSON.stringify(res.body).includes('$2b$'));
    assert.ok(!('passwordHash' in res.body) && !('PasswordHash' in res.body));
  });
});

describe('Goal and diet type (FF-9)', () => {
  test('saves goal and diet in UserProfile', async () => {
    const { agent, student } = await signedUpAgent();
    const res = await agent.put('/api/users/me/profile').send({ goal: 'build muscle', dietType: 'halal' }).expect(200);
    assert.equal(res.body.goal, 'build muscle');

    const row = db.prepare(`SELECT p.Goal, p.DietType FROM UserProfile p JOIN Users u ON u.UserID = p.UserID
                            WHERE u.Email = ?`).get(student.email);
    assert.deepEqual({ ...row }, { Goal: 'build muscle', DietType: 'halal' });
  });

  test('rejects unknown goals and diets', async () => {
    const { agent } = await signedUpAgent();
    await agent.put('/api/users/me/profile').send({ goal: 'get famous', dietType: 'none' }).expect(400);
    await agent.put('/api/users/me/profile').send({ goal: 'stay healthy', dietType: 'keto' }).expect(400);
  });
});

describe('Weekly food budget (FF-10)', () => {
  test('saves a positive budget in Users.WeeklyBudget and can be changed later', async () => {
    const { agent, student } = await signedUpAgent();
    await agent.put('/api/users/me/budget').send({ weeklyBudget: 350 }).expect(200);
    const res = await agent.put('/api/users/me/budget').send({ weeklyBudget: '425.50' }).expect(200);
    assert.equal(res.body.weeklyBudget, 425.5);

    const row = db.prepare('SELECT WeeklyBudget FROM Users WHERE Email = ?').get(student.email);
    assert.equal(row.WeeklyBudget, 425.5);
  });

  test('rejects zero, negative, missing and non-numeric budgets', async () => {
    const { agent } = await signedUpAgent();
    for (const weeklyBudget of [0, -50, '', 'lots', null, true, 10000]) {
      await agent.put('/api/users/me/budget').send({ weeklyBudget }).expect(400);
    }
  });
});

describe('Edit profile and change password', () => {
  test('changes name and email', async () => {
    const { agent } = await signedUpAgent();
    const res = await agent.put('/api/users/me/details')
      .send({ fullName: 'New Name', email: 'New.Address@Test.dk' }).expect(200);
    assert.equal(res.body.fullName, 'New Name');
    assert.equal(res.body.email, 'new.address@test.dk');
  });

  test('cannot take another student\'s email', async () => {
    const { student: other } = await signedUpAgent();
    const { agent } = await signedUpAgent();
    const res = await agent.put('/api/users/me/details').send({ fullName: 'Me', email: other.email }).expect(409);
    assert.equal(res.body.error, 'This email is already in use');
  });

  test('keeping your own email is fine', async () => {
    const { agent, student } = await signedUpAgent();
    await agent.put('/api/users/me/details').send({ fullName: 'Renamed', email: student.email }).expect(200);
  });

  test('rejects empty name and invalid email', async () => {
    const { agent, student } = await signedUpAgent();
    await agent.put('/api/users/me/details').send({ fullName: '', email: student.email }).expect(400);
    await agent.put('/api/users/me/details').send({ fullName: 'Name', email: 'bad@' }).expect(400);
  });

  test('changing password requires the current password', async () => {
    const { agent, student } = await signedUpAgent();
    const res = await agent.put('/api/users/me/password')
      .send({ currentPassword: 'WrongPassword!', newPassword: 'NewPassword1!', confirmPassword: 'NewPassword1!' })
      .expect(400);
    assert.equal(res.body.error, 'Your current password is incorrect.');

    await agent.put('/api/users/me/password')
      .send({ currentPassword: student.password, newPassword: 'NewPassword1!', confirmPassword: 'NewPassword1!' })
      .expect(200);

    // Old password no longer works, new one does
    await request(app).post('/api/auth/login').send({ email: student.email, password: student.password }).expect(401);
    await request(app).post('/api/auth/login').send({ email: student.email, password: 'NewPassword1!' }).expect(200);
  });

  test('new password must be valid', async () => {
    const { agent, student } = await signedUpAgent();
    await agent.put('/api/users/me/password')
      .send({ currentPassword: student.password, newPassword: 'short', confirmPassword: 'short' }).expect(400);
    await agent.put('/api/users/me/password')
      .send({ currentPassword: student.password, newPassword: 'NewPassword1!', confirmPassword: 'Other1234!' }).expect(400);
  });
});

describe('Request errors', () => {
  test('invalid JSON gives a 400 JSON error', async () => {
    const res = await request(app).post('/api/auth/login')
      .set('Content-Type', 'application/json').send('{not json').expect(400);
    assert.ok(res.body.error);
  });

  test('unknown API paths give a 404 JSON error', async () => {
    const res = await request(app).get('/api/nothing-here').expect(404);
    assert.equal(res.body.error, 'Not found');
  });
});
