const dotenv = require('dotenv-flow');
const path = require('path');

// Load environment variables
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
  default: path.resolve(process.cwd(), '.env.default')
});

// Configuration object with type checking and defaults
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 10000,
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production',
    poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  },
  admin: {
    wallets: (process.env.ADMIN_WALLETS || '').split(',').filter(Boolean)
  },
  features: {
    rateLimiting: process.env.ENABLE_RATE_LIMITING === 'true',
    debugLogging: process.env.DEBUG_LOGGING === 'true'
  }
};

// Validate critical configurations
function validateConfig() {
  const errors = [];

  if (!config.database.url) {
    errors.push('DATABASE_URL is not set');
  }

  if (!config.jwt.secret) {
    errors.push('JWT_SECRET is not set');
  }

  if (errors.length > 0) {
    console.error('Configuration Errors:', errors);
    process.exit(1);
  }
}

validateConfig();

module.exports = config;