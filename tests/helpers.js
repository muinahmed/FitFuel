// Test setup shared by all test files: a fresh in-memory database with demo data.
// Each test file runs in its own process, so each gets its own database.
process.env.DB_PATH = ':memory:';
process.env.SESSION_SECRET = 'test-secret';
// Uploaded photos go to a temporary folder, never into public/uploads
process.env.UPLOAD_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'fitfuel-uploads-'));

const request = require('supertest');
const db = require('../db/database');
const { seedDatabase } = require('../db/seed');

seedDatabase(db);
const app = require('../server');

let emailCounter = 0;

// A unique, valid sign-up body
function newStudent(overrides = {}) {
  emailCounter += 1;
  return {
    fullName: 'Test Student',
    email: `student${emailCounter}@test.dk`,
    password: 'Password1!',
    confirmPassword: 'Password1!',
    ...overrides,
  };
}

// Sign up a new student and return a logged-in supertest agent plus the sign-up details
async function signedUpAgent(overrides = {}) {
  const agent = request.agent(app);
  const student = newStudent(overrides);
  await agent.post('/api/auth/signup').send(student).expect(201);
  return { agent, student };
}

// A supertest agent logged in as the seeded admin
async function adminAgent() {
  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({ username: 'admin', password: 'Admin123!' }).expect(200);
  return agent;
}

module.exports = { app, db, request, newStudent, signedUpAgent, adminAgent };
