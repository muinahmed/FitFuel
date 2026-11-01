// Accounts component – Muin Ahmed
// Tests for sign up, log in / log out and page protection (FF-7, FF-8, FF-11).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, newStudent, signedUpAgent } = require('./helpers');
const { today } = require('../utils/dates');

describe('Sign up (FF-7)', () => {
  test('creates an account with a hashed password, active, joined today', async () => {
    const agent = request.agent(app);
    const student = newStudent();
    const res = await agent.post('/api/auth/signup').send(student).expect(201);

    assert.equal(res.body.email, student.email);
    assert.ok(!JSON.stringify(res.body).includes('PasswordHash'));

    const row = db.prepare('SELECT * FROM Users WHERE Email = ?').get(student.email);
    assert.notEqual(row.PasswordHash, student.password);
    assert.match(row.PasswordHash, /^\$2b\$10\$/);
    assert.equal(row.IsActive, 1);
    assert.equal(row.DateJoined, today());
    assert.ok(db.prepare('SELECT 1 FROM UserProfile WHERE UserID = ?').get(row.UserID), 'profile row created');

    // The new student is logged in straight away
    await agent.get('/api/users/me').expect(200);
  });

  test('all fields are required', async () => {
    for (const field of ['fullName', 'email', 'password']) {
      const res = await request(app).post('/api/auth/signup').send(newStudent({ [field]: '' })).expect(400);
      assert.ok(res.body.error);
    }
  });

  test('rejects an invalid email format', async () => {
    const res = await request(app).post('/api/auth/signup').send(newStudent({ email: 'not-an-email' })).expect(400);
    assert.equal(res.body.error, 'Please enter a valid email address.');
  });

  test('rejects an email that is already in use (any letter case)', async () => {
    const { student } = await signedUpAgent();
    const res = await request(app).post('/api/auth/signup')
      .send(newStudent({ email: student.email.toUpperCase() })).expect(409);
    assert.equal(res.body.error, 'This email is already in use');
  });

  test('password must be at least 8 characters', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send(newStudent({ password: 'short', confirmPassword: 'short' })).expect(400);
    assert.equal(res.body.error, 'Password must be at least 8 characters.');
  });

  test('passwords must match', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send(newStudent({ confirmPassword: 'Different1!' })).expect(400);
    assert.equal(res.body.error, 'Passwords do not match.');
  });
});

describe('Log in and log out (FF-8)', () => {
  test('correct email and password logs in', async () => {
    const { student } = await signedUpAgent();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: student.email, password: student.password }).expect(200);
    await agent.get('/api/users/me').expect(200);
  });

  test('wrong password and unknown email give the same message', async () => {
    const { student } = await signedUpAgent();
    const wrongPassword = await request(app).post('/api/auth/login')
      .send({ email: student.email, password: 'WrongPassword!' }).expect(401);
    const unknownEmail = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@test.dk', password: student.password }).expect(401);

    assert.equal(wrongPassword.body.error, 'Incorrect email or password');
    assert.equal(unknownEmail.body.error, 'Incorrect email or password');
  });

  test('a deactivated account cannot log in', async () => {
    const { student } = await signedUpAgent();
    db.prepare('UPDATE Users SET IsActive = 0 WHERE Email = ?').run(student.email);

    const res = await request(app).post('/api/auth/login')
      .send({ email: student.email, password: student.password }).expect(403);
    assert.equal(res.body.error, 'Your account has been deactivated. Please contact support.');
  });

  test('a student deactivated while logged in loses access', async () => {
    const { agent, student } = await signedUpAgent();
    db.prepare('UPDATE Users SET IsActive = 0 WHERE Email = ?').run(student.email);
    await agent.get('/api/users/me').expect(401);
  });

  test('log out ends the session', async () => {
    const { agent } = await signedUpAgent();
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/users/me').expect(401);
  });

  test('demo student from the seed data can log in', async () => {
    await request(app).post('/api/auth/login')
      .send({ email: 'emma@example.com', password: 'Student123!' }).expect(200);
  });
});

describe('Page protection (FF-11)', () => {
  test('logged-out visitors are redirected from student pages to login', async () => {
    for (const page of ['/home.html', '/profile.html', '/mealplan.html']) {
      const res = await request(app).get(page).expect(302);
      assert.equal(res.headers.location, '/login.html');
    }
  });

  test('logged-in students can open student pages', async () => {
    const { agent } = await signedUpAgent();
    await agent.get('/home.html').expect(200);
  });

  test('public pages are open to everyone', async () => {
    for (const page of ['/', '/index.html', '/login.html', '/signup.html']) {
      await request(app).get(page).expect(200);
    }
  });

  test('student API needs a login', async () => {
    await request(app).get('/api/users/me').expect(401);
  });
});
