const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload photo
router.post('/', auth, upload.single('photo'), async (req, res) => {
  try {
    const { item_id } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!item_id) {
      return res.status(400).json({ error: 'Item ID required' });
    }

    const itemCheck = await pool.query(
      'SELECT id FROM items WHERE id = $1 AND user_id = $2',
      [item_id, req.userId]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Upload to Cloudinary
    const b64 = req.file.buffer.toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'vault',
      transformation: [{ width: 800, height: 800, crop: 'limit' }]
    });

    const existingImages = await pool.query(
      'SELECT COUNT(*) FROM item_images WHERE item_id = $1',
      [item_id]
    );

    const isPrimary = parseInt(existingImages.rows[0].count) === 0;

    const dbResult = await pool.query(
      'INSERT INTO item_images (item_id, image_path, is_primary) VALUES ($1, $2, $3) RETURNING *',
      [item_id, result.secure_url, isPrimary]
    );

    res.status(201).json({ data: dbResult.rows[0] });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete photo
router.delete('/', auth, async (req, res) => {
  try {
    const { image_id } = req.body;

    if (!image_id) {
      return res.status(400).json({ error: 'Image ID required' });
    }

    const imageCheck = await pool.query(
      `SELECT ii.* FROM item_images ii
       JOIN items i ON ii.item_id = i.id
       WHERE ii.id = $1 AND i.user_id = $2`,
      [image_id, req.userId]
    );

    if (imageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const image = imageCheck.rows[0];

    // Delete from Cloudinary if it's a cloudinary URL
    if (image.image_path.includes('cloudinary.com')) {
      const parts = image.image_path.split('/');
      const publicId = parts.slice(parts.indexOf('upload') + 1).join('/').replace(/\.[^.]+$/, '');
      await cloudinary.uploader.destroy(publicId);
    }

    await pool.query('DELETE FROM item_images WHERE id = $1', [image_id]);

    if (image.is_primary) {
      await pool.query(
        `UPDATE item_images SET is_primary = true
         WHERE item_id = $1 AND id = (SELECT id FROM item_images WHERE item_id = $1 LIMIT 1)`,
        [image.item_id]
      );
    }

    res.json({ message: 'Image deleted' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
