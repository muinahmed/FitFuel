// FitFuel web server – Express app shared by all three components.
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');

// Load settings from .env when the file exists (Node's built-in loader)
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // No .env file – fall back to defaults below
}

const db = require('./db/database');
const { requireLoginPage } = require('./middleware/requireLogin');

const app = express();

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn('SESSION_SECRET is not set (copy .env.example to .env). Using a random secret: logins reset on restart.');
}

app.use(express.json());
app.use(session({
  name: 'fitfuel.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// ---------- API routes ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/mealplans', require('./routes/mealplans'));

// Unknown API paths get a JSON error instead of an HTML page
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------- Pages ----------
// Student pages need a login; logged-out visitors are sent to the login page.
// (The pages hold no private data – the API routes are what really protect it.)
const STUDENT_PAGES = ['/home.html', '/profile.html', '/recipes.html', '/mealplan.html', '/shopping.html',
  '/workouts.html', '/progress.html', '/favourites.html'];
app.use(STUDENT_PAGES, requireLoginPage);
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Errors ----------
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

module.exports = app;

// `npm start` runs this file directly
if (require.main === module) {
  // First start on an empty database: fill it with demo data
  if (db.prepare('SELECT COUNT(*) AS count FROM Admins').get().count === 0) {
    require('./db/seed').seedDatabase(db);
    console.log('New database detected - demo data added (run `npm run seed` to reset it).');
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`FitFuel is running at http://localhost:${port}`));
}
