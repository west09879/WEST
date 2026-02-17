const express = require('express');
const db = require('../db');
const bcrypt = require('bcryptjs');
const adminAuth = require('../middleware/adminAuth');
const router = express.Router();

// All admin routes use Basic auth
router.use(adminAuth);

// List gallery (admin)
router.get('/gallery', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM gallery ORDER BY createdAt DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create gallery item
router.post('/gallery', async (req, res) => {
  try {
    const { title, imageUrl, description, category, price } = req.body;
    if (!title || !imageUrl) return res.status(400).json({ error: 'title and imageUrl required' });
    const info = await db.run('INSERT INTO gallery (title, imageUrl, description, category, price) VALUES (?, ?, ?, ?, ?)', [title, imageUrl, description || null, category || 'other', price || 0]);
    const created = await db.get('SELECT * FROM gallery WHERE id = ?', [info.lastID]);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update gallery item
router.put('/gallery/:id', async (req, res) => {
  try {
    const { title, imageUrl, description, category, price } = req.body;
    const info = await db.run('UPDATE gallery SET title = COALESCE(?, title), imageUrl = COALESCE(?, imageUrl), description = COALESCE(?, description), category = COALESCE(?, category), price = COALESCE(?, price) WHERE id = ?', [title, imageUrl, description, category, price, req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    const updated = await db.get('SELECT * FROM gallery WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete gallery item
router.delete('/gallery/:id', async (req, res) => {
  try {
    const info = await db.run('DELETE FROM gallery WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List orders
router.get('/orders', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM orders ORDER BY createdAt DESC');
    rows.forEach(r => r.items = JSON.parse(r.items));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update order status
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    const info = await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    const updated = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    updated.items = JSON.parse(updated.items);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// Admin users management
// NOTE: all routes above already use `router.use(adminAuth)` so these are protected
router.get('/admins', async (req, res) => {
  try {
    const rows = await db.all('SELECT id, username, createdAt FROM admins ORDER BY createdAt DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admins', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const exists = await db.get('SELECT id FROM admins WHERE username = ?', [username]);
    if (exists) return res.status(409).json({ error: 'username already exists' });
    const hash = await bcrypt.hash(password, 10);
    const info = await db.run('INSERT INTO admins (username, passwordHash) VALUES (?, ?)', [username, hash]);
    const created = await db.get('SELECT id, username, createdAt FROM admins WHERE id = ?', [info.lastID]);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/admins/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'password required' });
    // Prevent non-admins, but router is protected already. Prevent deleting/changing root only if desired.
    const hash = await bcrypt.hash(password, 10);
    const info = await db.run('UPDATE admins SET passwordHash = ? WHERE id = ?', [hash, req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/admins/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    // Do not allow deleting yourself
    if (req.admin && req.admin.id === id) return res.status(400).json({ error: 'Cannot delete yourself' });
    const info = await db.run('DELETE FROM admins WHERE id = ?', [id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
