const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Get all containers
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM containers WHERE user_id = $1 ORDER BY sort_order, name',
      [req.userId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get containers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get container tree
router.get('/tree', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM containers WHERE user_id = $1 ORDER BY sort_order, name',
      [req.userId]
    );
    const tree = buildTree(result.rows, null);
    res.json({ data: tree });
  } catch (error) {
    console.error('Get tree error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

function buildTree(items, parentId) {
  return items
    .filter(item => item.parent_id === parentId)
    .map(item => ({
      ...item,
      children: buildTree(items, item.id)
    }));
}

// Create container
router.post('/', auth, async (req, res) => {
  try {
    const { name, type, description, parent_id, photo } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(
      'INSERT INTO containers (user_id, name, type, description, parent_id, photo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.userId, name, type || 'other', description || null, parent_id || null, photo || null]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Create container error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update container
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, type, description, parent_id, photo } = req.body;

    const result = await pool.query(
      `UPDATE containers SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        description = $3,
        parent_id = $4,
        photo = COALESCE($5, photo)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, type, description, parent_id, photo, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Container not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Update container error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete container
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM containers WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Container not found' });
    }

    res.json({ message: 'Container deleted' });
  } catch (error) {
    console.error('Delete container error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
