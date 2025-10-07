#!/usr/bin/env node

// Add missing columns that server.js expects
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
    sslmode: 'require'
  } : false,
});

async function addMissingColumns() {
  try {
    console.log('🔧 Adding missing columns...');
    
    // Add missing columns that server.js expects
    const steps = [
      {
        name: 'Add resolved column to markets',
        sql: 'ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false'
      },
      {
        name: 'Add resolution_value to markets',
        sql: 'ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolution_value TEXT'
      },
      {
        name: 'Add metadata to markets',
        sql: 'ALTER TABLE markets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\''
      },
      {
        name: 'Add options to markets',
        sql: 'ALTER TABLE markets ADD COLUMN IF NOT EXISTS options JSONB DEFAULT \'[]\''
      },
      {
        name: 'Add updated_at to markets',
        sql: 'ALTER TABLE markets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
      },
      {
        name: 'Add payout_amount to bets',
        sql: 'ALTER TABLE bets ADD COLUMN IF NOT EXISTS payout_amount DECIMAL(18, 9) DEFAULT 0'
      },
      {
        name: 'Add claimed to bets',
        sql: 'ALTER TABLE bets ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT false'
      },
      {
        name: 'Add metadata to bets',
        sql: 'ALTER TABLE bets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\''
      },
      {
        name: 'Add updated_at to bets',
        sql: 'ALTER TABLE bets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
      }
    ];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`⚡ ${step.name}...`);
      
      try {
        await pool.query(step.sql);
        console.log(`   ✅ Success`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  Already exists`);
        } else {
          console.error(`   ❌ Failed: ${error.message}`);
        }
      }
    }
    
    console.log('✅ All missing columns added!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

addMissingColumns();
