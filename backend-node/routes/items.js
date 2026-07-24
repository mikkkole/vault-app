const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Get all items
router.get('/', auth, async (req, res) => {
  try {
    const { container_id } = req.query;
    let query = 'SELECT * FROM items WHERE user_id = $1';
    const params = [req.userId];

    if (container_id) {
      query += ' AND container_id = $2';
      params.push(container_id);
    }

    query += ' ORDER BY created_at DESC';
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
