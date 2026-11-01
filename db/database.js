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

// Columns added after the first release. CREATE TABLE IF NOT EXISTS does not change tables that
// already exist, so older databases get the new columns here (standard ALTER TABLE ... ADD COLUMN).
const ADDED_COLUMNS = [
  { table: 'WorkoutExercise', column: 'ImagePath', definition: 'VARCHAR(255)' },
];
for (const { table, column, definition } of ADDED_COLUMNS) {
  const hasColumn = db.prepare(`PRAGMA table_info(${table})`).all().some((info) => info.name === column);
  if (!hasColumn) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

module.exports = db;
