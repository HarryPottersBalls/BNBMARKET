#!/usr/bin/env node

// Simple Database Migration Runner
// This script runs each migration step individually

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
    sslmode: 'require'
  } : false,
});

async function runSimpleMigration() {
  try {
    console.log('🚀 Starting step-by-step migration...');
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
    
    // Check existing columns
    console.log('🔍 Checking existing table structure...');
    const betsColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bets'
    `);
    console.log('📊 Bets table columns:', betsColumns.rows.map(r => r.column_name));
    
    const marketsColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'markets'
    `);
    console.log('📊 Markets table columns:', marketsColumns.rows.map(r => r.column_name));
    
    // Migration steps
    const steps = [
      {
        name: 'Add platform_fees_collected to markets',
        sql: 'ALTER TABLE markets ADD COLUMN IF NOT EXISTS platform_fees_collected DECIMAL(20,8) DEFAULT 0'
      },
      {
        name: 'Add total_bets to markets', 
        sql: 'ALTER TABLE markets ADD COLUMN IF NOT EXISTS total_bets INTEGER DEFAULT 0'
      },
      {
        name: 'Add platform_fee_taken to bets',
        sql: 'ALTER TABLE bets ADD COLUMN IF NOT EXISTS platform_fee_taken DECIMAL(20,8) DEFAULT 0'
      },
      {
        name: 'Add payout_fee_taken to bets',
        sql: 'ALTER TABLE bets ADD COLUMN IF NOT EXISTS payout_fee_taken DECIMAL(20,8) DEFAULT 0'
      },
      {
        name: 'Initialize platform_fees_collected',
        sql: 'UPDATE markets SET platform_fees_collected = 0 WHERE platform_fees_collected IS NULL'
      },
      {
        name: 'Initialize platform_fee_taken',
        sql: 'UPDATE bets SET platform_fee_taken = 0 WHERE platform_fee_taken IS NULL'
      },
      {
        name: 'Initialize payout_fee_taken',
        sql: 'UPDATE bets SET payout_fee_taken = 0 WHERE payout_fee_taken IS NULL'
      },
      {
        name: 'Update total_bets count',
        sql: 'UPDATE markets SET total_bets = (SELECT COUNT(*) FROM bets WHERE market_id = markets.id) WHERE total_bets = 0 OR total_bets IS NULL'
      },
      {
        name: 'Create index on platform_fees_collected',
        sql: 'CREATE INDEX IF NOT EXISTS idx_markets_platform_fees ON markets(platform_fees_collected)'
      },
      {
        name: 'Create index on platform_fee_taken',
        sql: 'CREATE INDEX IF NOT EXISTS idx_bets_platform_fee ON bets(platform_fee_taken)'
      },
      {
        name: 'Create index on payout_fee_taken',
        sql: 'CREATE INDEX IF NOT EXISTS idx_bets_payout_fee ON bets(payout_fee_taken)'
      }
    ];
    
    // Execute each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`⚡ Step ${i + 1}/${steps.length}: ${step.name}`);
      
      try {
        await pool.query(step.sql);
        console.log(`   ✅ Success`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('already has')) {
          console.log(`   ⚠️  Skipped (already exists)`);
        } else {
          console.error(`   ❌ Failed: ${error.message}`);
          throw error;
        }
      }
    }
    
    // Final verification
    console.log('🔍 Final verification...');
    const finalCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_bets,
        COALESCE(SUM(platform_fee_taken), 0) as total_bid_fees,
        COALESCE(SUM(payout_fee_taken), 0) as total_payout_fees
      FROM bets
    `);
    
    const stats = finalCheck.rows[0];
    console.log('📊 Migration results:');
    console.log(`   ✅ Total bets: ${stats.total_bets}`);
    console.log(`   ✅ Bid fees tracked: ${stats.total_bid_fees} BNB`);
    console.log(`   ✅ Payout fees tracked: ${stats.total_payout_fees} BNB`);
    
    console.log('🎉 Database migration completed successfully!');
    console.log('💡 Your 1% bid + 1% payout fee system is now active!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSimpleMigration();
