const express = require('express');
const db = require('../db');
const validate = require('../middleware/validate');
const adminAuth = require('../middleware/adminAuth');
const Joi = require('joi');
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
const gallerySchema = Joi.object({
  title: Joi.string().min(1).required(),
  imageUrl: Joi.string().uri().required(),
  description: Joi.string().allow('', null),
  category: Joi.string().allow('','other'),
  price: Joi.number().min(0).default(0)
});

router.post('/', adminAuth, validate(gallerySchema), async (req, res) => {
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

module.exports = router; 
