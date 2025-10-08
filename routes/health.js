const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const { Pool } = require('pg');
const pool = new Pool(); // Assumes pool is configured same as in server.js

router.get('/', async (req, res) => {
  const health = { status: 'ok', timestamp: new Date().toISOString(), diagnostics: {} };
  try {
    // Database check
    await pool.query('SELECT 1');
    health.diagnostics.db = 'ok';
  } catch (error) {
    health.diagnostics.db = 'error: ' + error.message;
    health.status = 'degraded';
    logger.error('Health check: Database connection failed', error);
  }

  try {
    // Cloudinary check (attempt to list resources or check credentials)
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      // A lightweight check, e.g., get account info or a very small resource
      await cloudinary.api.ping();
      health.diagnostics.cloudinary = 'ok';
    } else {
      health.diagnostics.cloudinary = 'skipped (credentials missing)';
    }
  } catch (error) {
    health.diagnostics.cloudinary = 'error: ' + error.message;
    health.status = 'degraded';
    logger.error('Health check: Cloudinary connection failed', error);
  }

  health.diagnostics.env = process.env.NODE_ENV || 'development';
  health.diagnostics.uptime = process.uptime();
  health.version = process.env.npm_package_version || 'unknown'; // Assuming package.json version

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

module.exports = router;