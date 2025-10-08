const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const Decimal = require('decimal.js');
const { queryDatabase } = require('../utils/database');

router.get('/', async (req, res) => {
  try {
    const [marketsResult, betsResult, volumeResult] = await Promise.all([
      queryDatabase('SELECT COUNT(*) as count FROM markets WHERE status = $1', ['active']),
      queryDatabase('SELECT COUNT(*) as count FROM bets WHERE status = $1', ['confirmed']),
      queryDatabase('SELECT COALESCE(SUM(total_volume), 0) as volume FROM markets')
    ]);

    res.json({
      totalMarkets: parseInt(marketsResult.rows[0].count),
      totalBets: parseInt(betsResult.rows[0].count),
      totalVolume: new Decimal(volumeResult.rows[0].volume || 0).toString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      details: error.message
    });
  }
});

module.exports = router;