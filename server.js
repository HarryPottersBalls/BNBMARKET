// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Polyfill fetch for Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const path = require('path');

// Production CORS configuration
const allowedOrigins = [
  // Production domains
  'https://bnbmarket.cc',
  'https://www.bnbmarket.cc',
  'https://api.bnbmarket.cc',
  'https://bnbmarket.onrender.com',
  // Add your actual Render domain here when you get it
  // Local development (only if NODE_ENV is not production)
  ...(process.env.NODE_ENV !== 'production' ? [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ] : []),
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.error(`CORS not allowed from this origin: ${origin}`);
      return callback(new Error('CORS not allowed from this origin: ' + origin), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
}));

// Production security headers
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });
}

app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 10000;

// PostgreSQL configuration with production-ready SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
    sslmode: 'require'
  } : false,
  max: process.env.NODE_ENV === 'production' ? 10 : 20, // Lower connection pool for production
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout for production
  query_timeout: 30000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err.message);
});

// Admin authorization helper function
function isAdminAddress(address) {
  if (!address) return false;
  
  const adminAddresses = [
    process.env.ADMIN_WALLET || '0x7eCa382995Df91C250896c0EC73c9d2893F7800e',
    '0x7eCa382995Df91C250896c0EC73c9d2893F7800e' // Fallback admin wallet
  ];
  
  return adminAddresses.includes(address.toLowerCase()) || adminAddresses.includes(address);
}

// Cloudinary configuration
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
} else {
  console.warn('Warning: Cloudinary environment variables are missing. Image upload will not work.');
}

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  }
});

// Initialize database tables
async function initializeDatabase() {
  try {
    console.log('Initializing database tables...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS markets (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'other',
        creator_address VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP,
        total_volume DECIMAL(18, 9) DEFAULT 0,
        total_bets INTEGER DEFAULT 0,
        options JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'under_review',
        creation_signature VARCHAR(150),
        initial_liquidity DECIMAL(18, 9) DEFAULT 0,
        resolved BOOLEAN DEFAULT false,
        resolution_value TEXT,
        metadata JSONB DEFAULT '{}',
        market_image TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bets (
        id SERIAL PRIMARY KEY,
        market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
        bettor_address VARCHAR(100) NOT NULL,
        option_id INTEGER NOT NULL,
        amount DECIMAL(18, 9) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        transaction_signature VARCHAR(150),
        status VARCHAR(20) DEFAULT 'confirmed',
        payout_amount DECIMAL(18, 9) DEFAULT 0,
        claimed BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}'
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        bet_id INTEGER REFERENCES bets(id) ON DELETE CASCADE,
        user_address VARCHAR(100) NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_markets_creator ON markets(creator_address);
      CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
      CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
      CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market_id);
      CREATE INDEX IF NOT EXISTS idx_bets_bettor ON bets(bettor_address);
      CREATE INDEX IF NOT EXISTS idx_bets_transaction ON bets(transaction_signature);
      CREATE INDEX IF NOT EXISTS idx_comments_bet_id ON comments(bet_id);
      CREATE INDEX IF NOT EXISTS idx_comments_user_address ON comments(user_address);
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Utility function
async function queryDatabase(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error.message);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

// Helper function to properly parse JSONB fields
function parseJSONBField(field, fieldName = 'field') {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      console.error(`Failed to parse ${fieldName}:`, e);
      return fieldName === 'metadata' ? {} : [];
    }
  }
  return field || (fieldName === 'metadata' ? {} : []);
}

// API Routes

// Health check
app.get('/api/health', async (req, res) => {
  const health = { status: 'ok', timestamp: new Date().toISOString(), diagnostics: {} };
  try {
    await pool.query('SELECT 1');
    health.diagnostics.db = 'ok';
  } catch (error) {
    health.diagnostics.db = 'error: ' + error.message;
    health.status = 'error';
  }
  health.diagnostics.env = process.env.NODE_ENV || 'development';
  health.diagnostics.uptime = process.uptime();
  res.status(health.status === 'ok' ? 200 : 500).json(health);
});

// Get platform stats
app.get('/api/stats', async (req, res) => {
  try {
    const [marketsResult, betsResult, volumeResult] = await Promise.all([
      queryDatabase('SELECT COUNT(*) as count FROM markets WHERE status = $1', ['active']),
      queryDatabase('SELECT COUNT(*) as count FROM bets WHERE status = $1', ['confirmed']),
      queryDatabase('SELECT COALESCE(SUM(total_volume), 0) as volume FROM markets')
    ]);

    res.json({
      totalMarkets: parseInt(marketsResult.rows[0].count),
      totalBets: parseInt(betsResult.rows[0].count),
      totalVolume: parseFloat(volumeResult.rows[0].volume || 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      details: error.message 
    });
  }
});

// Get market creation fee
app.get('/api/creation-fee', async (req, res) => {
  try {
    const marketCreationFee = 0.0007803101839841827; // BNB
    res.json({
      creation_fee: marketCreationFee,
      creation_fee_formatted: `${marketCreationFee.toFixed(10)} BNB`,
      description: 'Fee required to create a new prediction market',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch creation fee',
      details: error.message 
    });
  }
});

// Treasury endpoint
app.get('/api/treasury', async (req, res) => {
  try {
    // Calculate treasury: total volume - total payouts + creation fees - platform fees (5%)
    const treasuryResult = await queryDatabase(`
      SELECT 
        COALESCE(SUM(m.total_volume), 0) as total_volume,
        COALESCE(SUM(b.payout_amount), 0) as total_payouts,
        COUNT(DISTINCT m.id) as total_markets,
        COUNT(b.id) as total_bets,
        COUNT(DISTINCT CASE WHEN m.creator_address != $1 THEN m.id END) as non_admin_markets
      FROM markets m
      LEFT JOIN bets b ON m.id = b.market_id AND b.claimed = true
    `, [process.env.ADMIN_WALLET || '0x7eCa382995Df91C250896c0EC73c9d2893F7800e']);
    
    const result = treasuryResult.rows[0];
    const totalVolume = parseFloat(result.total_volume || 0);
    const totalPayouts = parseFloat(result.total_payouts || 0);
    const nonAdminMarkets = parseInt(result.non_admin_markets || 0);
    
    // Creation fees collected
    const marketCreationFee = 0.0007803101839841827;
    const totalCreationFees = nonAdminMarkets * marketCreationFee;
    
    // Platform fees: 5% of total volume
    const platformFees = totalVolume * 0.05;
    
    // Treasury balance: volume - payouts + creation fees (platform fee is automatically retained)
    const treasury = totalVolume - totalPayouts + totalCreationFees;
    
    res.json({ 
      treasury,
      total_volume: totalVolume,
      total_payouts: totalPayouts,
      platform_fees: platformFees,
      creation_fees: totalCreationFees,
      creation_fee_per_market: marketCreationFee,
      total_markets: parseInt(result.total_markets),
      total_bets: parseInt(result.total_bets),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Treasury API error:', error);
    res.status(500).json({ error: 'Failed to fetch treasury', details: error.message });
  }
});

// Get all markets
app.get('/api/markets', async (req, res) => {
  try {
    const { category, status, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        m.*,
        COUNT(b.id) as bet_count,
        COALESCE(SUM(b.amount), 0) as volume
      FROM markets m 
      LEFT JOIN bets b ON m.id = b.market_id AND b.status = 'confirmed'
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ` AND m.status = $${params.length + 1}`;
      params.push(status);
    } else {
      query += ` AND m.status IN ('active', 'under_review')`;
    }
    
    if (category && category !== 'all') {
      query += ` AND m.category = $${params.length + 1}`;
      params.push(category);
    }
    
    query += `
      GROUP BY m.id 
      ORDER BY m.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await queryDatabase(query, params);
    
    const markets = result.rows.map(row => {
      const options = parseJSONBField(row.options, 'options');
      const metadata = parseJSONBField(row.metadata, 'metadata');
      
      // Ensure admin_odds array exists
      if (!Array.isArray(metadata.admin_odds)) {
        metadata.admin_odds = [];
      }
      
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        creator_address: row.creator_address,
        created_at: row.created_at,
        updated_at: row.updated_at,
        end_date: row.end_date,
        status: row.status,
        creation_signature: row.creation_signature,
        initial_liquidity: row.initial_liquidity,
        resolved: row.resolved,
        resolution_value: row.resolution_value,
        total_volume: parseFloat(row.volume || 0),
        total_bets: parseInt(row.bet_count || 0),
        options: options,
        metadata: metadata
      };
    });

    res.json({ 
      markets,
      count: markets.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch markets',
      details: error.message 
    });
  }
});

// Get specific market
app.get('/api/markets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const marketResult = await queryDatabase(`
      SELECT 
        m.*,
        COUNT(b.id) as bet_count,
        COALESCE(SUM(b.amount), 0) as volume
      FROM markets m 
      LEFT JOIN bets b ON m.id = b.market_id AND b.status = 'confirmed'
      WHERE m.id = $1
      GROUP BY m.id
    `, [id]);

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const row = marketResult.rows[0];
    const options = parseJSONBField(row.options, 'options');
    const metadata = parseJSONBField(row.metadata, 'metadata');
    
    // Ensure admin_odds array exists
    if (!Array.isArray(metadata.admin_odds)) {
      metadata.admin_odds = [];
    }

    const market = {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      creator_address: row.creator_address,
      created_at: row.created_at,
      updated_at: row.updated_at,
      end_date: row.end_date,
      status: row.status,
      creation_signature: row.creation_signature,
      initial_liquidity: row.initial_liquidity,
      resolved: row.resolved,
      resolution_value: row.resolution_value,
      total_volume: parseFloat(row.volume || 0),
      total_bets: parseInt(row.bet_count || 0),
      options: options,
      metadata: metadata
    };

    // Get bets
    const betsResult = await queryDatabase(`
      SELECT * FROM bets 
      WHERE market_id = $1 AND status = 'confirmed'
      ORDER BY created_at DESC
    `, [id]);

    market.bets = betsResult.rows;

    console.log(`Market ${id} loaded. Admin odds:`, market.metadata.admin_odds);

    res.json({ market });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market',
      details: error.message 
    });
  }
});

// Create new market
app.post('/api/markets', async (req, res) => {
  try {
    const {
      title,
      description = '',
      category = 'other',
      creator_address,
      creatorAddress,
      endDate,
      initialLiquidity = 0,
      options = [],
      creationSignature,
      marketImage
    } = req.body;

    const creatorAddr = creator_address || creatorAddress;
    const isAdmin = isAdminAddress(creatorAddr);

    if (!title || !creatorAddr) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['title', 'creator_address or creatorAddress']
      });
    }

    if (title.length < 10) {
      return res.status(400).json({ 
        error: 'Title must be at least 10 characters long' 
      });
    }

    // Process options - remove odds from options array
    let processedOptions = [];
    if (Array.isArray(options)) {
      processedOptions = options.map(o => ({
        name: o.name,
        image: o.image || null
      }));
    } else if (typeof options === 'string') {
      try {
        const parsed = JSON.parse(options);
        processedOptions = parsed.map(o => ({
          name: o.name,
          image: o.image || null
        }));
      } catch (e) {
        processedOptions = [
          { name: 'Yes', image: null },
          { name: 'No', image: null }
        ];
      }
    } else {
      processedOptions = [
        { name: 'Yes', image: null },
        { name: 'No', image: null }
      ];
    }

    // Initialize metadata with empty admin_odds (admin must set them)
    const metadata = {
      marketImage: marketImage || null,
      admin_odds: processedOptions.map(() => null)
    };

    let marketInsert;
    if (isAdmin) {
      const status = req.body.autoApprove ? 'active' : 'under_review';
      marketInsert = await queryDatabase(`
        INSERT INTO markets (
          title, description, category, creator_address, 
          end_date, initial_liquidity, options, creation_signature, status, metadata
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *
      `, [
        title, 
        description, 
        category, 
        creatorAddr, 
        endDate ? new Date(endDate) : null,
        0,
        JSON.stringify(processedOptions),
        null,
        status,
        JSON.stringify(metadata)
      ]);
    } else {
      // Market creation fee for non-admin users
      const marketCreationFee = 0.0007803101839841827; // BNB
      const minInitialLiquidity = 0.1;
      
      if (!initialLiquidity || isNaN(initialLiquidity) || parseFloat(initialLiquidity) < minInitialLiquidity) {
        return res.status(400).json({
          error: `A minimum initial liquidity of ${minInitialLiquidity} BNB is required.`
        });
      }
      
      if (!creationSignature) {
        return res.status(400).json({
          error: 'A creation signature is required.'
        });
      }
      
      // Validate that the transaction includes the creation fee
      // In a real implementation, you would verify the transaction on-chain
      // For now, we'll store the expected fee amount in metadata
      
      marketInsert = await queryDatabase(`
        INSERT INTO markets (
          title, description, category, creator_address, 
          end_date, initial_liquidity, options, creation_signature, status, metadata
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *
      `, [
        title, 
        description, 
        category, 
        creatorAddr, 
        endDate ? new Date(endDate) : null,
        parseFloat(initialLiquidity),
        JSON.stringify(processedOptions),
        creationSignature,
        'under_review',
        JSON.stringify({
          ...metadata,
          creation_fee: marketCreationFee,
          creation_fee_paid: true
        })
      ]);
    }

    const market = marketInsert.rows[0];
    market.options = parseJSONBField(market.options, 'options');
    market.metadata = parseJSONBField(market.metadata, 'metadata');
    
    res.status(201).json({ market });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to create market',
      details: error.message 
    });
  }
});

// Place a bet
app.post('/api/bets', async (req, res) => {
  try {
    const {
      marketId,
      bettorAddress,
      optionId,
      amount,
      transactionSignature
    } = req.body;

    if (!marketId || !bettorAddress || optionId === undefined || !amount || !transactionSignature) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['marketId', 'bettorAddress', 'optionId', 'amount', 'transactionSignature']
      });
    }

    const marketResult = await queryDatabase(
      'SELECT * FROM markets WHERE id = $1 AND status = $2', 
      [marketId, 'active']
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found or inactive' });
    }

    const existingBet = await queryDatabase(
      'SELECT id FROM bets WHERE transaction_signature = $1', 
      [transactionSignature]
    );

    if (existingBet.rows.length > 0) {
      return res.status(409).json({ error: 'Bet already recorded for this transaction' });
    }

    const result = await queryDatabase(`
      INSERT INTO bets (market_id, bettor_address, option_id, amount, transaction_signature) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `, [marketId, bettorAddress, parseInt(optionId), parseFloat(amount), transactionSignature]);

    await queryDatabase(`
      UPDATE markets 
      SET 
        total_volume = total_volume + $1,
        total_bets = total_bets + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [parseFloat(amount), marketId]);

    const bet = result.rows[0];
    console.log('Bet placed:', bet.id, `${amount} BNB on market ${marketId}`);

    res.status(201).json({ 
      bet,
      message: 'Bet placed successfully'
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to place bet',
      details: error.message 
    });
  }
});

// Get bets
app.get('/api/bets', async (req, res) => {
  try {
    const { address, market_id, marketId, limit = 50, offset = 0 } = req.query;
    const actualMarketId = market_id || marketId;
    
    if (!address && !actualMarketId) {
      return res.status(400).json({ error: 'Either address or market_id parameter required' });
    }

    let query = `
      SELECT 
        b.*,
        m.title as market_title,
        m.category as market_category,
        m.status as market_status,
        m.resolved as market_resolved,
        m.resolution_value as market_resolution
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      WHERE b.status = 'confirmed'
    `;
    const params = [];
    
    if (address) {
      query += ` AND b.bettor_address = $${params.length + 1}`;
      params.push(address);
    }
    if (actualMarketId) {
      query += ` AND b.market_id = $${params.length + 1}`;
      params.push(actualMarketId);
    }
    
    query += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await queryDatabase(query, params);
    
    res.json({ 
      bets: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bets',
      details: error.message 
    });
  }
});

// Claim winnings from resolved markets
app.post('/api/claim/:betId', async (req, res) => {
  try {
    const { betId } = req.params;
    const { address, transactionSignature } = req.body;

    if (!address || !transactionSignature) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['address', 'transactionSignature']
      });
    }

    // Get bet details with market information
    const betResult = await queryDatabase(`
      SELECT 
        b.*,
        m.title as market_title,
        m.resolved,
        m.resolution_value,
        m.status as market_status,
        m.options,
        m.total_volume,
        m.metadata
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      WHERE b.id = $1 AND b.bettor_address = $2
    `, [betId, address]);

    if (betResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bet not found or not owned by this address' });
    }

    const bet = betResult.rows[0];

    // Check if market is resolved
    if (!bet.resolved) {
      return res.status(400).json({ error: 'Market is not yet resolved' });
    }

    // Check if already claimed
    if (bet.claimed) {
      return res.status(400).json({ error: 'Winnings already claimed for this bet' });
    }

    // Check if bet won
    const winningOptionId = parseInt(bet.resolution_value);
    const betOptionId = parseInt(bet.option_id);
    
    if (winningOptionId !== betOptionId) {
      return res.status(400).json({ error: 'This bet did not win' });
    }

    // Calculate payout
    const options = parseJSONBField(bet.options, 'options');
    const metadata = parseJSONBField(bet.metadata, 'metadata');
    
    // Get total volume for winning option
    const winningBetsResult = await queryDatabase(`
      SELECT COALESCE(SUM(amount), 0) as winning_volume
      FROM bets 
      WHERE market_id = $1 AND option_id = $2 AND status = 'confirmed'
    `, [bet.market_id, winningOptionId]);

    const winningVolume = parseFloat(winningBetsResult.rows[0].winning_volume);
    const totalVolume = parseFloat(bet.total_volume);
    const betAmount = parseFloat(bet.amount);

    // Calculate payout: (user's bet / total winning bets) * total market volume * 0.95 (5% platform fee)
    let payoutAmount = 0;
    if (winningVolume > 0) {
      const userShare = betAmount / winningVolume;
      payoutAmount = userShare * totalVolume * 0.95; // 5% platform fee
    }

    // Update bet with payout information
    const updateResult = await queryDatabase(`
      UPDATE bets 
      SET 
        claimed = true,
        payout_amount = $2,
        metadata = jsonb_set(
          COALESCE(metadata, '{}'), 
          '{claim_signature}', 
          to_jsonb($3::text)
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [betId, payoutAmount, transactionSignature]);

    const updatedBet = updateResult.rows[0];

    console.log(`Claim processed: Bet ${betId}, Payout: ${payoutAmount} BNB to ${address}`);

    res.json({
      bet: updatedBet,
      payout_amount: payoutAmount,
      message: 'Winnings claimed successfully',
      transaction_signature: transactionSignature
    });

  } catch (error) {
    console.error('Claim API Error:', error);
    res.status(500).json({ 
      error: 'Failed to process claim',
      details: error.message 
    });
  }
});

// Get claimable winnings for a user
app.get('/api/claimable/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const result = await queryDatabase(`
      SELECT 
        b.*,
        m.title as market_title,
        m.category,
        m.total_volume,
        m.resolution_value,
        m.options,
        m.metadata
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      WHERE b.bettor_address = $1 
        AND b.status = 'confirmed'
        AND b.claimed = false
        AND m.resolved = true
        AND b.option_id = CAST(m.resolution_value AS INTEGER)
      ORDER BY b.created_at DESC
    `, [address]);

    const claimableBets = [];
    let totalClaimable = 0;

    for (const bet of result.rows) {
      // Calculate payout for each bet
      const winningBetsResult = await queryDatabase(`
        SELECT COALESCE(SUM(amount), 0) as winning_volume
        FROM bets 
        WHERE market_id = $1 AND option_id = $2 AND status = 'confirmed'
      `, [bet.market_id, bet.option_id]);

      const winningVolume = parseFloat(winningBetsResult.rows[0].winning_volume);
      const totalVolume = parseFloat(bet.total_volume);
      const betAmount = parseFloat(bet.amount);

      let payoutAmount = 0;
      if (winningVolume > 0) {
        const userShare = betAmount / winningVolume;
        payoutAmount = userShare * totalVolume * 0.95; // 5% platform fee
      }

      if (payoutAmount > 0) {
        claimableBets.push({
          ...bet,
          options: parseJSONBField(bet.options, 'options'),
          metadata: parseJSONBField(bet.metadata, 'metadata'),
          calculated_payout: payoutAmount
        });
        totalClaimable += payoutAmount;
      }
    }

    res.json({
      claimable_bets: claimableBets,
      total_claimable: totalClaimable,
      count: claimableBets.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Claimable API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch claimable winnings',
      details: error.message 
    });
  }
});

// Admin endpoints
app.get('/api/admin/pending-markets', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!isAdminAddress(address)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
      
      return {
        ...row,
        total_volume: parseFloat(row.volume || 0),
        total_bets: parseInt(row.bet_count || 0),
        options: options,
        metadata: metadata
      };
    });

    console.log(`Admin ${address} requested ${markets.length} pending markets`);

    res.json({ 
      markets,
      count: markets.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pending markets',
      details: error.message 
    });
  }
});

app.post('/api/admin/approve-market/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.query;
    
    if (!isAdminAddress(address)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await queryDatabase(`
      UPDATE markets 
      SET 
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'under_review'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found or already processed' });
    }

    const market = result.rows[0];
    market.options = parseJSONBField(market.options, 'options');
    market.metadata = parseJSONBField(market.metadata, 'metadata');

    console.log(`Market ${id} approved by admin ${address}: "${market.title}"`);

    res.json({ 
      market,
      message: 'Market approved successfully'
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to approve market',
      details: error.message 
    });
  }
});

// Update market odds
app.post('/api/admin/update-odds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.query;
    const { odds } = req.body;
    
    if (!isAdminAddress(address)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!Array.isArray(odds) || odds.length === 0) {
      return res.status(400).json({ error: 'Invalid odds format - must be array' });
    }
    
    const parsedOdds = odds.map(o => {
      const val = typeof o === 'string' ? parseFloat(o) : o;
      if (typeof val !== 'number' || isNaN(val) || val < 1.1) {
        throw new Error(`Invalid odd value: ${o}. Must be >= 1.1`);
      }
      return val;
    });

    console.log('=== UPDATING ODDS ===');
    console.log('Market ID:', id);
    console.log('New Odds:', parsedOdds);

    // Get current metadata
    const currentResult = await queryDatabase('SELECT metadata FROM markets WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    let currentMetadata = parseJSONBField(currentResult.rows[0].metadata, 'metadata');

    // Update admin_odds
    currentMetadata.admin_odds = parsedOdds;

    console.log('Updated metadata object:', JSON.stringify(currentMetadata, null, 2));

    // Save to database
    const result = await queryDatabase(`
      UPDATE markets 
      SET 
        metadata = $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, JSON.stringify(currentMetadata)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found after update' });
    }

    const row = result.rows[0];
    const returnedMetadata = parseJSONBField(row.metadata, 'metadata');
    const returnedOptions = parseJSONBField(row.options, 'options');

    console.log('✓ Saved to DB - admin_odds:', returnedMetadata.admin_odds);

    res.json({ 
      market: {
        ...row,
        metadata: returnedMetadata,
        options: returnedOptions
      },
      message: 'Odds updated successfully'
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to update odds',
      details: error.message,
      stack: error.stack
    });
  }
});

// Resolve market (admin only)
app.post('/api/admin/resolve-market/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.query;
    const { winningOptionId, resolutionSignature } = req.body;
    
    if (!isAdminAddress(address)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (winningOptionId === undefined || !resolutionSignature) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['winningOptionId', 'resolutionSignature']
      });
    }

    // Check if market exists and is active
    const marketResult = await queryDatabase(`
      SELECT * FROM markets 
      WHERE id = $1 AND status = 'active' AND resolved = false
    `, [id]);

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found, inactive, or already resolved' });
    }

    const market = marketResult.rows[0];
    const options = parseJSONBField(market.options, 'options');

    // Validate winning option ID
    if (winningOptionId < 0 || winningOptionId >= options.length) {
      return res.status(400).json({ error: 'Invalid winning option ID' });
    }

    // Update market as resolved
    const result = await queryDatabase(`
      UPDATE markets 
      SET 
        resolved = true,
        resolution_value = $2,
        status = 'resolved',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'), 
          '{resolution_signature}', 
          to_jsonb($3::text)
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, winningOptionId.toString(), resolutionSignature]);

    const resolvedMarket = result.rows[0];
    resolvedMarket.options = parseJSONBField(resolvedMarket.options, 'options');
    resolvedMarket.metadata = parseJSONBField(resolvedMarket.metadata, 'metadata');

    // Get statistics about the resolution
    const statsResult = await queryDatabase(`
      SELECT 
        COUNT(CASE WHEN option_id = $2 THEN 1 END) as winning_bets,
        COUNT(*) as total_bets,
        COALESCE(SUM(CASE WHEN option_id = $2 THEN amount ELSE 0 END), 0) as winning_volume,
        COALESCE(SUM(amount), 0) as total_volume
      FROM bets 
      WHERE market_id = $1 AND status = 'confirmed'
    `, [id, winningOptionId]);

    const stats = statsResult.rows[0];

    console.log(`Market ${id} resolved by admin ${address}:`);
    console.log(`- Winner: Option ${winningOptionId} (${options[winningOptionId]?.name})`);
    console.log(`- Winning bets: ${stats.winning_bets}/${stats.total_bets}`);
    console.log(`- Winning volume: ${stats.winning_volume}/${stats.total_volume} BNB`);

    res.json({
      market: resolvedMarket,
      resolution_stats: {
        winning_option: options[winningOptionId],
        winning_bets: parseInt(stats.winning_bets),
        total_bets: parseInt(stats.total_bets),
        winning_volume: parseFloat(stats.winning_volume),
        total_volume: parseFloat(stats.total_volume)
      },
      message: 'Market resolved successfully'
    });

  } catch (error) {
    console.error('Resolution API Error:', error);
    res.status(500).json({ 
      error: 'Failed to resolve market',
      details: error.message 
    });
  }
});

// Image upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('Uploading image:', req.file.originalname, `${(req.file.size / 1024).toFixed(1)}KB`);

    const stream = Readable.from(req.file.buffer);

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'bnbmarket',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto:good' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('Image uploaded successfully:', result.secure_url);
            resolve(result);
          }
        }
      );
      
      stream.pipe(uploadStream);
    });

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload image',
      details: error.message 
    });
  }
});

// BSC RPC Proxy (replacing Solana proxy)
app.post('/api/bsc-proxy', async (req, res) => {
  try {
    const { method, params } = req.body;
    if (!method) return res.status(400).json({ error: 'Missing RPC method' });
    
    const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('BSC proxy error:', error);
    res.status(500).json({ error: 'BSC proxy failed', details: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('/favicon.ico', (req, res) => res.status(204).end());

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, async () => {
      console.log('BNBmarket Backend Server Started');
      console.log(`Server running on port ${PORT}`);
      console.log(`API accessible at http://localhost:${PORT}/api`);
      console.log(`Database: PostgreSQL (SSL enabled)`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Health check: GET /api/health');
      console.log('Admin endpoints: /api/admin/*');
      console.log('=====================================');
      
      try {
        await pool.query('SELECT 1');
        console.log('✓ Database connection OK');
      } catch (e) {
        console.error('✗ Database connection ERROR:', e.message);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await pool.end();
  console.log('Database connections closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await pool.end();
  console.log('Database connections closed');
  process.exit(0);
});

startServer();
