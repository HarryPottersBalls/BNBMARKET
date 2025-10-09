#!/usr/bin/env node

// Advanced Database Migration Runner
// Robust migration script with comprehensive error handling and logging

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Enhanced logging utility
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`),
  success: (message) => console.log(`[✅] ${message}`)
};

// Centralized database connection configuration
function createDatabasePool() {
  try {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
        sslmode: 'require'
      } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  } catch (error) {
    logger.error(`Database pool configuration failed: ${error.message}`);
    process.exit(1);
  }
}

// Enhanced transaction management
async function runMigrationWithTransaction(pool, steps) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const [index, step] of steps.entries()) {
      logger.info(`Running migration step ${index + 1}: ${step.name}`);

      try {
        await client.query(step.sql);
        logger.success(`Completed: ${step.name}`);
      } catch (stepError) {
        if (
          stepError.message.includes('already exists') ||
          stepError.message.includes('already has')
        ) {
          logger.warn(`Skipped (already exists): ${step.name}`);
        } else {
          throw stepError;
        }
      }
    }

    await client.query('COMMIT');
    logger.success('Migration transaction completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Migration failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

// Migration step generator
function generateMigrationSteps() {
  return [
    {
      name: 'Add platform_fees_collected to markets',
      sql: `
        ALTER TABLE markets
        ADD COLUMN IF NOT EXISTS platform_fees_collected DECIMAL(20,8) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS platform_fees_strategy JSONB DEFAULT '{"version": 1, "type": "standard"}'
      `
    },
    {
      name: 'Add advanced bet tracking to markets',
      sql: `
        ALTER TABLE markets
        ADD COLUMN IF NOT EXISTS total_bets INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS unique_bettors INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS market_health_score DECIMAL(5,2) DEFAULT 100
      `
    },
    {
      name: 'Enhance bets table with advanced fee tracking',
      sql: `
        ALTER TABLE bets
        ADD COLUMN IF NOT EXISTS platform_fee_taken DECIMAL(20,8) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payout_fee_taken DECIMAL(20,8) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS bet_risk_score DECIMAL(5,2) DEFAULT 50
      `
    },
    {
      name: 'Update total_bets and unique bettors',
      sql: `
        WITH bet_stats AS (
          SELECT
            market_id,
            COUNT(*) as total_bets,
            COUNT(DISTINCT bettor_address) as unique_bettors
          FROM bets
          GROUP BY market_id
        )
        UPDATE markets m
        SET
          total_bets = COALESCE(bs.total_bets, 0),
          unique_bettors = COALESCE(bs.unique_bettors, 0)
        FROM bet_stats bs
        WHERE m.id = bs.market_id
      `
    },
    {
      name: 'Optimize indexes for performance',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_markets_platform_fees ON markets(platform_fees_collected);
        CREATE INDEX IF NOT EXISTS idx_bets_platform_fee ON bets(platform_fee_taken);
        CREATE INDEX IF NOT EXISTS idx_bets_payout_fee ON bets(payout_fee_taken);
        CREATE INDEX IF NOT EXISTS idx_markets_unique_bettors ON markets(unique_bettors);
      `
    }
  ];
}

async function runMigration() {
  const pool = createDatabasePool();

  try {
    logger.info('🚀 Starting advanced database migration...');
    await pool.query('SELECT 1'); // Verify connection
    logger.success('Database connection established');

    const migrationSteps = generateMigrationSteps();
    await runMigrationWithTransaction(pool, migrationSteps);

    // Comprehensive final verification
    const finalCheck = await pool.query(`
      SELECT
        COUNT(DISTINCT market_id) as total_markets,
        COUNT(*) as total_bets,
        COALESCE(SUM(platform_fee_taken), 0) as total_bid_fees,
        COALESCE(SUM(payout_fee_taken), 0) as total_payout_fees,
        COALESCE(AVG(market_health_score), 0) as avg_market_health
      FROM markets m
      JOIN bets b ON m.id = b.market_id
    `);

    const stats = finalCheck.rows[0];
    logger.info('📊 Migration Results:');
    logger.info(`Total Markets: ${stats.total_markets}`);
    logger.info(`Total Bets: ${stats.total_bets}`);
    logger.info(`Total Bid Fees: ${stats.total_bid_fees} BNB`);
    logger.info(`Total Payout Fees: ${stats.total_payout_fees} BNB`);
    logger.info(`Avg Market Health: ${stats.avg_market_health.toFixed(2)}%`);

    logger.success('🎉 Advanced Database Migration Completed Successfully!');
  } catch (error) {
    logger.error(`Migration process failed: ${error.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
