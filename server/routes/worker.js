const express = require('express');
const db = require('../db');
const workerAuth = require('../middleware/workerAuth');
const router = express.Router();

// All worker routes protected by simple token
router.use(workerAuth);

// List orders for workers
router.get('/orders', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM orders ORDER BY createdAt DESC');
        rows.forEach(r => { try { r.items = JSON.parse(r.items); } catch (e) { r.items = []; } });
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Claim an order (assign to worker)
router.put('/orders/:id/claim', async (req, res) => {
    try {
        const worker = req.body.worker || req.headers['x-worker-name'] || 'worker';
        const info = await db.run('UPDATE orders SET status = ?, assignedTo = ? WHERE id = ?', ['in-progress', worker, req.params.id]);
        if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
        const updated = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        updated.items = JSON.parse(updated.items);
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update order status (e.g., completed)
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
