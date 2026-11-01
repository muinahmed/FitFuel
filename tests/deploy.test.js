// Tests for running on a host that starts from an empty disk every time (e.g. Render free plan).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { app, request, newStudent } = require('./helpers');
const { seedIfEmpty } = require('../db/seed');

// A brand-new database with only the tables, as db/database.js creates on start-up
function freshDatabase() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  return db;
}

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

describe('Start-up on an empty database', () => {
  test('a brand-new database is seeded with the demo data', () => {
    const db = freshDatabase();
    assert.equal(seedIfEmpty(db), true);
    assert.equal(count(db, 'Admins'), 1);
    assert.equal(count(db, 'Users'), 3);
    assert.ok(count(db, 'Recipes') >= 24);
    assert.equal(count(db, 'Workouts'), 9);
  });

  test('a database that already has data is never reseeded or wiped', () => {
    const db = freshDatabase();
    seedIfEmpty(db);
    db.prepare("INSERT INTO Users (FullName, Email, PasswordHash) VALUES ('Kept User', 'kept@test.dk', 'x')").run();
    assert.equal(seedIfEmpty(db), false);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM Users WHERE Email = 'kept@test.dk'").get().n, 1);
  });

  test('a database with only a student account (no admin) is not reseeded', () => {
    const db = freshDatabase();
    db.prepare("INSERT INTO Users (FullName, Email, PasswordHash) VALUES ('Only User', 'only@test.dk', 'x')").run();
    assert.equal(seedIfEmpty(db), false);
    assert.equal(count(db, 'Users'), 1);
  });
});

describe('Login cookie behind an HTTPS proxy', () => {
  test('the cookie is Secure when the site is reached over HTTPS, and works over plain HTTP locally', async () => {
    const overHttps = await request(app).post('/api/auth/signup').set('X-Forwarded-Proto', 'https').send(newStudent()).expect(201);
    assert.match(overHttps.headers['set-cookie'][0], /;\s*Secure/i);

    const overHttp = await request(app).post('/api/auth/signup').send(newStudent()).expect(201);
    assert.doesNotMatch(overHttp.headers['set-cookie'][0], /;\s*Secure/i);
    assert.match(overHttp.headers['set-cookie'][0], /HttpOnly/i);
  });
});
