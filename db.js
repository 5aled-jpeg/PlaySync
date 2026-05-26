import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback to __dirname if USER_DATA_PATH is not provided (e.g., direct node execution)
const userDataPath = process.env.USER_DATA_PATH || __dirname;
const dbPath = path.resolve(userDataPath, 'gameroom.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to the database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Convert sqlite3 callbacks to Promises for clean async/await syntax
export const dbQuery = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

export async function initDatabase() {
  console.log('Initializing database tables...');

  // 1. Devices Table
  await dbQuery.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      current_session_id INTEGER
    )
  `);

  // 2. Sessions Table
  await dbQuery.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration INTEGER DEFAULT 0, -- in minutes
      price_rate REAL NOT NULL,
      game_type TEXT NOT NULL,
      mode TEXT NOT NULL,
      controller_count INTEGER NOT NULL,
      pricing_method TEXT NOT NULL, -- 'match' or 'time'
      matches_played INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      debt_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active' -- 'active', 'completed', 'unpaid'
    )
  `);

  // 3. Transactions Table
  await dbQuery.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      worker_confirmed INTEGER NOT NULL DEFAULT 1 -- 0 = pending, 1 = confirmed
    )
  `);

  // 4. Debts Table
  await dbQuery.run(`
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid' -- 'unpaid', 'paid'
    )
  `);

  // 5. History Table
  await dbQuery.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER,
      action TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      details TEXT
    )
  `);

  // 6. Settings Table
  await dbQuery.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    )
  `);

  // Seeding 11 PS5 devices
  for (let i = 1; i <= 11; i++) {
    await dbQuery.run(`
      INSERT OR IGNORE INTO devices (id, name, status, current_session_id)
      VALUES (?, ?, 'available', NULL)
    `, [i, `PS5 Console ${i}`]);
  }

  // Seeding Default Pricing & Game Configuration
  const defaultPricing = [
    { game: 'FIFA', mode: '2 players', type: 'match', rate: 100, controllers: 2 },
    { game: 'FIFA', mode: '4 players', type: 'match', rate: 200, controllers: 4 },
    { game: 'PES', mode: '2 players', type: 'match', rate: 100, controllers: 2 },
    { game: 'PES', mode: '4 players', type: 'match', rate: 200, controllers: 4 },
    { game: 'GTA', mode: '1 player', type: 'time', rate: 100, step_minutes: 20, controllers: 1 },
    { game: 'MK', mode: '1-2 players', type: 'time', rate: 100, step_minutes: 20, controllers: 2 },
    { game: 'Tekken', mode: '1-2 players', type: 'time', rate: 100, step_minutes: 20, controllers: 2 }
  ];

  await dbQuery.run(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?)
  `, ['pricing_rules', JSON.stringify(defaultPricing)]);

  console.log('Database initialized successfully with 10 PS5 devices and settings seeded.');
}

// Automatically run initialization if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initDatabase().catch(err => console.error('Database init error:', err));
}
