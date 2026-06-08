import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbQuery, initDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serves our frontend UI

// ==========================================
// 1. DEVICES API
// ==========================================

// Get all devices along with their active session details
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await dbQuery.all(`
      SELECT 
        d.id, d.name, d.status, d.current_session_id,
        s.start_time, s.duration, s.price_rate, s.game_type, 
        s.mode, s.controller_count, s.pricing_method, s.matches_played, s.total_cost
      FROM devices d
      LEFT JOIN sessions s ON d.current_session_id = s.id
      ORDER BY d.id ASC
    `);
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. SESSIONS API (Instant Autosave)
// ==========================================

// Start a new session
app.post('/api/sessions/start', async (req, res) => {
  const { deviceId, gameType, mode, controllerCount, pricingMethod, priceRate, duration = 0 } = req.body;
  const startTime = new Date().toISOString();

  try {
    // 1. Create the session
    const insertResult = await dbQuery.run(`
      INSERT INTO sessions (device_id, start_time, duration, price_rate, game_type, mode, controller_count, pricing_method, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [deviceId, startTime, duration, priceRate, gameType, mode, controllerCount, pricingMethod]);
    
    const sessionId = insertResult.lastID;

    // 2. Update the device status
    await dbQuery.run(`
      UPDATE devices 
      SET status = 'active', current_session_id = ? 
      WHERE id = ?
    `, [sessionId, deviceId]);

    // 3. Log history
    await dbQuery.run(`
      INSERT INTO history (device_id, action, timestamp, details)
      VALUES (?, 'START_SESSION', ?, ?)
    `, [deviceId, startTime, `Started ${gameType} (${mode})`]);

    res.json({ success: true, sessionId, startTime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Autosave/Update an active session (e.g. extending time, adding matches, editing controllers)
app.post('/api/sessions/update', async (req, res) => {
  const { sessionId, matchesPlayed, totalCost, duration, controllerCount, priceRate } = req.body;
  try {
    await dbQuery.run(`
      UPDATE sessions 
      SET matches_played = ?, total_cost = ?, duration = ?, controller_count = ?, price_rate = ?
      WHERE id = ?
    `, [matchesPlayed, totalCost, duration, controllerCount, priceRate, sessionId]);
    
    res.json({ success: true, message: 'Autosaved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a session manually
app.post('/api/sessions/stop', async (req, res) => {
  const { sessionId, deviceId, totalCost, isDebt, customerName } = req.body;
  const endTime = new Date().toISOString();
  
  try {
    const finalStatus = isDebt ? 'unpaid' : 'completed';

    // 1. Mark session as finished
    await dbQuery.run(`
      UPDATE sessions 
      SET end_time = ?, status = ?, total_cost = ? 
      WHERE id = ?
    `, [endTime, finalStatus, totalCost, sessionId]);

    // 2. Free up the PS5 device
    await dbQuery.run(`
      UPDATE devices 
      SET status = 'available', current_session_id = NULL 
      WHERE id = ?
    `, [deviceId]);

    // 3. Handle money or debt
    if (isDebt) {
      await dbQuery.run(`
        INSERT INTO debts (session_id, customer_name, amount, created_at, status)
        VALUES (?, ?, ?, ?, 'unpaid')
      `, [sessionId, customerName, totalCost, endTime]);
    } else {
      await dbQuery.run(`
        INSERT INTO transactions (session_id, amount, created_at, worker_confirmed)
        VALUES (?, ?, ?, 1)
      `, [sessionId, totalCost, endTime]);
    }

    // 4. Log history
    await dbQuery.run(`
      INSERT INTO history (device_id, action, timestamp, details)
      VALUES (?, 'STOP_SESSION', ?, ?)
    `, [deviceId, endTime, `Session ${sessionId} stopped. Cost: ${totalCost} DA`]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record a finished match session directly (paid or debt) without active tracking
app.post('/api/sessions/record-finished', async (req, res) => {
  const { deviceId, gameType, mode, controllerCount, pricingMethod, priceRate, duration, totalCost, isDebt, customerName } = req.body;
  const startTime = new Date().toISOString();
  const endTime = startTime;
  const status = isDebt ? 'unpaid' : 'completed';

  try {
    // 1. Insert session immediately as completed or unpaid
    const result = await dbQuery.run(`
      INSERT INTO sessions (
        device_id, start_time, end_time, duration, price_rate, 
        game_type, mode, controller_count, pricing_method, 
        matches_played, total_cost, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      deviceId, startTime, endTime, duration, priceRate,
      gameType, mode, controllerCount, pricingMethod,
      duration, totalCost, status
    ]);

    const sessionId = result.lastID;

    // 2. Handle money or debt
    if (isDebt) {
      await dbQuery.run(`
        INSERT INTO debts (session_id, customer_name, amount, created_at, status)
        VALUES (?, ?, ?, ?, 'unpaid')
      `, [sessionId, customerName, totalCost, endTime]);
    } else {
      await dbQuery.run(`
        INSERT INTO transactions (session_id, amount, created_at, worker_confirmed)
        VALUES (?, ?, ?, 1)
      `, [sessionId, totalCost, endTime]);
    }

    // 3. Log history
    await dbQuery.run(`
      INSERT INTO history (device_id, action, timestamp, details)
      VALUES (?, 'RECORD_FINISHED_MATCH', ?, ?)
    `, [deviceId, endTime, `Recorded finished match: ${gameType} (${mode}), ${duration} matches, Cost: ${totalCost} DA`]);

    res.json({ success: true, sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get money stats and transactions list
app.get('/api/money/stats', async (req, res) => {
  try {
    // 1. Total paid revenue (sum of transactions)
    const paidSum = await dbQuery.get(`
      SELECT SUM(amount) as total FROM transactions
    `);
    const totalPaid = paidSum.total || 0;

    // 2. Shift's paid revenue (sum of transactions without 12AM reset)
    const todayPaidSum = await dbQuery.get(`
      SELECT SUM(amount) as total FROM transactions
    `);
    const todayPaid = todayPaidSum.total || 0;

    // 3. Shift's pending debts (sum of unpaid debts without 12AM reset)
    const todayDebtsSum = await dbQuery.get(`
      SELECT SUM(amount) as total FROM debts 
      WHERE status = 'unpaid'
    `);
    const todayDebts = todayDebtsSum.total || 0;

    // 4. Transaction list with game and device names
    const transactions = await dbQuery.all(`
      SELECT t.id, t.session_id, t.amount, t.created_at, s.game_type, s.pricing_method, d.name as device_name
      FROM transactions t
      LEFT JOIN sessions s ON t.session_id = s.id
      LEFT JOIN devices d ON s.device_id = d.id
      ORDER BY t.created_at DESC
      LIMIT 50
    `);

    // 5. Game breakdown (revenue per game)
    const gameBreakdown = await dbQuery.all(`
      SELECT s.game_type, SUM(t.amount) as revenue, COUNT(t.id) as count
      FROM transactions t
      JOIN sessions s ON t.session_id = s.id
      GROUP BY s.game_type
      ORDER BY revenue DESC
    `);

    res.json({
      totalPaid,
      todayPaid,
      todayDebts,
      transactions,
      gameBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recently closed sessions
app.get('/api/sessions/closed', async (req, res) => {
  try {
    const sessions = await dbQuery.all(`
      SELECT 
        s.id, s.device_id, s.start_time, s.end_time, s.duration, 
        s.price_rate, s.game_type, s.mode, s.controller_count, 
        s.pricing_method, s.matches_played, s.total_cost, s.status,
        d.name as device_name
      FROM sessions s
      LEFT JOIN devices d ON s.device_id = d.id
      WHERE s.status IN ('completed', 'unpaid')
      ORDER BY s.end_time DESC
      LIMIT 20
    `);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel an active session completely without billing
app.post('/api/sessions/cancel', async (req, res) => {
  const { sessionId, deviceId } = req.body;
  try {
    // 1. Delete from sessions
    await dbQuery.run(`DELETE FROM sessions WHERE id = ?`, [sessionId]);

    // 2. Free up the device
    await dbQuery.run(`
      UPDATE devices 
      SET status = 'available', current_session_id = NULL 
      WHERE id = ?
    `, [deviceId]);

    // 3. Log history
    await dbQuery.run(`
      INSERT INTO history (device_id, action, timestamp, details)
      VALUES (?, 'CANCEL_SESSION', ?, ?)
    `, [deviceId, new Date().toISOString(), `Active session ${sessionId} cancelled.`]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a single play session / transaction / debt
app.post('/api/sessions/delete', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Missing sessionId' });
  }

  try {
    // 1. Delete from transactions
    await dbQuery.run(`DELETE FROM transactions WHERE session_id = ?`, [sessionId]);

    // 2. Delete from debts
    await dbQuery.run(`DELETE FROM debts WHERE session_id = ?`, [sessionId]);

    // 3. Delete from sessions
    await dbQuery.run(`DELETE FROM sessions WHERE id = ?`, [sessionId]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all matches history
app.post('/api/sessions/clear-matches', async (req, res) => {
  try {
    const matchSessions = await dbQuery.all(`SELECT id FROM sessions WHERE pricing_method = 'match'`);
    const sessionIds = matchSessions.map(s => s.id);
    
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map(() => '?').join(',');
      await dbQuery.run(`DELETE FROM transactions WHERE session_id IN (${placeholders})`, sessionIds);
      await dbQuery.run(`DELETE FROM debts WHERE session_id IN (${placeholders})`, sessionIds);
      await dbQuery.run(`DELETE FROM sessions WHERE id IN (${placeholders})`, sessionIds);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all timer history
app.post('/api/sessions/clear-timers', async (req, res) => {
  try {
    const timeSessions = await dbQuery.all(`SELECT id FROM sessions WHERE pricing_method = 'time'`);
    const sessionIds = timeSessions.map(s => s.id);
    
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map(() => '?').join(',');
      await dbQuery.run(`DELETE FROM transactions WHERE session_id IN (${placeholders})`, sessionIds);
      await dbQuery.run(`DELETE FROM debts WHERE session_id IN (${placeholders})`, sessionIds);
      await dbQuery.run(`DELETE FROM sessions WHERE id IN (${placeholders})`, sessionIds);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all financial transaction history (Money Tab Ledger)
app.post('/api/money/clear-ledger', async (req, res) => {
  try {
    await dbQuery.run(`DELETE FROM transactions`);
    await dbQuery.run(`DELETE FROM sessions WHERE status = 'completed'`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear paid debts log history (Debts Tab bottom ledger)
app.post('/api/debts/clear-paid-history', async (req, res) => {
  try {
    await dbQuery.run(`DELETE FROM debts WHERE status = 'paid'`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all transaction logs across all dates
app.get('/api/history/all', async (req, res) => {
  try {
    const transactions = await dbQuery.all(`
      SELECT t.id, t.session_id, t.amount, t.created_at, s.game_type, s.pricing_method, d.name as device_name, s.duration
      FROM transactions t
      LEFT JOIN sessions s ON t.session_id = s.id
      LEFT JOIN devices d ON s.device_id = d.id
      ORDER BY t.created_at DESC
    `);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename a device/console label
app.post('/api/devices/rename', async (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) {
    return res.status(400).json({ success: false, error: 'Missing id or name' });
  }
  try {
    await dbQuery.run(`UPDATE devices SET name = ? WHERE id = ?`, [name, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset entire system records (destructive new shift startup)
app.post('/api/system/reset', async (req, res) => {
  try {
    await dbQuery.run(`DELETE FROM transactions`);
    await dbQuery.run(`DELETE FROM debts`);
    await dbQuery.run(`DELETE FROM sessions`);
    await dbQuery.run(`DELETE FROM history`);
    await dbQuery.run(`UPDATE devices SET status = 'available', current_session_id = NULL`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DEBTS API
// ==========================================

// Get all debts
app.get('/api/debts', async (req, res) => {
  try {
    const debts = await dbQuery.all(`
      SELECT 
        debts.id, debts.session_id, debts.customer_name, debts.amount, debts.created_at, debts.status,
        sessions.game_type, sessions.mode, sessions.pricing_method, sessions.duration, sessions.device_id,
        devices.name as device_name
      FROM debts
      JOIN sessions ON debts.session_id = sessions.id
      JOIN devices ON sessions.device_id = devices.id
      ORDER BY debts.status DESC, debts.created_at DESC
    `);
    res.json(debts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear a debt (mark as paid)
app.post('/api/debts/clear', async (req, res) => {
  const { debtId, sessionId, amount, deviceId, customerName } = req.body;
  if (!debtId || !sessionId || !amount) {
    return res.status(400).json({ success: false, error: 'Missing debtId, sessionId, or amount' });
  }

  try {
    // 1. Update the debt status to 'paid'
    await dbQuery.run(`UPDATE debts SET status = 'paid' WHERE id = ?`, [debtId]);

    // 2. Update the session status to 'completed'
    await dbQuery.run(`UPDATE sessions SET status = 'completed' WHERE id = ?`, [sessionId]);

    // 3. Insert transaction log so it goes into the cash drawer
    await dbQuery.run(`
      INSERT INTO transactions (session_id, amount, created_at, payment_method, worker_confirmed)
      VALUES (?, ?, ?, 'cash', 1)
    `, [sessionId, amount, new Date().toISOString()]);

    // 4. Log the audit history
    await dbQuery.run(`
      INSERT INTO history (device_id, action, timestamp, details)
      VALUES (?, ?, ?, ?)
    `, [deviceId || 1, 'CLEAR_DEBT', new Date().toISOString(), `Debt of ${amount} DA cleared for customer ${customerName || 'N/A'}`]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. SETTINGS & PRICING API
// ==========================================

// Get pricing rules and app settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await dbQuery.all(`SELECT key, value FROM settings`);
    // Convert to a nice JSON object key-value map
    const config = {};
    settings.forEach(s => {
      try {
        config[s.key] = JSON.parse(s.value);
      } catch (e) {
        config[s.key] = s.value;
      }
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gracefully terminate backend server processes programmatically
app.post('/api/system/shutdown', (req, res) => {
  res.json({ success: true, message: "System server shutting down gracefully..." });
  setTimeout(() => {
    process.exit(0);
  }, 800);
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Game Room Backend Server running offline at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Database initialization failed:", err);
});
