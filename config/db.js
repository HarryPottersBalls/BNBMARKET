const { Pool } = require('pg');
const logger = require('../utils/logger'); // Assuming logger is in utils/logger.js

const pool = new Pool({
  connectionString: process.env.NODE_ENV === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') ? {
    rejectUnauthorized: false,
    sslmode: 'require'
  } : false,
  max: process.env.NODE_ENV === 'production' ? 10 : 20, // Lower connection pool for production
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout for production
  query_timeout: 30000, // Global query timeout in milliseconds
  statement_timeout: 15000, // Terminate any statement that takes longer than 15 seconds
});

// Test database connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('PostgreSQL connection error:', err.message);
});

async function queryDatabase(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    logger.error('Database query error:', error.message);
    logger.error('Query:', query);
    logger.error('Params:', params);
    throw error;
  }
}

module.exports = {
  pool,
  queryDatabase,
};