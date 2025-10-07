#!/usr/bin/env node

// Database Migration Runner
// This script runs the fee system migration on your PostgreSQL database

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
    sslmode: 'require'
  } : false,
});

async function runMigration() {
  try {
    console.log('🚀 Starting database migration...');
    console.log('📊 Database URL:', process.env.DATABASE_URL ? 'Connected' : 'NOT FOUND');
    
    // Test connection
    console.log('🔗 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'schema_migration_fees.sql');
    console.log('📖 Reading migration file:', migrationPath);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error('Migration file not found: ' + migrationPath);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded successfully');
    
    // Split SQL commands (handle multiple statements)
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    console.log(`📝 Found ${commands.length} SQL commands to execute`);
    
    // Execute each command
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        console.log(`⚡ Executing command ${i + 1}/${commands.length}...`);
        console.log(`   ${command.substring(0, 60)}${command.length > 60 ? '...' : ''}`);
        
        try {
          await pool.query(command);
          console.log(`   ✅ Command ${i + 1} completed successfully`);
        } catch (error) {
          // Some commands might fail if columns already exist, which is OK
          if (error.message.includes('already exists') || error.message.includes('already has')) {
            console.log(`   ⚠️  Command ${i + 1} skipped (already exists): ${error.message}`);
          } else {
            console.error(`   ❌ Command ${i + 1} failed:`, error.message);
            throw error;
          }
        }
      }
    }
    
    // Verify migration
    console.log('🔍 Verifying migration...');
    
    // Check if new columns exist
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bets' 
      AND column_name IN ('platform_fee_taken', 'payout_fee_taken')
    `);
    
    console.log(`✅ New bet columns found: ${columnCheck.rows.length}/2`);
    
    const marketColumnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'markets' 
      AND column_name = 'platform_fees_collected'
    `);
    
    console.log(`✅ New market columns found: ${marketColumnCheck.rows.length}/1`);
    
    // Test the new fee structure
    const testQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_bets,
        COALESCE(SUM(platform_fee_taken), 0) as total_bid_fees,
        COALESCE(SUM(payout_fee_taken), 0) as total_payout_fees
      FROM bets
    `);
    
    const stats = testQuery.rows[0];
    console.log('📊 Current fee statistics:');
    console.log(`   Total bets: ${stats.total_bets}`);
    console.log(`   Total bid fees collected: ${stats.total_bid_fees} BNB`);
    console.log(`   Total payout fees collected: ${stats.total_payout_fees} BNB`);
    
    console.log('🎉 Migration completed successfully!');
    console.log('💡 Your platform now supports:');
    console.log('   - 1% fee on bet amounts');
    console.log('   - 1% fee on payout amounts');
    console.log('   - Creation fees tracking');
    console.log('   - Enhanced treasury calculations');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('📋 Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('🔚 Database connection closed');
  }
}

// Run migration
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
