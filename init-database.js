// Database initialization script for BNBmarket
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🗄️  Initializing BNBmarket database tables...');

    // Create markets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS markets (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        creator_address VARCHAR(100) NOT NULL,
        end_date TIMESTAMP NOT NULL,
        initial_liquidity DECIMAL(10, 6) DEFAULT 0,
        total_volume DECIMAL(10, 6) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        winning_option_id INTEGER,
        creation_signature VARCHAR(200),
        market_image VARCHAR(500)
      );
    `);

    // Create market_options table
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_options (
        id SERIAL PRIMARY KEY,
        market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        total_shares DECIMAL(10, 6) DEFAULT 0,
        current_odds DECIMAL(5, 4) DEFAULT 1.0000,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create bets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bets (
        id SERIAL PRIMARY KEY,
        market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
        option_id INTEGER REFERENCES market_options(id) ON DELETE CASCADE,
        bettor_address VARCHAR(100) NOT NULL,
        amount DECIMAL(10, 6) NOT NULL,
        execution_odds DECIMAL(5, 4) NOT NULL,
        price_impact DECIMAL(5, 4) DEFAULT 0,
        transaction_signature VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'confirmed'
      );
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
      CREATE INDEX IF NOT EXISTS idx_markets_creator ON markets(creator_address);
      CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market_id);
      CREATE INDEX IF NOT EXISTS idx_bets_bettor ON bets(bettor_address);
      CREATE INDEX IF NOT EXISTS idx_market_options_market ON market_options(market_id);
    `);

    console.log('✅ Database tables created successfully!');
    console.log('📊 Tables created:');
    console.log('   - markets');
    console.log('   - market_options');
    console.log('   - bets');
    console.log('   - indexes for performance');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run initialization
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('🎉 Database initialization complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };