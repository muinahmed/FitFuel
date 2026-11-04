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
const { requireAdminPage } = require('./middleware/requireAdmin');
const { UPLOAD_DIR } = require('./utils/uploads');

const app = express();

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn('SESSION_SECRET is not set (copy .env.example to .env). Using a random secret: logins reset on restart.');
}

// Hosts like Render put a proxy in front of the app; trust it so HTTPS is detected correctly
app.set('trust proxy', 1);

app.use(express.json());
// Express 5 leaves req.body undefined when there is no JSON body; routes expect an object
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.use(session({
  name: 'fitfuel.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  // secure: 'auto' sends the cookie over HTTPS only when the site is on HTTPS (Render), plain HTTP works locally
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// ---------- API routes ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/mealplans', require('./routes/mealplans'));
app.use('/api/workouts', require('./routes/workouts'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/admin/auth', require('./routes/admin/auth'));
app.use('/api/admin/users', require('./routes/admin/users'));
app.use('/api/admin/recipes', require('./routes/admin/recipes'));
app.use('/api/admin/workouts', require('./routes/admin/workouts'));
app.use('/api/admin/uploads', require('./routes/admin/uploads'));

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
// Admin pages need an admin login (students are sent to the admin login page too)
const ADMIN_PAGES = ['/admin/dashboard.html', '/admin/users.html', '/admin/recipes.html', '/admin/workouts.html'];
app.use(ADMIN_PAGES, requireAdminPage);
app.get(['/admin', '/admin/'], (req, res) => res.redirect('/admin/dashboard.html'));
app.use('/uploads', express.static(UPLOAD_DIR)); // uploaded recipe and exercise photos
app.use(express.static(path.join(__dirname, 'public')));

// Any other address: a friendly "page not found" page
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ---------- Errors ----------
app.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The image is too big. Choose one under 2 MB.' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

module.exports = app;

// `npm start` runs this file directly
if (require.main === module) {
  // The tables already exist (db/database.js creates them). A brand-new database also gets demo data.
  if (require('./db/seed').seedIfEmpty(db)) {
    console.log('New database detected - demo data added (run `npm run seed` to reset it).');
  }
  require('./db/seed').ensureAdditionalRecipes(db);
  require('./db/seed').ensureAdditionalWorkouts(db);

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`FitFuel is running at http://localhost:${port}`));
}
