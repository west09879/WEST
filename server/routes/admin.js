'use strict';
const express   = require('express');
const bcrypt    = require('bcryptjs');
const Joi       = require('joi');
const db        = require('../db');
const adminAuth = require('../middleware/adminAuth');
const validate  = require('../middleware/validate');
const emailService = require('../services/email.service');
const visitorService = require('../services/visitor.service');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(adminAuth);

// ── Validation schemas ───────────────────────────────────────────────────────
const gallerySchema = Joi.object({
  title:       Joi.string().min(1).required(),
  imageUrl:    Joi.string().uri().required(),
  description: Joi.string().allow('', null),
  category:    Joi.string().allow('', 'other'),
  price:       Joi.number().min(0).default(0)
});

const galleryUpdateSchema = Joi.object({
  title:       Joi.string().min(1).optional(),
  imageUrl:    Joi.string().uri().optional(),
  description: Joi.string().allow('', null).optional(),
  category:    Joi.string().optional(),
  price:       Joi.number().min(0).optional()
});

const orderStatusSchema = Joi.object({
  status: Joi.string().valid('pending','confirmed','preparing','ready','delivered','cancelled').required()
});

const adminUserSchema = Joi.object({
  username: Joi.string().min(3).required(),
  password: Joi.string().min(8).required()
});

const workerSchema = Joi.object({
  name:     Joi.string().min(2).required(),
  username: Joi.string().min(3).required(),
  password: Joi.string().min(8).required()
});

const workerUpdateSchema = Joi.object({
  name:     Joi.string().min(2).optional(),
  password: Joi.string().min(8).optional(),
  isActive: Joi.boolean().optional()
});

const passwordSchema = Joi.object({ password: Joi.string().min(8).required() });

// ── Multer configuration for file uploads ────────────────────────────────────
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')) });

// ── Dashboard stats ──────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [orders, customers, gallery] = await Promise.all([
      db.all('SELECT status, total FROM orders'),
      db.get('SELECT COUNT(*) AS cnt FROM customers WHERE isActive = 1'),
      db.get('SELECT COUNT(*) AS cnt FROM gallery')
    ]);

    const stats = {
      totalOrders:    orders.length,
      pending:        orders.filter(o => o.status === 'pending').length,
      preparing:      orders.filter(o => ['confirmed','in-progress','preparing'].includes(o.status)).length,
      ready:          orders.filter(o => o.status === 'ready').length,
      delivered:      orders.filter(o => o.status === 'delivered').length,
      cancelled:      orders.filter(o => o.status === 'cancelled').length,
      revenue:        orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
      totalCustomers: customers.cnt,
      galleryItems:   gallery.cnt
    };
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Orders ───────────────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    
    // Validate parameters
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Valid statuses: ' + validStatuses.join(', ') });
    }
    
    let sql    = 'SELECT * FROM orders';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, safeOffset);
    const rows = await db.all(sql, params);
    rows.forEach(r => { try { r.items = JSON.parse(r.items); } catch { r.items = []; } });
    
    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM orders';
    if (status) countSql += ' WHERE status = ?';
    const countRow = await db.get(countSql, status ? [status] : []);
    
    res.json({ orders: rows, total: countRow?.total || 0, limit: safeLimit, offset: safeOffset });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/orders/:id/status', validate(orderStatusSchema), async (req, res) => {
  try {
    const { status } = req.body;
    const info = await db.run(
      `UPDATE orders SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, req.params.id]
    );
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    const updated = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    updated.items = JSON.parse(updated.items);

    emailService.sendStatusUpdate(updated.email, updated, status).catch(() => {});

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    const info = await db.run('DELETE FROM orders WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Gallery ──────────────────────────────────────────────────────────────────
router.get('/gallery', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM gallery ORDER BY createdAt DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/gallery', validate(gallerySchema), async (req, res) => {
  try {
    const { title, imageUrl, description, category, price } = req.body;
    const info = await db.run(
      'INSERT INTO gallery (title, imageUrl, description, category, price) VALUES (?, ?, ?, ?, ?)',
      [title, imageUrl, description || null, category || 'other', price]
    );
    const created = await db.get('SELECT * FROM gallery WHERE id = ?', [info.lastID]);
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/gallery/:id', validate(galleryUpdateSchema), async (req, res) => {
  try {
    const { title, imageUrl, description, category, price } = req.body;
    const info = await db.run(
      `UPDATE gallery SET
         title       = COALESCE(?, title),
         imageUrl    = COALESCE(?, imageUrl),
         description = COALESCE(?, description),
         category    = COALESCE(?, category),
         price       = COALESCE(?, price)
       WHERE id = ?`,
      [title, imageUrl, description, category, price, req.params.id]
    );
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    const updated = await db.get('SELECT * FROM gallery WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/gallery/:id', async (req, res) => {
  try {
    const info = await db.run('DELETE FROM gallery WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Customers ────────────────────────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT id, name, email, phone, emailVerified, isActive, createdAt FROM customers ORDER BY createdAt DESC'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/customers/:id/active', async (req, res) => {
  try {
    const { isActive } = req.body;
    await db.run('UPDATE customers SET isActive = ? WHERE id = ?', [isActive ? 1 : 0, req.params.id]);
    const updated = await db.get('SELECT id, name, email, isActive FROM customers WHERE id = ?', [req.params.id]);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Workers ──────────────────────────────────────────────────────────────────
router.get('/workers', async (req, res) => {
  try {
    const rows = await db.all('SELECT id, name, username, isActive, createdAt FROM workers ORDER BY createdAt DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workers', validate(workerSchema), async (req, res) => {
  try {
    const { name, username, password } = req.body;
    const exists = await db.get('SELECT id FROM workers WHERE username = ?', [username]);
    if (exists) return res.status(409).json({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 10);
    const info = await db.run(
      'INSERT INTO workers (name, username, passwordHash) VALUES (?, ?, ?)',
      [name, username, hash]
    );
    const created = await db.get('SELECT id, name, username, isActive, createdAt FROM workers WHERE id = ?', [info.lastID]);
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/workers/:id', validate(workerUpdateSchema), async (req, res) => {
  try {
    const { name, password, isActive } = req.body;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await db.run('UPDATE workers SET passwordHash = ? WHERE id = ?', [hash, req.params.id]);
    }
    if (name !== undefined)     await db.run('UPDATE workers SET name = ? WHERE id = ?',     [name, req.params.id]);
    if (isActive !== undefined) await db.run('UPDATE workers SET isActive = ? WHERE id = ?', [isActive ? 1 : 0, req.params.id]);

    const updated = await db.get('SELECT id, name, username, isActive, createdAt FROM workers WHERE id = ?', [req.params.id]);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/workers/:id', async (req, res) => {
  try {
    const info = await db.run('DELETE FROM workers WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin users ──────────────────────────────────────────────────────────────
router.get('/admins', async (req, res) => {
  try {
    const rows = await db.all('SELECT id, username, createdAt FROM admins ORDER BY createdAt DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/admins', validate(adminUserSchema), async (req, res) => {
  try {
    const { username, password } = req.body;
    const exists = await db.get('SELECT id FROM admins WHERE username = ?', [username]);
    if (exists) return res.status(409).json({ error: 'Username already taken' });
    const hash = await bcrypt.hash(password, 10);
    const info = await db.run('INSERT INTO admins (username, passwordHash) VALUES (?, ?)', [username, hash]);
    const created = await db.get('SELECT id, username, createdAt FROM admins WHERE id = ?', [info.lastID]);
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/admins/:id/password', validate(passwordSchema), async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    const info = await db.run('UPDATE admins SET passwordHash = ? WHERE id = ?', [hash, req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/admins/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.admin?.id === id) return res.status(400).json({ error: 'Cannot delete yourself' });
    const info = await db.run('DELETE FROM admins WHERE id = ?', [id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Visitor Statistics Routes ───────────────────────────────────────────────
router.get('/visitors/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await visitorService.getVisitorStats(days);
    if (stats.success) {
      res.json(stats.data);
    } else {
      res.status(500).json({ error: stats.error });
    }
  } catch (e) {
    console.error('[admin] GET /visitors/stats error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/visitors/page-stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stats = await visitorService.getPageViewStats(days);
    if (stats.success) {
      res.json(stats.data);
    } else {
      res.status(500).json({ error: stats.error });
    }
  } catch (e) {
    console.error('[admin] GET /visitors/page-stats error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/visitors/unique', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stats = await visitorService.getUniqueVisitorsCount(days);
    if (stats.success) {
      res.json({ unique_visitors: stats.unique_visitors });
    } else {
      res.status(500).json({ error: stats.error });
    }
  } catch (e) {
    console.error('[admin] GET /visitors/unique error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/visitors/cleanup', async (req, res) => {
  try {
    const result = await visitorService.cleanupOldData();
    if (result.success) {
      res.json({ message: `Cleaned up ${result.deleted} old records` });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (e) {
    console.error('[admin] POST /visitors/cleanup error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ success: true, url });
});

module.exports = router;