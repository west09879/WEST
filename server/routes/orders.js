const express = require('express');
const db = require('../db');
const router = express.Router();

// Create order
router.post('/', async (req, res) => {
  try {
    const { customerName, email, items, total } = req.body;
    if (!customerName || !email || !items) return res.status(400).json({ error: 'Missing fields' });
    // ensure items is an array
    const itemsArr = Array.isArray(items) ? items : JSON.parse(items || '[]');
    // compute total server-side if not provided or zero
    let computedTotal = typeof total === 'number' ? total : null;
    if (computedTotal === null || computedTotal === 0) {
      computedTotal = itemsArr.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 1)), 0);
    }
    const info = await db.run('INSERT INTO orders (customerName, email, items, total) VALUES (?, ?, ?, ?)', [customerName, email, JSON.stringify(itemsArr), computedTotal]);
    const created = await db.get('SELECT * FROM orders WHERE id = ?', [info.lastID]);
    created.items = JSON.parse(created.items);
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single order
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    row.items = JSON.parse(row.items);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router; 
