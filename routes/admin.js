const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { isAdminAddress } = require('../utils/admin-utils');
const {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError
} = require('../errors/customErrors');
const Decimal = require('decimal.js');
const { queryDatabase, parseJSONBField } = require('../utils/database');

// Check if address is admin
router.get('/check/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const isAdmin = isAdminAddress(address);

    res.json({
      address: address,
      isAdmin: isAdmin,
      canCreateFreeMarkets: isAdmin,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to check admin status',
      details: error.message
    });
  }
});

// Get pending markets for review
router.get('/pending-markets', async (req, res) => {
  try {
    const { address } = req.query;

    if (!isAdminAddress(address)) {
      throw new ForbiddenError('Admin access required');
    }

    // Get pending markets (excluding admin-created ones which should auto-approve)
    const result = await queryDatabase(`
      SELECT
        m.*,
        COUNT(b.id) as bet_count,
        COALESCE(SUM(b.amount), 0) as volume
      FROM markets m
      LEFT JOIN bets b ON m.id = b.market_id AND b.status = 'confirmed'
      WHERE m.status = 'under_review'
      GROUP BY m.id
      ORDER BY m.created_at ASC
    `);

    const markets = result.rows.map(row => {
      const options = parseJSONBField(row.options, 'options');
      const metadata = parseJSONBField(row.metadata, 'metadata');

      // Process options to ensure proper image handling
      const processedOptions = options.map(option => ({
        name: option.name || 'Unnamed Option',
        image: option.image || null, // null if no image
        hasImage: Boolean(option.image)
      }));

      return {
        ...row,
        total_volume: new Decimal(row.volume || 0).toString(),
        total_bets: parseInt(row.bet_count || 0),
        options: processedOptions,
        metadata: {
          ...metadata,
          hasOptionImages: processedOptions.some(opt => opt.hasImage),
          totalOptions: processedOptions.length
        },
        // Additional info for admin review
        is_admin_created: Boolean(metadata.admin_created),
        creation_fee_paid: Boolean(metadata.creation_fee_paid),
        market_image: metadata.marketImage || row.market_image
      };
    });

    logger.info(`Admin ${address} requested ${markets.length} pending markets for review`);

    res.json({
      markets,
      count: markets.length,
      timestamp: new Date().toISOString(),
      note: 'Admin-created markets are auto-approved and do not appear here'
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch pending markets',
      details: error.message
    });
  }
});

// Approve a market
router.post('/approve-market/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.query;

    if (!isAdminAddress(address)) {
      throw new ForbiddenError('Admin access required');
    }

    logger.info(`Attempting to approve market ${id}. Querying for status 'under_review'.`);
    const result = await queryDatabase(`
      UPDATE markets
      SET
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'under_review'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Market not found or already processed');
    }

    const market = result.rows[0];
    market.options = parseJSONBField(market.options, 'options');
    market.metadata = parseJSONBField(market.metadata, 'metadata');

    logger.info(`Market ${id} approved by admin ${address}: "${market.title}"`);

    res.json({
      market,
      message: 'Market approved successfully'
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to approve market',
      details: error.message
    });
  }
});

// Reject a market
router.post('/reject-market/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.query;
    const { reason } = req.body;

    if (!isAdminAddress(address)) {
      throw new ForbiddenError('Admin access required');
    }

    const result = await queryDatabase(`
      UPDATE markets
      SET
        status = 'rejected',
        metadata = jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(metadata, '{}'),
              '{rejection_reason}',
              to_jsonb($2::text)
            ),
            '{rejected_by}',
            to_jsonb($3::text)
          ),
          '{rejected_at}',
          to_jsonb($4::text)
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'under_review'
      RETURNING *
    `, [id, reason || 'No reason provided', address, new Date().toISOString()]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Market not found or already processed');
    }

    const market = result.rows[0];
    market.options = parseJSONBField(market.options, 'options');
    market.metadata = parseJSONBField(market.metadata, 'metadata');

    logger.info(`Market ${id} rejected by admin ${address}: "${market.title}" - Reason: ${reason}`);

    res.json({
      market,
      message: 'Market rejected successfully',
      reason: reason
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to reject market',
      details: error.message
    });
  }
});

module.exports = router;