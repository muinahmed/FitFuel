// Shared database connection used by every component.
// Opens the SQLite file (or DB_PATH, e.g. ':memory:' in tests) and makes sure all tables exist.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'fitfuel.db');
const db = new Database(dbPath);

// SQLite only enforces foreign keys (and ON DELETE CASCADE) when this is on
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;
