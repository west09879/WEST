'use strict';

const path = require('path');
const { promisify } = require('util');

const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();
let run, get, all, exec, rawDb, pool;

// ─── MySQL ────────────────────────────────────────────────────────────────────
if (dbType === 'mysql') {
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'befo_bakers',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z'
  });

  const withConn = (fn) => async (sql, params = []) => {
    const conn = await pool.getConnection();
    try { return await fn(conn, sql, params); }
    finally { conn.release(); }
  };

  run = withConn(async (conn, sql, params) => {
    const [result] = await conn.execute(sql, params);
    return { lastID: result.insertId, changes: result.affectedRows };
  });

  get = withConn(async (conn, sql, params) => {
    const [rows] = await conn.execute(sql, params);
    return rows[0] ?? null;
  });

  all = withConn(async (conn, sql, params) => {
    const [rows] = await conn.execute(sql, params);
    return rows;
  });

  exec = async (sql) => {
    const conn = await pool.getConnection();
    try {
      for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
        await conn.execute(stmt);
      }
    } finally { conn.release(); }
  };

  rawDb = pool;

// ─── SQLite ───────────────────────────────────────────────────────────────────
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'data.db');
  rawDb = new sqlite3.Database(dbPath);

  // Enable WAL mode for better concurrency
  rawDb.run('PRAGMA journal_mode=WAL');
  rawDb.run('PRAGMA foreign_keys=ON');

  run = (sql, params = []) => new Promise((resolve, reject) => {
    rawDb.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

  get = promisify(rawDb.get.bind(rawDb));
  all = promisify(rawDb.all.bind(rawDb));
  exec = (sql) => new Promise((resolve, reject) =>
    rawDb.exec(sql, (err) => err ? reject(err) : resolve())
  );
}

// ─── Schema (portable SQL) ───────────────────────────────────────────────────
const SCHEMA = `
CREATE TABLE IF NOT EXISTS gallery (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  imageUrl    TEXT    NOT NULL,
  description TEXT,
  category    TEXT    DEFAULT 'other',
  price       REAL    DEFAULT 0,
  createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  phone         TEXT,
  passwordHash  TEXT    NOT NULL,
  emailVerified INTEGER DEFAULT 0,
  isActive      INTEGER DEFAULT 1,
  createdAt     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  tokenHash  TEXT    NOT NULL UNIQUE,
  expiresAt  DATETIME NOT NULL,
  revoked    INTEGER DEFAULT 0,
  createdAt  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId          INTEGER,
  customerName        TEXT    NOT NULL,
  email               TEXT    NOT NULL,
  phone               TEXT,
  items               TEXT    NOT NULL,
  total               REAL    NOT NULL,
  status              TEXT    DEFAULT 'pending',
  deliveryDate        TEXT,
  deliveryAddress     TEXT,
  specialInstructions TEXT,
  assignedTo          TEXT,
  createdAt           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt           DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT    NOT NULL UNIQUE,
  passwordHash TEXT    NOT NULL,
  createdAt    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  username     TEXT    NOT NULL UNIQUE,
  passwordHash TEXT    NOT NULL,
  isActive     INTEGER DEFAULT 1,
  createdAt    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  otpHash    TEXT    NOT NULL,
  attempts   INTEGER DEFAULT 0,
  verified   INTEGER DEFAULT 0,
  expiresAt  DATETIME NOT NULL,
  createdAt  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  email     TEXT    NOT NULL,
  tokenHash TEXT    NOT NULL,
  expiresAt DATETIME NOT NULL,
  used      INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  email     TEXT,
  ipAddress TEXT,
  success   INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visitors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ip          TEXT,
  user_agent  TEXT,
  referer     TEXT,
  page        TEXT,
  method      TEXT,
  session_id  TEXT,
  user_id     INTEGER,
  visited_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_stats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page        TEXT NOT NULL,
  date        DATE NOT NULL,
  views       INTEGER DEFAULT 0,
  UNIQUE(page, date)
);

CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  checkout_request_id  TEXT NOT NULL UNIQUE,
  merchant_request_id  TEXT,
  amount               REAL,
  phone_number         TEXT,
  order_id             INTEGER,
  status               TEXT DEFAULT 'pending',
  result_code          TEXT,
  result_desc          TEXT,
  mpesa_receipt        TEXT,
  transaction_date     TEXT,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS production_tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL,
  task_type    TEXT NOT NULL CHECK (task_type IN ('baking', 'design', 'delivery')),
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assigned_to  INTEGER,
  assigned_at  DATETIME,
  completed_at DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES workers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_request ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_order_id ON mpesa_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_visitors_visited_at ON visitors(visited_at);
CREATE INDEX IF NOT EXISTS idx_visitors_ip ON visitors(ip);
CREATE INDEX IF NOT EXISTS idx_visitors_page ON visitors(page);
CREATE INDEX IF NOT EXISTS idx_page_stats_date ON page_stats(date);
`;

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_orders_customerId   ON orders(customerId)',
  'CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status)',
  'CREATE INDEX IF NOT EXISTS idx_customers_email     ON customers(email)',
  'CREATE INDEX IF NOT EXISTS idx_ev_customerId       ON email_verifications(customerId)',
  'CREATE INDEX IF NOT EXISTS idx_ev_expires          ON email_verifications(expiresAt)',
  'CREATE INDEX IF NOT EXISTS idx_pr_email            ON password_resets(email)',
  'CREATE INDEX IF NOT EXISTS idx_pr_expires          ON password_resets(expiresAt)',
  'CREATE INDEX IF NOT EXISTS idx_la_email            ON login_attempts(email)',
  'CREATE INDEX IF NOT EXISTS idx_la_created          ON login_attempts(createdAt)',
  'CREATE INDEX IF NOT EXISTS idx_rt_customerId       ON refresh_tokens(customerId)',
  'CREATE INDEX IF NOT EXISTS idx_rt_tokenHash        ON refresh_tokens(tokenHash)',
  'CREATE INDEX IF NOT EXISTS idx_production_tasks_order_id ON production_tasks(order_id)',
  'CREATE INDEX IF NOT EXISTS idx_production_tasks_status ON production_tasks(status)',
  'CREATE INDEX IF NOT EXISTS idx_production_tasks_task_type ON production_tasks(task_type)',
  'CREATE INDEX IF NOT EXISTS idx_production_tasks_assigned_to ON production_tasks(assigned_to)'
];

// ─── Migration helpers ────────────────────────────────────────────────────────
const MIGRATIONS = [
  { table: 'orders', column: 'phone', def: 'TEXT' },
  { table: 'orders', column: 'deliveryDate', def: 'TEXT' },
  { table: 'orders', column: 'deliveryAddress', def: 'TEXT' },
  { table: 'orders', column: 'specialInstructions', def: 'TEXT' },
  { table: 'orders', column: 'updatedAt', def: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  { table: 'customers', column: 'isActive', def: 'INTEGER DEFAULT 1' },
  { table: 'customers', column: 'updatedAt', def: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  { table: 'email_verifications', column: 'otpHash', def: 'TEXT' }
];

async function runMigrations() {
  for (const { table, column, def } of MIGRATIONS) {
    try {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`, []);
    } catch (e) {
      // Column already exists — ignore
      if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) {
        console.warn(`Migration warning [${table}.${column}]:`, e.message);
      }
    }
  }
}

// ─── Init (with promise) ─────────────────────────────────────────────────────
let initPromise = null;

async function initialize() {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      // Create tables
      for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
        try {
          await run(stmt, []);
        } catch (e) {
          if (!e.message.includes('already exists')) {
            console.error('Schema error:', e.message);
          }
        }
      }

      // Create indexes
      for (const stmt of INDEXES) {
        try { await run(stmt, []); } catch (_) { /* ignore */ }
      }

      // Run column migrations
      await runMigrations();

      console.log('[db] Database initialized successfully');
      return true;
    } catch (e) {
      console.error('[db] Init error:', e.message);
      throw e;
    }
  })();
  
  return initPromise;
}

// Start initialization immediately but don't block exports
initialize().catch(err => {
  console.error('[db] Fatal init error:', err);
  process.exit(1);
});

module.exports = { run, get, all, exec, rawDb, initialize };