const express = require('express');
const db = require('../db');
const router = express.Router();

// List gallery items
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM gallery ORDER BY createdAt DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single item
router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM gallery WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create new gallery item (admin only)
router.post('/', async (req, res) => {
  try {
    const { title, imageUrl, description, category, price } = req.body;
    if (!title || !imageUrl) return res.status(400).json({ error: 'title and imageUrl required' });
    const info = await db.run('INSERT INTO gallery (title, imageUrl, description, category, price) VALUES (?, ?, ?, ?, ?)', [title, imageUrl, description || null, category || 'other', price || 0]);
    const created = await db.get('SELECT * FROM gallery WHERE id = ?', [info.lastID]);
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router; 
