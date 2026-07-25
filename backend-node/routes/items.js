const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Get all items (with images and container name)
router.get('/', auth, async (req, res) => {
  try {
    const { container_id } = req.query;
    let query = `
      SELECT i.*, c.name as container_name,
        COALESCE(
          (SELECT json_agg(image_path ORDER BY sort_order)
           FROM item_images WHERE item_id = i.id),
          '[]'::json
        ) as images
      FROM items i
      LEFT JOIN containers c ON i.container_id = c.id
      WHERE i.user_id = $1`;
    const params = [req.userId];

    if (container_id) {
      query += ' AND i.container_id = $2';
      params.push(container_id);
    }

    query += ' ORDER BY i.created_at DESC';
    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single item
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM items WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const images = await pool.query(
      'SELECT * FROM item_images WHERE item_id = $1 ORDER BY sort_order',
      [req.params.id]
    );

    res.json({ data: { ...result.rows[0], images: images.rows } });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create item
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, container_id, color, category } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(
      'INSERT INTO items (user_id, name, description, container_id, color, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.userId, name, description || null, container_id || null, color || null, category || null]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update item
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, container_id, color, category } = req.body;

    const result = await pool.query(
      `UPDATE items SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        container_id = $3,
        color = COALESCE($4, color),
        category = COALESCE($5, category)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, description, container_id, color, category, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Batch create items
router.post('/batch', auth, async (req, res) => {
  const { items, container_id } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array required' });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: 'Max 50 items per batch' });
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const { name, color, category } = items[i];
    const cid = items[i].container_id || container_id;

    if (!name || !name.trim()) {
      errors.push({ index: i, error: 'Name required' });
      continue;
    }

    try {
      const result = await pool.query(
        'INSERT INTO items (user_id, name, container_id, color, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.userId, name.trim(), cid || null, color || null, category || null]
      );
      results.push(result.rows[0]);
    } catch (err) {
      errors.push({ index: i, error: err.message });
    }
  }

  res.json({ data: results, errors });
});

// Delete item
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM items WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
