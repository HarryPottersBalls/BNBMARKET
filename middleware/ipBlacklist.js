const { Pool } = require('pg');
const logger = require('../utils/logger');
const { ForbiddenError } = require('../errors/customErrors');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') ? {
    rejectUnauthorized: false,
    sslmode: 'require'
  } : false,
});

const ipBlacklistMiddleware = async (req, res, next) => {
  const clientIp = req.ip; // Express automatically handles X-Forwarded-For if trust proxy is enabled

  try {
    const result = await pool.query(
      'SELECT * FROM ip_blacklist WHERE ip_address = $1 AND (expires_at IS NULL OR expires_at > NOW())',
      [clientIp]
    );

    if (result.rows.length > 0) {
      logger.warn(`Blocked blacklisted IP: ${clientIp}. Reason: ${result.rows[0].reason || 'No reason provided'}`);
      throw new ForbiddenError('Access denied from this IP address.');
    }
    next();
  } catch (error) {
    // If it's our ForbiddenError, pass it to the error handling middleware
    if (error instanceof ForbiddenError) {
      next(error);
    } else {
      logger.error(`Error checking IP blacklist for ${clientIp}:`, error);
      // For other errors, we might still want to allow the request to proceed
      // or return a generic error to avoid leaking info about the blacklist system.
      // For now, let's re-throw as a generic 500 error.
      next(new Error('Internal server error during IP blacklist check.'));
    }
  }
};

module.exports = ipBlacklistMiddleware;
