'use strict';
const express    = require('express');
const bcrypt     = require('bcryptjs');
const Joi        = require('joi');
const db         = require('../db');
const workerAuth = require('../middleware/workerAuth');
const adminAuth  = require('../middleware/adminAuth');
const validate   = require('../middleware/validate');
const emailService = require('../services/email.service');

const router = express.Router();

// All worker order routes are protected
router.use(workerAuth);

// ── List all orders (assigned to worker or unassigned) ──────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const workerName = req.workerName || req.body?.worker || 'worker';
    // Filter: show orders assigned to this worker OR unassigned orders
    const rows = await db.all(
      'SELECT * FROM orders WHERE assignedTo = ? OR assignedTo IS NULL ORDER BY createdAt DESC',
      [workerName]
    );
    rows.forEach(r => { try { r.items = JSON.parse(r.items); } catch { r.items = []; } });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Claim an order ───────────────────────────────────────────────────────────
router.put('/orders/:id/claim', async (req, res) => {
  try {
    const workerName = req.workerName || req.body?.worker || 'worker';

    // Only claim pending/confirmed orders that are unassigned
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be claimed at this stage' });
    }
    if (order.assignedTo && order.assignedTo !== workerName) {
      return res.status(409).json({ error: 'Order already claimed by another worker' });
    }

    await db.run(
      `UPDATE orders SET status = 'in-progress', assignedTo = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [workerName, req.params.id]
    );
    const updated = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    updated.items = JSON.parse(updated.items);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Update order status ──────────────────────────────────────────────────────
const workerStatusSchema = Joi.object({
  status: Joi.string().valid('preparing', 'ready', 'delivered', 'cancelled').required()
});

router.put('/orders/:id/status', validate(workerStatusSchema), async (req, res) => {
  try {
    const workerName = req.workerName || req.body?.worker || 'worker';
    const { status } = req.body;
    
    // Verify order is assigned to this worker
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.assignedTo !== workerName && order.assignedTo !== null) {
      return res.status(403).json({ error: 'You can only update orders assigned to you' });
    }
    
    const info = await db.run(
      `UPDATE orders SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, req.params.id]
    );
    if (info.changes === 0) return res.status(404).json({ error: 'Order not found' });

    const updated = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    updated.items = JSON.parse(updated.items);

    // Notify customer by email
    emailService.sendStatusUpdate(updated.email, updated, status).catch(() => {});

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
