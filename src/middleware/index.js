const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { errorHandler } = require('./error-handler');
const config = require('../config/environment');

function setupMiddleware(app) {
  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: config.env === 'production'
      ? ['https://bnbmarket.cc', 'https://api.bnbmarket.cc']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  }));

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Compression
  app.use(compression());

  // Rate limiting (optional, controlled by config)
  if (config.features.rateLimiting) {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests
      message: 'Too many requests, please try again later'
    });
    app.use(limiter);
  }

  // Global error handler (must be last)
  app.use(errorHandler);
}

module.exports = setupMiddleware;