const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query required' });
    }

    const result = await pool.query(
      `SELECT i.*, c.name as container_name,
        COALESCE(
          (SELECT json_agg(image_path ORDER BY sort_order)
           FROM item_images WHERE item_id = i.id),
          '[]'::json
        ) as images
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       WHERE i.user_id = $1
         AND (i.name ILIKE $2 OR i.description ILIKE $2 OR i.category ILIKE $2)
       ORDER BY i.created_at DESC`,
      [req.userId, `%${q}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
