require('dotenv-flow').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger'); // Use our new logger

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') ? {
    rejectUnauthorized: false,
    sslmode: 'require'
  } : false,
});

async function runAllMigrations() {
  let client;
  try {
    client = await pool.connect();
    logger.info('🚀 Starting database migrations...');

    // Create migrations_history table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations_history (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('✅ migrations_history table ensured.');

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    for (const file of migrationFiles) {
      const migrationName = file;
      const { rows } = await client.query(
        'SELECT id FROM migrations_history WHERE migration_name = $1',
        [migrationName]
      );

      if (rows.length === 0) {
        logger.info(`📖 Applying migration: ${migrationName}`);
        const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        // Split SQL commands by semicolon, filter out empty strings and comments
        const commands = migrationSQL
          .split(';')
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

        for (const command of commands) {
          await client.query(command);
        }

        await client.query(
          'INSERT INTO migrations_history (migration_name) VALUES ($1)',
          [migrationName]
        );
        logger.info(`✅ Migration applied: ${migrationName}`);
      } else {
        logger.info(`⏭️ Migration already applied: ${migrationName}`);
      }
    }

    logger.info('🎉 All database migrations completed successfully!');
  } catch (error) {
    logger.error('❌ Database migration failed:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    logger.info('🔚 Database connection closed after migrations.');
  }
}

if (require.main === module) {
  runAllMigrations();
}

module.exports = { runAllMigrations };
