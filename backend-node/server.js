const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend from public/ (one level up from backend-node/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Create uploads dir for local photo storage (Phase 2 will move to Cloudinary)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create tables on startup
async function initDatabase() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database init error:', error.message);
  }
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/containers', require('./routes/containers'));
app.use('/api/search', require('./routes/search'));
app.use('/api/photos', require('./routes/photos'));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: true, timestamp: new Date().toISOString() });
  } catch {
    res.json({ status: 'ok', db: false, timestamp: new Date().toISOString() });
  }
});

app.get('/api/debug', (req, res) => {
  res.json({
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV
  });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initDatabase();
});

module.exports = app;
