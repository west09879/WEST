const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');
const dbFile = path.join(__dirname, 'data.db');
const rawDb = new sqlite3.Database(dbFile);

// Promisified helpers
const run = (...args) => new Promise((resolve, reject) => {
  rawDb.run(...args, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});
const get = promisify(rawDb.get.bind(rawDb));
const all = promisify(rawDb.all.bind(rawDb));
const exec = promisify(rawDb.exec.bind(rawDb));

// Initialize tables
const initSql = `
CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  imageUrl TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  price REAL DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerName TEXT NOT NULL,
  email TEXT NOT NULL,
  items TEXT NOT NULL, -- JSON string
  total REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

(async () => {
  try {
    await exec(initSql);
    // Attempt to add columns for older DBs, ignore errors
    try { await run("ALTER TABLE gallery ADD COLUMN category TEXT DEFAULT 'other'"); } catch (e) { }
    try { await run("ALTER TABLE gallery ADD COLUMN price REAL DEFAULT 0"); } catch (e) { }
    try { await run("ALTER TABLE orders ADD COLUMN assignedTo TEXT DEFAULT NULL"); } catch (e) { }
  } catch (e) {
    console.error('DB init error:', e);
  }
})();

module.exports = { run, get, all, exec, rawDb };
