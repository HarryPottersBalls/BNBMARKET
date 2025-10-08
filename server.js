// Load environment variables from .env file
require('dotenv-flow').config();

const path = require('path');
const fs = require('fs');
// Removed log_file setup and console.log override
// const log_file = fs.createWriteStream(path.join(__dirname, 'server.log'), {flags : 'w'});
// const log_stdout = process.stdout;
// console.log = function(d) { //
//   log_file.write(util.format(d) + '\n');
//   log_stdout.write(util.format(d) + '\n');
// };



const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const util = require('util');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger');
const logger = require('./utils/logger'); // Import the logger utility
const { pool, queryDatabase } = require('./utils/database'); // Import database utilities
const { validateMarket, validateBet, validateResolveMarket, validateProvideLiquidity, validateStakeLiquidity, validateClaimLpRewards, validateGetLpRewards, validatePlaceLimitOrder, validateCancelLimitOrder, validateRegisterUser, validateGetUser, validateBlacklistIp, validateUnstakeLiquidity } = require('./middleware/validation'); // Import validation middleware
const { runAllMigrations } = require('./run-all-migrations'); // Import migration runner
const { ensureUserExists } = require('./utils/user-utils'); // Import user utility
const { checkAndFillLimitOrders } = require('./limit-order-filler'); // Import limit order filler
const { calculateLMSRProbabilities, calculateLMSRPrice, calculateLMSRCost, parseJSONBField } = require('./utils/lmsr-calculations'); // Import LMSR calculations
const rateLimit = require('express-rate-limit'); // Import rate-limit middleware
const ipBlacklistMiddleware = require('./middleware/ipBlacklist'); // Import IP blacklist middleware
const recaptchaMiddleware = require('./middleware/recaptcha'); // Import reCAPTCHA middleware
const { AppError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } = require('./errors/customErrors'); // Import custom error classes
const Decimal = require('decimal.js'); // Import decimal.js for precise calculations

// Import routes
const healthRoutes = require('./routes/health');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const { isAdminAddress } = require('./utils/admin-utils');

// Import Auto Market Generator
const AutoMarketGenerator = require('./src/services/AutoMarketGenerator');

// Polyfill fetch for Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);
app.use(ipBlacklistMiddleware); // Integrate IP blacklist middleware

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
      logger.error(`CORS not allowed from this origin: ${origin}`);
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

// Pool is now imported from './utils/database' at line 25

// Admin authorization helper function is imported from './utils/admin-utils' at line 41
// Removed duplicate declaration to avoid conflicts

// Cloudinary configuration
// Cloudinary configuration (SDK automatically uses CLOUDINARY_URL if set)
if (!process.env.CLOUDINARY_URL) {
  logger.warn('Warning: CLOUDINARY_URL environment variable is missing. Image upload will not work.');
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

// queryDatabase is now imported from './utils/database' at line 25

// Helper function to properly parse JSONB fields

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Routes

// Health check
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Responds if the app is up and running
 *     responses:
 *       200:
 *         description: App is up and running
 */
app.get('/api/health', async (req, res) => {
  const health = { status: 'ok', timestamp: new Date().toISOString(), diagnostics: {} };
  try {
    // Database check
    await pool.query('SELECT 1');
    health.diagnostics.db = 'ok';
  } catch (error) {
    health.diagnostics.db = 'error: ' + error.message;
    health.status = 'degraded';
    logger.error('Health check: Database connection failed', error);
  }

  try {
    // Cloudinary check (attempt to list resources or check credentials)
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      // A lightweight check, e.g., get account info or a very small resource
      await cloudinary.api.ping();
      health.diagnostics.cloudinary = 'ok';
    } else {
      health.diagnostics.cloudinary = 'skipped (credentials missing)';
    }
  } catch (error) {
    health.diagnostics.cloudinary = 'error: ' + error.message;
    health.status = 'degraded';
    logger.error('Health check: Cloudinary connection failed', error);
  }

  health.diagnostics.env = process.env.NODE_ENV || 'development';
  health.diagnostics.uptime = process.uptime();
  health.version = process.env.npm_package_version || 'unknown'; // Assuming package.json version

  res.status(health.status === 'ok' ? 200 : 503).json(health);
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
      totalVolume: new Decimal(volumeResult.rows[0].volume || 0).toString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      details: error.message 
    });
  }
});

// Check if address is admin (helpful for frontend)
app.get('/api/admin/check/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const isAdmin = isAdminAddress(address);
    
    res.json({
      address: address,
      isAdmin: isAdmin,
      canCreateFreeMarkets: isAdmin,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to check admin status',
      details: error.message 
    });
  }
});

// Get market creation fee
app.get('/api/creation-fee', async (req, res) => {
  try {
    const marketCreationFee = new Decimal(process.env.MARKET_CREATION_FEE || '0.0007803101839841827'); // BNB
    res.json({
      creation_fee: marketCreationFee.toString(),
      creation_fee_formatted: `${marketCreationFee.toFixed(10)} BNB`,
      description: 'Fee required to create a new prediction market',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch creation fee',
      details: error.message 
    });
  }
});

// Treasury endpoint
app.get('/api/treasury', async (req, res) => {
  try {
    // Calculate treasury: total volume + platform fees from bids + platform fees from payouts + creation fees - total payouts
    const treasuryResult = await queryDatabase(`
      SELECT 
        COALESCE(SUM(m.total_volume), 0) as total_volume,
        COALESCE(SUM(b.payout_amount), 0) as total_payouts,
        COALESCE(SUM(b.platform_fee_taken), 0) as bid_fees,
        COALESCE(SUM(b.payout_fee_taken), 0) as payout_fees,
        COUNT(DISTINCT m.id) as total_markets,
        COUNT(b.id) as total_bets,
        COUNT(DISTINCT CASE WHEN m.creator_address != $1 THEN m.id END) as non_admin_markets
      FROM markets m
      LEFT JOIN bets b ON m.id = b.market_id
    `, [process.env.ADMIN_WALLET || '0x7eCa382995Df91C250896c0EC73c9d2893F7800e']);
    
    const result = treasuryResult.rows[0];
    const totalVolume = new Decimal(result.total_volume || 0);
    const totalPayouts = new Decimal(result.total_payouts || 0);
    const bidFees = new Decimal(result.bid_fees || 0);
    const payoutFees = new Decimal(result.payout_fees || 0);
    const nonAdminMarkets = new Decimal(result.non_admin_markets || 0);
    
    // Creation fees collected
    const marketCreationFee = new Decimal(process.env.MARKET_CREATION_FEE || '0.0007803101839841827'); // BNB
    const totalCreationFees = nonAdminMarkets.times(marketCreationFee);
    
    // Total platform fees: 1% of bids + 1% of payouts
    const totalPlatformFees = bidFees.plus(payoutFees);
    
    // Treasury balance: volume + all platform fees + creation fees - payouts
    const treasury = totalVolume.plus(totalPlatformFees).plus(totalCreationFees).minus(totalPayouts);
    
    res.json({ 
      treasury: treasury.toString(),
      total_volume: totalVolume.toString(),
      total_payouts: totalPayouts.toString(),
      platform_fees: totalPlatformFees.toString(),
      bid_fees: bidFees.toString(),
      payout_fees: payoutFees.toString(),
      creation_fees: totalCreationFees.toString(),
      creation_fee_per_market: marketCreationFee.toString(),
      total_markets: parseInt(result.total_markets),
      total_bets: parseInt(result.total_bets),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Treasury API error:', error);
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
        total_volume: new Decimal(row.volume || 0).toString(),
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
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch markets',
      details: error.message
    });
  }
});

// Get single market details with full bet history
app.get('/api/markets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get market details
    const marketQuery = `
      SELECT
        m.*,
        COUNT(DISTINCT b.id) as bet_count,
        COALESCE(SUM(b.amount), 0) as volume,
        COUNT(DISTINCT b.bettor_address) as unique_bettors
      FROM markets m
      LEFT JOIN bets b ON m.id = b.market_id AND b.status = 'confirmed'
      WHERE m.id = $1
      GROUP BY m.id
    `;

    const marketResult = await queryDatabase(marketQuery, [id]);

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

    // Get bet distribution per option
    const betDistQuery = `
      SELECT
        option_id,
        COUNT(*) as bet_count,
        SUM(amount) as total_amount
      FROM bets
      WHERE market_id = $1 AND status = 'confirmed'
      GROUP BY option_id
    `;

    const betDistResult = await queryDatabase(betDistQuery, [id]);
    const betDistribution = betDistResult.rows.reduce((acc, row) => {
      acc[row.option_id] = {
        bet_count: parseInt(row.bet_count),
        total_amount: new Decimal(row.total_amount || 0).toString()
      };
      return acc;
    }, {});

    // Get liquidity providers
    const lpQuery = `
      SELECT
        provider_address,
        current_staked_amount,
        total_rewards_earned,
        staked_at
      FROM liquidity_providers
      WHERE market_id = $1 AND status = 'active'
      ORDER BY current_staked_amount DESC
    `;

    const lpResult = await queryDatabase(lpQuery, [id]);

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
      total_volume: new Decimal(row.volume || 0).toString(),
      total_bets: parseInt(row.bet_count || 0),
      unique_bettors: parseInt(row.unique_bettors || 0),
      options: options,
      metadata: metadata,
      bet_distribution: betDistribution,
      liquidity_providers: lpResult.rows.map(lp => ({
        address: lp.provider_address,
        staked_amount: new Decimal(lp.current_staked_amount || 0).toString(),
        rewards_earned: new Decimal(lp.total_rewards_earned || 0).toString(),
        staked_at: lp.staked_at
      }))
    };

    res.json({
      market,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch market details',
      details: error.message
    });
  }
});

// Get market betting history
app.get('/api/markets/:id/bets', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT
        b.*,
        u.username
      FROM bets b
      LEFT JOIN users u ON b.bettor_address = u.wallet_address
      WHERE b.market_id = $1 AND b.status = 'confirmed'
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await queryDatabase(query, [id, parseInt(limit), parseInt(offset)]);

    const bets = result.rows.map(row => ({
      id: row.id,
      market_id: row.market_id,
      bettor_address: row.bettor_address,
      username: row.username || null,
      option_id: row.option_id,
      amount: new Decimal(row.amount || 0).toString(),
      created_at: row.created_at,
      transaction_signature: row.transaction_signature,
      payout_amount: new Decimal(row.payout_amount || 0).toString(),
      claimed: row.claimed
    }));

    res.json({
      bets,
      count: bets.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch market bets',
      details: error.message
    });
  }
});

// Get user profile with stats
app.get('/api/users/:address', async (req, res) => {
  try {
    const { address } = req.params;

    // Get user info
    const userQuery = `
      SELECT * FROM users WHERE wallet_address = $1
    `;
    const userResult = await queryDatabase(userQuery, [address]);

    // Get betting stats
    const statsQuery = `
      SELECT
        COUNT(*) as total_bets,
        SUM(amount) as total_wagered,
        SUM(CASE WHEN claimed = true THEN payout_amount ELSE 0 END) as total_winnings,
        COUNT(DISTINCT market_id) as markets_participated
      FROM bets
      WHERE bettor_address = $1 AND status = 'confirmed'
    `;
    const statsResult = await queryDatabase(statsQuery, [address]);

    // Get liquidity provider stats
    const lpStatsQuery = `
      SELECT
        COUNT(DISTINCT market_id) as markets_provided,
        SUM(current_staked_amount) as total_staked,
        SUM(total_rewards_earned) as total_lp_rewards
      FROM liquidity_providers
      WHERE provider_address = $1 AND status = 'active'
    `;
    const lpStatsResult = await queryDatabase(lpStatsQuery, [address]);

    // Get recent activity
    const activityQuery = `
      SELECT
        b.id,
        b.market_id,
        b.option_id,
        b.amount,
        b.created_at,
        b.claimed,
        b.payout_amount,
        m.title as market_title
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      WHERE b.bettor_address = $1 AND b.status = 'confirmed'
      ORDER BY b.created_at DESC
      LIMIT 10
    `;
    const activityResult = await queryDatabase(activityQuery, [address]);

    const stats = statsResult.rows[0];
    const lpStats = lpStatsResult.rows[0];

    const totalWagered = new Decimal(stats.total_wagered || 0);
    const totalWinnings = new Decimal(stats.total_winnings || 0);
    const profit = totalWinnings.minus(totalWagered);
    const roi = totalWagered.gt(0) ? profit.div(totalWagered).times(100) : new Decimal(0);

    res.json({
      user: userResult.rows.length > 0 ? {
        wallet_address: userResult.rows[0].wallet_address,
        username: userResult.rows[0].username,
        created_at: userResult.rows[0].created_at
      } : {
        wallet_address: address,
        username: null,
        created_at: null
      },
      stats: {
        total_bets: parseInt(stats.total_bets || 0),
        total_wagered: totalWagered.toString(),
        total_winnings: totalWinnings.toString(),
        profit: profit.toString(),
        roi: roi.toFixed(2) + '%',
        markets_participated: parseInt(stats.markets_participated || 0),
        markets_provided_liquidity: parseInt(lpStats.markets_provided || 0),
        total_staked: new Decimal(lpStats.total_staked || 0).toString(),
        total_lp_rewards: new Decimal(lpStats.total_lp_rewards || 0).toString()
      },
      recent_activity: activityResult.rows.map(row => ({
        bet_id: row.id,
        market_id: row.market_id,
        market_title: row.market_title,
        option_id: row.option_id,
        amount: new Decimal(row.amount || 0).toString(),
        payout: new Decimal(row.payout_amount || 0).toString(),
        claimed: row.claimed,
        created_at: row.created_at
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch user profile',
      details: error.message
    });
  }
});

// Get leaderboard (top traders by profit)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { limit = 20, period = 'all' } = req.query;

    let dateFilter = '';
    if (period === '24h') {
      dateFilter = "AND b.created_at > NOW() - INTERVAL '24 hours'";
    } else if (period === '7d') {
      dateFilter = "AND b.created_at > NOW() - INTERVAL '7 days'";
    } else if (period === '30d') {
      dateFilter = "AND b.created_at > NOW() - INTERVAL '30 days'";
    }

    const query = `
      SELECT
        b.bettor_address,
        u.username,
        COUNT(*) as total_bets,
        SUM(b.amount) as total_wagered,
        SUM(CASE WHEN b.claimed = true THEN b.payout_amount ELSE 0 END) as total_winnings,
        (SUM(CASE WHEN b.claimed = true THEN b.payout_amount ELSE 0 END) - SUM(b.amount)) as profit
      FROM bets b
      LEFT JOIN users u ON b.bettor_address = u.wallet_address
      WHERE b.status = 'confirmed' ${dateFilter}
      GROUP BY b.bettor_address, u.username
      HAVING SUM(b.amount) > 0
      ORDER BY profit DESC
      LIMIT $1
    `;

    const result = await queryDatabase(query, [parseInt(limit)]);

    const leaderboard = result.rows.map((row, index) => {
      const wagered = new Decimal(row.total_wagered || 0);
      const winnings = new Decimal(row.total_winnings || 0);
      const profit = new Decimal(row.profit || 0);
      const roi = wagered.gt(0) ? profit.div(wagered).times(100) : new Decimal(0);

      return {
        rank: index + 1,
        address: row.bettor_address,
        username: row.username || null,
        total_bets: parseInt(row.total_bets),
        total_wagered: wagered.toString(),
        total_winnings: winnings.toString(),
        profit: profit.toString(),
        roi: roi.toFixed(2) + '%'
      };
    });

    res.json({
      leaderboard,
      period,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      details: error.message
    });
  }
});

// Get LMSR probabilities for a market
app.get('/api/markets/:id/probabilities', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get market
    const marketResult = await queryDatabase('SELECT * FROM markets WHERE id = $1', [id]);
    if (marketResult.rows.length === 0) {
      throw new NotFoundError('Market not found');
    }
    
    const market = marketResult.rows[0];
    
    // Parse options
    let options;
    try {
      options = typeof market.options === 'string' ? JSON.parse(market.options) : market.options;
    } catch (e) {
      throw new BadRequestError('Invalid market options format');
    }
    
    // Get bets
    const betsResult = await queryDatabase(`
      SELECT option_id, amount FROM bets 
      WHERE market_id = $1 AND status = 'confirmed'
    `, [id]);
    
    const bets = betsResult.rows;
    const numOutcomes = options.length;
    
    // Calculate LMSR probabilities
    const probabilities = calculateLMSRProbabilities(market, bets, numOutcomes);
    
    // Calculate volume per outcome
    const outcomeVolumes = Array(numOutcomes).fill(new Decimal(0));
    bets.forEach(bet => {
      if (bet.option_id < numOutcomes) {
        outcomeVolumes[bet.option_id] = outcomeVolumes[bet.option_id].plus(new Decimal(bet.amount || 0));
      }
    });
    
    const totalVolume = outcomeVolumes.reduce((sum, vol) => sum.plus(vol), new Decimal(0));
    
    res.json({
      market_id: parseInt(id),
      probabilities: probabilities.map(prob => new Decimal(prob).times(100).toDecimalPlaces(2).toString()), // Convert to percentages
      prices: probabilities.map(p => new Decimal(p).toString()), // Raw probabilities for calculations
      volumes: outcomeVolumes.map(v => v.toString()),
      total_volume: totalVolume.toString(),
      num_outcomes: numOutcomes
    });
    
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to calculate probabilities',
      details: error.message 
    });
  }
});

// Create new market
app.post('/api/markets', validateMarket, async (req, res) => {
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
      marketImage,
      liquidityParam = 10 // Default value, will be validated by Joi
    } = req.body;

    const creatorAddr = creator_address || creatorAddress;
    const isAdmin = isAdminAddress(creatorAddr);

    // Ensure creator user exists
    await ensureUserExists(pool, creatorAddr);

    logger.info('Market creation request:', {
      creatorAddr: creatorAddr,
      isAdmin: isAdmin,
      title: title,
      autoApprove: req.body.autoApprove,
      liquidityParam: liquidityParam
    });

    if (!title || !creatorAddr) {
      throw new BadRequestError('Missing required fields: title, creator_address or creatorAddress');
    }

    if (title.length < 10) {
      throw new BadRequestError('Title must be at least 10 characters long');
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

    // Initialize metadata with LMSR settings
    const metadata = {
      marketImage: marketImage || null,
      use_lmsr: true, // Enable LMSR for this market
      liquidity_param: liquidityParam, // Use provided or default liquidity parameter
      admin_odds: processedOptions.map(() => null) // Keep for backward compatibility
    };

    let marketInsert;
    if (isAdmin) {
      logger.info('Creating admin market (no fees required)');
      // Admin users can create markets without fees or signatures
      const status = req.body.autoApprove ? 'active' : 'under_review'; // Admin markets are auto-approved
      
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
        new Decimal(initialLiquidity || 0).toString(), // Admin can set any liquidity, including 0
        JSON.stringify(processedOptions),
        creationSignature || 'admin_created', // Admin signature optional
        status,
        JSON.stringify({
          ...metadata,
          admin_created: true,
          creation_fee: new Decimal(0).toString(), // No fee for admin
          creation_fee_paid: true
        })
      ]);
      
      logger.info('Admin market created successfully:', marketInsert.rows[0].id, 'Status:', marketInsert.rows[0].status);
    } else {
      logger.info('Non-admin market created successfully:', marketInsert.rows[0].id, 'Status:', marketInsert.rows[0].status);
      logger.info('Creating non-admin market (fees required)');
      // Market creation fee for non-admin users
      let marketCreationFee = new Decimal(process.env.MARKET_CREATION_FEE || '0.0007803101839841827'); // Default BNB fee
      const minInitialLiquidity = new Decimal(process.env.MIN_INITIAL_LIQUIDITY || '0.1');
      const feeWaiverThreshold = new Decimal(process.env.FEE_WAIVER_THRESHOLD || '1.0'); // If initialLiquidity >= 1 BNB, fee is waived
      let creationFeePaid = true;

      const providedInitialLiquidity = new Decimal(initialLiquidity || 0);

      if (providedInitialLiquidity.greaterThanOrEqualTo(feeWaiverThreshold)) {
        marketCreationFee = new Decimal(0); // Waive fee
        creationFeePaid = false; // No fee actually paid
        logger.info(`Market ${title} creation fee waived due to high initial liquidity (${providedInitialLiquidity.toString()} BNB)`);
      } else if (providedInitialLiquidity.lessThan(minInitialLiquidity)) {
        throw new BadRequestError(`A minimum initial liquidity of ${minInitialLiquidity.toString()} BNB is required for non-admin users.`);
      }
      
      // Ensure provided liquidity covers the fee
      if (providedInitialLiquidity.lessThan(marketCreationFee)) {
        throw new BadRequestError(`Provided initial liquidity (${providedInitialLiquidity.toString()} BNB) is less than the market creation fee (${marketCreationFee.toString()} BNB).`);
      }

      const netInitialLiquidity = providedInitialLiquidity.minus(marketCreationFee);

      if (!creationSignature) {
        throw new BadRequestError('A creation signature is required for non-admin users.');
      }
      
      marketInsert = await queryDatabase(`
        INSERT INTO markets (
          title, description, category, creator_address, 
          end_date, initial_liquidity, options, creation_signature, status, metadata, platform_fees_collected
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING *
      `, [
        title, 
        description, 
        category, 
        creatorAddr, 
        endDate ? new Date(endDate) : null,
        netInitialLiquidity.toString(),
        JSON.stringify(processedOptions),
        creationSignature,
        'under_review',
        JSON.stringify({
          ...metadata,
          admin_created: false,
          creation_fee: marketCreationFee.toString(),
          creation_fee_paid: creationFeePaid
        }),
        marketCreationFee.toString() // Add creation fee to platform_fees_collected
      ]);
    }

    const market = marketInsert.rows[0];
    market.options = parseJSONBField(market.options, 'options');
    market.metadata = parseJSONBField(market.metadata, 'metadata');
    
    res.status(201).json({ market });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to create market',
      details: error.message 
    });
  }
});

// Place a bet
app.post('/api/bets', validateBet, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN'); // Start transaction

    const {
      marketId,
      bettorAddress,
      optionId,
      amount,
      transactionSignature,
      maxPriceImpact // New parameter for front-running mitigation
    } = req.body;

    if (!marketId || !bettorAddress || optionId === undefined || !amount || !transactionSignature) {
      throw new BadRequestError('Missing required fields: marketId, bettorAddress, optionId, amount, transactionSignature');
    }

    const marketResult = await client.query(
      'SELECT id, status, options, metadata FROM markets WHERE id = $1 AND status = $2 FOR UPDATE', // Lock market row
      [marketId, 'active']
    );

    if (marketResult.rows.length === 0) {
      throw new NotFoundError('Market not found or inactive');
    }
    const market = marketResult.rows[0];
    const options = parseJSONBField(market.options, 'options');
    const numOutcomes = options.length;

    // Ensure bettor user exists
    await ensureUserExists(client, bettorAddress);

    const existingBet = await client.query(
      'SELECT id FROM bets WHERE transaction_signature = $1', 
      [transactionSignature]
    );

    if (existingBet.rows.length > 0) {
      throw new ConflictError('Bet already recorded for this transaction');
    }

    // --- Front-running Mitigation: Calculate price impact ---
    // Get current bets for LMSR calculation
    const currentBetsResult = await client.query(
      'SELECT option_id, amount FROM bets WHERE market_id = $1 AND status = \'confirmed\'',
      [marketId]
    );
    const currentBets = currentBetsResult.rows;

    // Calculate price before the new bet
    const priceBeforeBet = new Decimal(calculateLMSRPrice(market, currentBets, optionId, numOutcomes));

    // Simulate the new bet to calculate price after
    const simulatedBets = [...currentBets, { option_id: optionId, amount: amount }];
    const priceAfterBet = new Decimal(calculateLMSRPrice(market, simulatedBets, optionId, numOutcomes));

    // Calculate actual price impact
    const actualPriceImpact = priceAfterBet.minus(priceBeforeBet).dividedBy(priceBeforeBet).abs();

    if (maxPriceImpact && actualPriceImpact.greaterThan(new Decimal(maxPriceImpact))) {
      throw new BadRequestError(`Price impact (${actualPriceImpact.times(100).toDecimalPlaces(2).toString()}%) exceeds maximum allowed (${new Decimal(maxPriceImpact).times(100).toDecimalPlaces(2).toString()}%)`);
    }
    // --- End Front-running Mitigation ---

    // Calculate platform fee (1% of bid amount)
    const bidAmount = new Decimal(amount);
    const platformFeeFromBid = bidAmount.times(0.01);
    const netBidAmount = bidAmount.minus(platformFeeFromBid);

    // Allocate a portion of the platform fee to LP providers
    const lpFeeAllocationPercentage = new Decimal(process.env.LP_FEE_ALLOCATION_PERCENTAGE || '0.5'); // Default 50%
    const lpFeeAllocation = platformFeeFromBid.times(lpFeeAllocationPercentage);
    const platformFeeRetained = platformFeeFromBid.minus(lpFeeAllocation);

    const result = await client.query(`
      INSERT INTO bets (market_id, bettor_address, option_id, amount, transaction_signature, platform_fee_taken) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `, [marketId, bettorAddress, parseInt(optionId), netBidAmount.toString(), transactionSignature, platformFeeFromBid.toString()]); // Store total fee here

    await client.query(`
      UPDATE markets 
      SET 
        total_volume = total_volume + $1,
        total_bets = total_bets + 1,
        platform_fees_collected = platform_fees_collected + $2,
        total_lp_fees_accrued = total_lp_fees_accrued + $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [netBidAmount.toString(), platformFeeRetained.toString(), lpFeeAllocation.toString(), marketId]);

    // --- LMSR Optimization: Update cached outcomeTotals in market metadata ---
    // Fetch all current bets for the market to recalculate totals
    const allMarketBetsResult = await client.query(
      'SELECT option_id, amount FROM bets WHERE market_id = $1 AND status = \'confirmed\'',
      [marketId]
    );
    const allMarketBets = allMarketBetsResult.rows;

    // Recalculate outcomeTotals
    const newOutcomeTotals = Array(numOutcomes).fill(0);
    allMarketBets.forEach(b => {
      if (b.option_id < numOutcomes) {
        newOutcomeTotals[b.option_id] += parseFloat(b.amount || 0);
      }
    });

    // Update market metadata with cached outcome totals
    await client.query(`
      UPDATE markets
      SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{cachedOutcomeTotals}', $1::jsonb)
      WHERE id = $2
    `, [JSON.stringify(newOutcomeTotals), marketId]);
    logger.info(`Market ${marketId}: Cached outcome totals updated.`);
    // --- End LMSR Optimization ---

    // --- Limit Order Filling: Check and fill pending limit orders ---
    // Pass the client to the filler to ensure it uses the same transaction
    await checkAndFillLimitOrders(marketId, client);
    // --- End Limit Order Filling ---

    await client.query('COMMIT'); // Commit transaction

    const bet = result.rows[0];
    logger.info('Bet placed:', bet.id, `${amount} BNB on market ${marketId}`);

    res.status(201).json({ 
      bet,
      message: 'Bet placed successfully'
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK'); // Rollback transaction on error
    }
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to place bet',
      details: error.message 
    });
  } finally {
    if (client) {
      client.release(); // Release client back to pool
    }
  }
});

// Get bets
app.get('/api/bets', async (req, res) => {
  try {
    const { address, market_id, marketId, limit = 50, offset = 0 } = req.query;
    const actualMarketId = market_id || marketId;
    
    if (!address && !actualMarketId) {
      throw new BadRequestError('Either address or market_id parameter required');
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
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bets',
      details: error.message 
    });
  }
});

// Claim winnings from resolved markets
app.post('/api/claim/:betId', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN'); // Start transaction

    const { betId } = req.params;
    const { address, transactionSignature } = req.body;

    // Ensure user exists
    await ensureUserExists(client, address);

    if (!address || !transactionSignature) {
      throw new BadRequestError('Missing required fields: address, transactionSignature');
    }

    // Get bet details with market information
    const betResult = await client.query(`
      SELECT 
        b.*,
        m.title as market_title,
        m.resolved,
        m.resolution_value,
        m.status as market_status,
        m.options,
        m.total_volume,
        m.metadata,
        m.id as market_id_from_market
      FROM bets b
      JOIN markets m ON b.market_id = m.id
      WHERE b.id = $1 AND b.bettor_address = $2 FOR UPDATE
    `, [betId, address]);

    if (betResult.rows.length === 0) {
      throw new NotFoundError('Bet not found or not owned by this address');
    }

    const bet = betResult.rows[0];
    const marketId = bet.market_id_from_market; // Get marketId from the joined market table

    // Check if market is resolved
    if (!bet.resolved) {
      throw new BadRequestError('Market is not yet resolved');
    }

    // Check if already claimed
    if (bet.claimed) {
      throw new BadRequestError('Winnings already claimed for this bet');
    }

    // Check if bet won
    const winningOptionId = parseInt(bet.resolution_value);
    const betOptionId = parseInt(bet.option_id);
    
    if (winningOptionId !== betOptionId) {
      throw new BadRequestError('This bet did not win');
    }

    // Calculate payout
    const options = parseJSONBField(bet.options, 'options');
    const metadata = parseJSONBField(bet.metadata, 'metadata');
    
    // Get total volume for winning option
    const winningBetsResult = await client.query(`
      SELECT COALESCE(SUM(amount), 0) as winning_volume
      FROM bets 
      WHERE market_id = $1 AND option_id = $2 AND status = 'confirmed'
    `, [bet.market_id, winningOptionId]);

    const winningVolume = new Decimal(winningBetsResult.rows[0].winning_volume || 0);
    const totalVolume = new Decimal(bet.total_volume);
    const betAmount = new Decimal(bet.amount);

    // Calculate payout: (user's bet / total winning bets) * total market volume
    let grossPayoutAmount = new Decimal(0);
    let payoutFee = new Decimal(0);
    let netPayoutAmount = new Decimal(0);
    
    if (winningVolume.greaterThan(0)) {
      const userShare = betAmount.dividedBy(winningVolume);
      grossPayoutAmount = userShare.times(totalVolume);
      
      // Take 1% platform fee on payouts
      payoutFee = grossPayoutAmount.times(0.01); // Total payout fee
      netPayoutAmount = grossPayoutAmount.minus(payoutFee);
    }

    // Allocate a portion of the payout fee to LP providers
    const lpFeeAllocationPercentage = new Decimal(process.env.LP_FEE_ALLOCATION_PERCENTAGE || '0.5'); // Default 50%
    const lpPayoutFeeAllocation = payoutFee.times(lpFeeAllocationPercentage);
    const platformPayoutFeeRetained = payoutFee.minus(lpPayoutFeeAllocation);

    // Update bet with payout information
    const updateResult = await client.query(`
      UPDATE bets 
      SET 
        claimed = true,
        payout_amount = $2,
        payout_fee_taken = $3,
        metadata = jsonb_set(
          COALESCE(metadata, '{}'), 
          '{claim_signature}', 
          to_jsonb($4::text)
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [betId, netPayoutAmount.toString(), payoutFee.toString(), transactionSignature]); // Store total payout fee here

    // Update market platform fees collected and LP fees accrued
    await client.query(`
      UPDATE markets 
      SET platform_fees_collected = platform_fees_collected + $1,
          total_lp_fees_accrued = total_lp_fees_accrued + $2
      WHERE id = $3
    `, [platformPayoutFeeRetained.toString(), lpPayoutFeeAllocation.toString(), marketId]);

    await client.query('COMMIT'); // Commit transaction

    const updatedBet = updateResult.rows[0];

    logger.info(`Claim processed: Bet ${betId}, Gross Payout: ${grossPayoutAmount.toString()} BNB, Fee: ${payoutFee.toString()} BNB, Net Payout: ${netPayoutAmount.toString()} BNB to ${address}`);

    res.json({
      bet: updatedBet,
      payout_amount: netPayoutAmount.toString(),
      gross_payout: grossPayoutAmount.toString(),
      payout_fee: payoutFee.toString(),
      message: 'Winnings claimed successfully',
      transaction_signature: transactionSignature
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK'); // Rollback transaction on error
    }
    logger.error('Claim API Error:', error);
    res.status(500).json({ 
      error: 'Failed to process claim',
      details: error.message 
    });
  } finally {
    if (client) {
      client.release(); // Release client back to pool
    }
  }
});

// Get claimable winnings for a user
app.get('/api/claimable/:address', async (req, res) => {
  try {
    const { address } = req.params;

    // Ensure user exists
    await ensureUserExists(pool, address);

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
    let totalClaimable = new Decimal(0);

    for (const bet of result.rows) {
      // Calculate payout for each bet
      const winningBetsResult = await queryDatabase(`
        SELECT COALESCE(SUM(amount), 0) as winning_volume
        FROM bets 
        WHERE market_id = $1 AND option_id = $2 AND status = 'confirmed'
      `, [bet.market_id, bet.option_id]);

      const winningVolume = new Decimal(winningBetsResult.rows[0].winning_volume || 0);
      const totalVolume = new Decimal(bet.total_volume);
      const betAmount = new Decimal(bet.amount);

      let grossPayoutAmount = new Decimal(0);
      let payoutFee = new Decimal(0);
      let netPayoutAmount = new Decimal(0);
      
      if (winningVolume.greaterThan(0)) {
        const userShare = betAmount.dividedBy(winningVolume);
        grossPayoutAmount = userShare.times(totalVolume);
        
        // Take 1% platform fee on payouts
        payoutFee = grossPayoutAmount.times(0.01);
        netPayoutAmount = grossPayoutAmount.minus(payoutFee);
      }

      if (netPayoutAmount.greaterThan(0)) {
        claimableBets.push({
          ...bet,
          options: parseJSONBField(bet.options, 'options'),
          metadata: parseJSONBField(bet.metadata, 'metadata'),
          calculated_payout: netPayoutAmount.toString(),
          gross_payout: grossPayoutAmount.toString(),
          payout_fee: payoutFee.toString()
        });
        totalClaimable = totalClaimable.plus(netPayoutAmount);
      }
    }

    res.json({
      claimable_bets: claimableBets,
      total_claimable: totalClaimable.toString(),
      count: claimableBets.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Claimable API Error:', error);
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
      throw new ForbiddenError('Admin access required');
    }

    // Get pending markets (excluding admin-created ones which should auto-approve)
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
      
      // Process options to ensure proper image handling
      const processedOptions = options.map(option => ({
        name: option.name || 'Unnamed Option',
        image: option.image || null, // null if no image
        hasImage: Boolean(option.image)
      }));
      
      return {
        ...row,
        total_volume: new Decimal(row.volume || 0).toString(),
        total_bets: parseInt(row.bet_count || 0),
        options: processedOptions,
        metadata: {
          ...metadata,
          hasOptionImages: processedOptions.some(opt => opt.hasImage),
          totalOptions: processedOptions.length
        },
        // Additional info for admin review
        is_admin_created: Boolean(metadata.admin_created),
        creation_fee_paid: Boolean(metadata.creation_fee_paid),
        market_image: metadata.marketImage || row.market_image
      };
    });

    logger.info(`Admin ${address} requested ${markets.length} pending markets for review`);

    res.json({ 
      markets,
      count: markets.length,
      timestamp: new Date().toISOString(),
      note: 'Admin-created markets are auto-approved and do not appear here'
    });
  } catch (error) {
    logger.error('API Error:', error);
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
      throw new ForbiddenError('Admin access required');
    }

    logger.info(`Attempting to approve market ${id}. Querying for status 'under_review'.`);
    const result = await queryDatabase(`
      UPDATE markets 
      SET 
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'under_review'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Market not found or already processed');
    }

    const market = result.rows[0];
    market.options = parseJSONBField(market.options, 'options');
    market.metadata = parseJSONBField(market.metadata, 'metadata');

    logger.info(`Market ${id} approved by admin ${address}: "${market.title}"`);

    res.json({ 
      market,
      message: 'Market approved successfully'
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to approve market',
      details: error.message 
    });
  }
});

// Auto-approve admin markets that are stuck in review
app.post('/api/admin/auto-approve-admin-markets', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!isAdminAddress(address)) {
      throw new ForbiddenError('Admin access required');
    }

    // Find admin markets that are still under review
    const result = await queryDatabase(`
      UPDATE markets 
      SET 
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE status = 'under_review'
        AND (metadata->>'admin_created' = 'true' 
             OR creator_address = ANY($1))
      RETURNING id, title, creator_address
    `, [[
      process.env.ADMIN_WALLET || '0x7eCa382995Df91C250896c0EC73c9d2893F7800e',
      '0x7eCa382995Df91C250896c0EC73c9d2893F7800e'
    ]]);

    const approvedMarkets = result.rows;

    logger.info(`Auto-approved ${approvedMarkets.length} admin markets by ${address}`);

    res.json({ 
      approved_markets: approvedMarkets,
      count: approvedMarkets.length,
      message: 'Admin markets auto-approved successfully'
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to auto-approve admin markets',
      details: error.message 
    });
  }
});

// Reject market (admin only)
app.post('/api/admin/reject-market/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.query;
    const { reason } = req.body;
    
    if (!isAdminAddress(address)) {
      throw new ForbiddenError('Admin access required');
    }

    logger.info(`Attempting to reject market ${id}. Querying for status 'under_review'.`);
    const currentMarketResult = await queryDatabase('SELECT status FROM markets WHERE id = $1', [id]);
    if (currentMarketResult.rows.length > 0) {
      logger.info(`Market ${id} current status: ${currentMarketResult.rows[0].status}`);
    } else {
      logger.info(`Market ${id} not found before rejection attempt.`);
    }

    const result = await queryDatabase(`
      UPDATE markets 
      SET 
        status = 'rejected',
        metadata = jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(metadata, '{}'), 
              '{rejection_reason}', 
              to_jsonb($2::text)
            ),
            '{rejected_by}', 
            to_jsonb($3::text)
          ),
          '{rejected_at}', 
          to_jsonb($4::text)
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'under_review'
      RETURNING *
    `, [id, reason || 'No reason provided', address, new Date().toISOString()]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Market not found or already processed');
    }

    const market = result.rows[0];
    market.options = parseJSONBField(market.options, 'options');
    market.metadata = parseJSONBField(market.metadata, 'metadata');

    logger.info(`Market ${id} rejected by admin ${address}: "${market.title}" - Reason: ${reason}`);

    res.json({ 
      market,
      message: 'Market rejected successfully',
      reason: reason
    });
  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to reject market',
      details: error.message 
    });
  }
});

// Admin: Blacklist an IP address
app.post('/api/admin/blacklist-ip', validateBlacklistIp, async (req, res) => {
  try {
    const { address } = req.query; // Admin's address for authorization
    const { ipAddress, reason, expiresAt } = req.body;

    if (!isAdminAddress(address)) {
      throw new ForbiddenError('Admin access required');
    }

    // Check if IP already exists in blacklist
    const existingBlacklistEntry = await queryDatabase(
      'SELECT * FROM ip_blacklist WHERE ip_address = $1',
      [ipAddress]
    );

    let blacklistEntry;
    if (existingBlacklistEntry.rows.length > 0) {
      // Update existing entry
      blacklistEntry = await queryDatabase(`
        UPDATE ip_blacklist
        SET reason = $1,
            expires_at = $2,
            blacklisted_at = CURRENT_TIMESTAMP
        WHERE ip_address = $3
        RETURNING *
      `, [reason || existingBlacklistEntry.rows[0].reason, expiresAt, ipAddress]);
      logger.info(`Updated blacklist entry for IP ${ipAddress} by admin ${address}. Reason: ${reason || 'N/A'}`);
    } else {
      // Insert new entry
      blacklistEntry = await queryDatabase(`
        INSERT INTO ip_blacklist (ip_address, reason, expires_at)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [ipAddress, reason, expiresAt]);
      logger.info(`Blacklisted IP ${ipAddress} by admin ${address}. Reason: ${reason || 'N/A'}`);
    }

    res.status(200).json({
      message: 'IP address blacklisted successfully',
      entry: blacklistEntry.rows[0]
    });

  } catch (error) {
    logger.error('Blacklist IP API Error:', error);
    res.status(500).json({
      error: 'Failed to blacklist IP address',
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
      throw new ForbiddenError('Admin access required');
    }

    if (!Array.isArray(odds) || odds.length === 0) {
      throw new BadRequestError('Invalid odds format - must be array');
    }
    
    const parsedOdds = odds.map(o => {
      const val = new Decimal(o);
      if (val.isNaN() || val.lessThan(1.1)) {
        throw new BadRequestError(`Invalid odd value: ${o}. Must be >= 1.1`);
      }
      return val.toString();
    });

    logger.info('=== UPDATING ODDS ===');
    logger.info('Market ID:', id);
    logger.info('New Odds:', parsedOdds);

    // Get current metadata
    const currentResult = await queryDatabase('SELECT metadata FROM markets WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      throw new NotFoundError('Market not found');
    }

    let currentMetadata = parseJSONBField(currentResult.rows[0].metadata, 'metadata');

    // Update admin_odds
    currentMetadata.admin_odds = parsedOdds;

    logger.info('Updated metadata object:', JSON.stringify(currentMetadata, null, 2));

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
      throw new NotFoundError('Market not found after update');
    }

    const row = result.rows[0];
    const returnedMetadata = parseJSONBField(row.metadata, 'metadata');
    const returnedOptions = parseJSONBField(row.options, 'options');

    logger.info('✓ Saved to DB - admin_odds:', returnedMetadata.admin_odds);

    res.json({ 
      market: {
        ...row,
        metadata: returnedMetadata,
        options: returnedOptions
      },
      message: 'Odds updated successfully'
    });

  } catch (error) {
    logger.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to update odds',
      details: error.message,
      stack: error.stack
    });
  }
});

// Resolve market (admin only)
app.post('/api/admin/resolve-market/:id', validateResolveMarket, async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.query;
    const { winningOptionId, resolutionSignature, resolutionSource } = req.body;
    
    if (!isAdminAddress(address)) {
      throw new ForbiddenError('Admin access required');
    }

    if (winningOptionId === undefined || !resolutionSignature) {
      throw new BadRequestError('Missing required fields: winningOptionId, resolutionSignature');
    }

    // Check if market exists and is active
    const marketResult = await queryDatabase(`
      SELECT * FROM markets 
      WHERE id = $1 AND status = 'active' AND resolved = false
    `, [id]);

    if (marketResult.rows.length === 0) {
      throw new NotFoundError('Market not found, inactive, or already resolved');
    }

    const market = marketResult.rows[0];
    const options = parseJSONBField(market.options, 'options');

    // Validate winning option ID
    if (winningOptionId < 0 || winningOptionId >= options.length) {
      throw new BadRequestError('Invalid winning option ID');
    }

    // Update market as resolved
    const result = await queryDatabase(`
      UPDATE markets 
      SET 
        resolved = true,
        resolution_value = $2,
        status = 'resolved',
        metadata = jsonb_set(
          jsonb_set(
            COALESCE(metadata, '{}'), 
            '{resolution_signature}', 
            to_jsonb($3::text)
          ),
          '{resolution_source}', 
          to_jsonb($4::text)
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, winningOptionId.toString(), resolutionSignature, resolutionSource || null]);

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

    logger.info(`Market ${id} resolved by admin ${address}:`);
    logger.info(`- Winner: Option ${winningOptionId} (${options[winningOptionId]?.name})`);
    logger.info(`- Winning bets: ${stats.winning_bets}/${stats.total_bets}`);
    logger.info(`- Winning volume: ${new Decimal(stats.winning_volume || 0).toString()}/${new Decimal(stats.total_volume || 0).toString()} BNB`);
    logger.info(`- Resolution Source: ${resolutionSource || 'N/A'}`);

    res.json({
      market: resolvedMarket,
      resolution_stats: {
        winning_option: options[winningOptionId],
        winning_bets: parseInt(stats.winning_bets),
        total_bets: parseInt(stats.total_bets),
        winning_volume: new Decimal(stats.winning_volume || 0).toString(),
        total_volume: new Decimal(stats.total_volume || 0).toString()
      },
      message: 'Market resolved successfully'
    });

  } catch (error) {
    logger.error('Resolution API Error:', error);
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
      throw new BadRequestError('No image file provided');
    }

    logger.info('Uploading image:', req.file.originalname, `${(req.file.size / 1024).toFixed(1)}KB`);

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
            logger.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            logger.info('Image uploaded successfully:', result.secure_url);
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
    logger.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload image',
      details: error.message 
    });
  }
});

// Stake liquidity to a market
app.post('/api/markets/:id/stake-liquidity', validateStakeLiquidity, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { id: marketId } = req.params;
    const { providerAddress, amount } = req.body;
    const stakeAmount = new Decimal(amount);

    // Ensure provider user exists
    await ensureUserExists(client, providerAddress);

    // Check if market exists and is active
    const marketResult = await client.query(
      'SELECT id, status FROM markets WHERE id = $1 AND status = \'active\' FOR UPDATE',
      [marketId]
    );
    if (marketResult.rows.length === 0) {
      throw new NotFoundError('Market not found or inactive');
    }

    // Check if provider already exists for this market
    const existingLpResult = await client.query(
      'SELECT * FROM liquidity_providers WHERE market_id = $1 AND provider_address = $2 FOR UPDATE',
      [marketId, providerAddress]
    );

    let lpRecord;
    if (existingLpResult.rows.length > 0) {
      // Update existing liquidity provision
      lpRecord = await client.query(`
        UPDATE liquidity_providers
        SET current_staked_amount = current_staked_amount + $1,
            total_provided_amount = total_provided_amount + $1,
            staked_at = CURRENT_TIMESTAMP,
            status = 'active'
        WHERE market_id = $2 AND provider_address = $3
        RETURNING *
      `, [stakeAmount.toString(), marketId, providerAddress]);
      logger.info(`Updated staked liquidity for market ${marketId} by ${providerAddress}: +${stakeAmount.toString()} BNB`);
    } else {
      // Insert new liquidity provision
      lpRecord = await client.query(`
        INSERT INTO liquidity_providers (market_id, provider_address, current_staked_amount, total_provided_amount)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [marketId, providerAddress, stakeAmount.toString(), stakeAmount.toString()]);
      logger.info(`New liquidity staked to market ${marketId} by ${providerAddress}: ${stakeAmount.toString()} BNB`);
    }

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Liquidity staked successfully',
      lpRecord: lpRecord.rows[0]
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    logger.error('Stake Liquidity API Error:', error);
    res.status(500).json({
      error: 'Failed to stake liquidity',
      details: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Get LP rewards for a market
app.get('/api/markets/:id/lp-rewards', validateGetLpRewards, async (req, res) => {
  try {
    const { id: marketId } = req.params;
    const { providerAddress } = req.query;

    // Get market's total LP fees accrued
    const marketResult = await queryDatabase(
      'SELECT total_lp_fees_accrued FROM markets WHERE id = $1',
      [marketId]
    );
    if (marketResult.rows.length === 0) {
      throw new NotFoundError('Market not found');
    }
    const totalLpFeesAccrued = new Decimal(marketResult.rows[0].total_lp_fees_accrued || 0);

    // Get total staked amount in the market
    const totalStakedResult = await queryDatabase(
      'SELECT COALESCE(SUM(amount_staked), 0) as total_staked FROM liquidity_providers WHERE market_id = $1',
      [marketId]
    );
    const totalStaked = new Decimal(totalStakedResult.rows[0].total_staked || 0);

    // Get provider's staked amount
    const providerStakedResult = await queryDatabase(
      'SELECT amount_staked, total_rewards_earned FROM liquidity_providers WHERE market_id = $1 AND provider_address = $2',
      [marketId, providerAddress]
    );
    if (providerStakedResult.rows.length === 0) {
      throw new NotFoundError('Liquidity provider not found for this market');
    }
    const providerStaked = new Decimal(providerStakedResult.rows[0].amount_staked);
    const totalRewardsEarned = new Decimal(providerStakedResult.rows[0].total_rewards_earned);

    let currentAccruedRewards = new Decimal(0);
    if (totalStaked.greaterThan(0)) {
      // Calculate provider's share of the total LP fees accrued since last claim
      // This is a simplified calculation. A more robust system would track fees per block/period.
      const providerShare = providerStaked.dividedBy(totalStaked);
      currentAccruedRewards = (totalLpFeesAccrued.times(providerShare)).minus(totalRewardsEarned);
    }

    res.status(200).json({
      marketId: parseInt(marketId),
      providerAddress: providerAddress,
      amountStaked: providerStaked.toString(),
      totalLpFeesAccrued: totalLpFeesAccrued.toString(),
      totalStakedInMarket: totalStaked.toString(),
      currentAccruedRewards: Decimal.max(0, currentAccruedRewards).toString(), // Ensure non-negative
      message: 'LP rewards calculated successfully'
    });

  } catch (error) {
    logger.error('Get LP Rewards API Error:', error);
    res.status(500).json({
      error: 'Failed to get LP rewards',
      details: error.message
    });
  }
});

// Claim LP rewards for a market
app.post('/api/markets/:id/claim-lp-rewards', validateClaimLpRewards, async (req, res) => {
  try {
    const { id: marketId } = req.params;
    const { providerAddress, transactionSignature } = req.body;

    // Ensure provider user exists
    await ensureUserExists(pool, providerAddress);

    // Check if market exists
    const marketResult = await queryDatabase(
      'SELECT total_lp_fees_accrued FROM markets WHERE id = $1',
      [marketId]
    );
    if (marketResult.rows.length === 0) {
      throw new NotFoundError('Market not found');
    }
    const totalLpFeesAccrued = new Decimal(marketResult.rows[0].total_lp_fees_accrued || 0);

    // Get total staked amount in the market
    const totalStakedResult = await queryDatabase(
      'SELECT COALESCE(SUM(amount_staked), 0) as total_staked FROM liquidity_providers WHERE market_id = $1',
      [marketId]
    );
    const totalStaked = new Decimal(totalStakedResult.rows[0].total_staked || 0);

    // Get provider's staked amount and rewards earned
    const providerLpRecordResult = await queryDatabase(
      'SELECT amount_staked, total_rewards_earned FROM liquidity_providers WHERE market_id = $1 AND provider_address = $2',
      [marketId, providerAddress]
    );
    if (providerLpRecordResult.rows.length === 0) {
      throw new NotFoundError('Liquidity provider not found for this market');
    }
    const providerStaked = new Decimal(providerLpRecordResult.rows[0].amount_staked);
    const totalRewardsEarned = new Decimal(providerLpRecordResult.rows[0].total_rewards_earned);

    let claimableRewards = new Decimal(0);
    if (totalStaked.greaterThan(0)) {
      const providerShare = providerStaked.dividedBy(totalStaked);
      claimableRewards = (totalLpFeesAccrued.times(providerShare)).minus(totalRewardsEarned);
    }

    if (claimableRewards.lessThanOrEqualTo(0)) {
      throw new BadRequestError('No claimable rewards available');
    }

    // Update liquidity_providers record
    await queryDatabase(`
      UPDATE liquidity_providers
      SET total_rewards_earned = total_rewards_earned + $1,
          last_reward_claim_at = CURRENT_TIMESTAMP
      WHERE market_id = $2 AND provider_address = $3
    `, [claimableRewards.toString(), marketId, providerAddress]);

    logger.info(`LP rewards claimed for market ${marketId} by ${providerAddress}: ${claimableRewards.toString()} BNB`);

    res.status(200).json({
      message: 'LP rewards claimed successfully',
      marketId: parseInt(marketId),
      providerAddress: providerAddress,
      claimedAmount: claimableRewards.toString(),
      transactionSignature: transactionSignature
    });

  } catch (error) {
    logger.error('Claim LP Rewards API Error:', error);
    res.status(500).json({
      error: 'Failed to claim LP rewards',
      details: error.message
    });
  }
});

// Place a limit order
app.post('/api/markets/:id/limit-order', validatePlaceLimitOrder, async (req, res) => {
  try {
    const { id: marketId } = req.params;
    const { userAddress, optionId, amount, priceLimit, orderType } = req.body;

    // Check if market exists and is active
    const marketResult = await queryDatabase(
      'SELECT id, status FROM markets WHERE id = $1 AND status = \'active\'',
      [marketId]
    );
    if (marketResult.rows.length === 0) {
      throw new NotFoundError('Market not found or inactive');
    }

    // Insert the limit order
    const orderResult = await queryDatabase(`
      INSERT INTO limit_orders (market_id, user_address, option_id, amount, price_limit, order_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [marketId, userAddress, optionId, new Decimal(amount).toString(), new Decimal(priceLimit).toString(), orderType]);

    logger.info(`Limit order placed for market ${marketId} by ${userAddress}: ${amount} BNB at price ${priceLimit}`);

    res.status(201).json({
      message: 'Limit order placed successfully',
      order: orderResult.rows[0]
    });

  } catch (error) {
    logger.error('Place Limit Order API Error:', error);
    res.status(500).json({
      error: 'Failed to place limit order',
      details: error.message
    });
  }
});

// Unstake liquidity from a market
app.post('/api/markets/:id/unstake-liquidity', validateUnstakeLiquidity, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { id: marketId } = req.params;
    const { providerAddress, amount } = req.body;
    const unstakeAmount = new Decimal(amount);

    // Ensure provider user exists
    await ensureUserExists(client, providerAddress);

    // Check if market exists and is active
    const marketResult = await client.query(
      'SELECT id, status, end_date FROM markets WHERE id = $1 AND status = \'active\' FOR UPDATE',
      [marketId]
    );
    if (marketResult.rows.length === 0) {
      throw new NotFoundError('Market not found or inactive');
    }
    const market = marketResult.rows[0];

    // Get provider's current staked amount
    const lpRecordResult = await client.query(
      'SELECT current_staked_amount FROM liquidity_providers WHERE market_id = $1 AND provider_address = $2 FOR UPDATE',
      [marketId, providerAddress]
    );
    if (lpRecordResult.rows.length === 0) {
      throw new NotFoundError('Liquidity provider record not found for this market and address');
    }
    const currentStakedAmount = new Decimal(lpRecordResult.rows[0].current_staked_amount);

    if (unstakeAmount.greaterThan(currentStakedAmount)) {
      throw new BadRequestError(`Cannot unstake ${unstakeAmount.toString()} BNB. Only ${currentStakedAmount.toString()} BNB is currently staked.`);
    }

    let earlyUnstakingFee = new Decimal(0);
    let finalUnstakeAmount = unstakeAmount;

    // Check for early unstaking penalization
    if (new Date() < market.end_date) {
      const earlyUnstakingFeePercentage = new Decimal(process.env.EARLY_UNSTAKING_FEE_PERCENTAGE || '0.05'); // Default 5%
      earlyUnstakingFee = unstakeAmount.times(earlyUnstakingFeePercentage);
      finalUnstakeAmount = unstakeAmount.minus(earlyUnstakingFee);
      logger.info(`Early unstaking fee applied for market ${marketId}: ${earlyUnstakingFee.toString()} BNB`);
    }

    const newStakedAmount = currentStakedAmount.minus(unstakeAmount);

    // Update liquidity_providers record
    await client.query(`
      UPDATE liquidity_providers
      SET current_staked_amount = $1,
          total_withdrawn_amount = total_withdrawn_amount + $2,
          status = $3,
          staked_at = CURRENT_TIMESTAMP
      WHERE market_id = $4 AND provider_address = $5
      RETURNING *
    `, [
      newStakedAmount.toString(),
      unstakeAmount.toString(),
      newStakedAmount.isZero() ? 'withdrawn' : 'active',
      marketId,
      providerAddress
    ]);

    // Update market platform fees collected with early unstaking fee
    if (earlyUnstakingFee.greaterThan(0)) {
      await client.query(`
        UPDATE markets
        SET platform_fees_collected = platform_fees_collected + $1
        WHERE id = $2
      `, [earlyUnstakingFee.toString(), marketId]);
    }

    await client.query('COMMIT');

    logger.info(`Liquidity unstaked from market ${marketId} by ${providerAddress}: -${unstakeAmount.toString()} BNB (Final: ${finalUnstakeAmount.toString()} BNB)`);

    res.status(200).json({
      message: 'Liquidity unstaked successfully',
      unstakedAmount: finalUnstakeAmount.toString(),
      earlyUnstakingFee: earlyUnstakingFee.toString(),
      newStakedAmount: newStakedAmount.toString()
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    logger.error('Unstake Liquidity API Error:', error);
    res.status(500).json({
      error: 'Failed to unstake liquidity',
      details: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Register a new user
app.post('/api/users/register', recaptchaMiddleware, validateRegisterUser, async (req, res) => {
  try {
    const { walletAddress, username } = req.body;

    // Check if walletAddress already exists
    const existingWallet = await queryDatabase(
      'SELECT id FROM users WHERE wallet_address = $1',
      [walletAddress]
    );
    if (existingWallet.rows.length > 0) {
      throw new ConflictError('Wallet address already registered');
    }

    // Check if username already exists (if provided)
    if (username) {
      const existingUsername = await queryDatabase(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      if (existingUsername.rows.length > 0) {
        throw new ConflictError('Username already taken');
      }
    }

    // Insert new user
    const newUserResult = await queryDatabase(`
      INSERT INTO users (wallet_address, username)
      VALUES ($1, $2)
      RETURNING id, wallet_address, username, created_at
    `, [walletAddress, username || null]);

    logger.info(`New user registered: ${walletAddress} (Username: ${username || 'N/A'})`);

    res.status(201).json({
      message: 'User registered successfully',
      user: newUserResult.rows[0]
    });

  } catch (error) {
    logger.error('User Registration API Error:', error);
    res.status(500).json({
      error: 'Failed to register user',
      details: error.message
    });
  }
});

// Get user profile by address
app.get('/api/users/:address', validateGetUser, async (req, res) => {
  try {
    const { address } = req.params;

    const userResult = await queryDatabase(
      'SELECT id, wallet_address, username, created_at FROM users WHERE wallet_address = $1',
      [address]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    res.status(200).json({
      user: userResult.rows[0]
    });

  } catch (error) {
    logger.error('Get User API Error:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      details: error.message
    });
  }
});

// Cancel a limit order
app.post('/api/limit-orders/:id/cancel', validateCancelLimitOrder, async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { userAddress } = req.body;

    // Ensure user exists
    await ensureUserExists(pool, userAddress);

    // Check if order exists, belongs to user, and is pending
    const orderResult = await queryDatabase(
      'SELECT * FROM limit_orders WHERE id = $1 AND user_address = $2 AND status = \'pending\'',
      [orderId, userAddress]
    );
    if (orderResult.rows.length === 0) {
      throw new NotFoundError('Pending limit order not found for this user');
    }

    // Update order status to cancelled
    const cancelledOrderResult = await queryDatabase(`
      UPDATE limit_orders
      SET status = 'cancelled',
          cancelled_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [orderId]);

    logger.info(`Limit order ${orderId} cancelled by ${userAddress}`);

    res.status(200).json({
      message: 'Limit order cancelled successfully',
      order: cancelledOrderResult.rows[0]
    });

  } catch (error) {
    logger.error('Cancel Limit Order API Error:', error);
    res.status(500).json({
      error: 'Failed to cancel limit order',
      details: error.message
    });
  }
});

// Utility function for retrying async operations with exponential backoff
async function retryOperation(operation, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i < retries - 1) {
        logger.warn(`Attempt ${i + 1}/${retries} failed. Retrying in ${delay}ms...`, error.message);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Last attempt, rethrow error
      }
    }
  }
}

// BSC RPC Proxy (replacing Solana proxy)
app.post('/api/bsc-proxy', async (req, res) => {
  try {
    const { method, params } = req.body;
    if (!method) throw new BadRequestError('Missing RPC method');
    
    const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
    
    const data = await retryOperation(async () => {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`RPC request failed with status ${response.status}: ${errorBody}`);
      }
      return await response.json();
    });
    
    res.json(data);
  } catch (error) {
    logger.error('BSC proxy error:', error);
    res.status(500).json({ error: 'BSC proxy failed', details: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log the error using our logger
  logger.error('Unhandled error:', err);

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again!';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your token has expired! Please log in again.';
  }
  // Joi validation errors are already handled by our validation middleware,
  // but this is a fallback for any unhandled Joi errors.
  if (err.isJoi) {
    statusCode = 400;
    message = err.details.map(detail => detail.message).join('; ');
  }

  // If it's an operational error, send the specific message
  if (err.isOperational) {
    return res.status(statusCode).json({
      status: err.status,
      message: message,
      timestamp: new Date().toISOString()
    });
  }

  // For programming or unknown errors, send a generic message
  res.status(statusCode).json({
    status: 'error',
    message: 'Something went very wrong!',
    timestamp: new Date().toISOString()
  });
});
// 404 handler for API routes
app.use('/api', (req, res, next) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// Serve static frontend
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
}
app.use(express.static(path.join(__dirname, 'public')));

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Admin dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// SPA fallback
app.get('/*splat', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

let serverInstance; // Declare a variable to hold the server instance

// Start server
async function startServer() {
  try {
    await runAllMigrations(); // Run migrations before starting the server

    serverInstance = app.listen(PORT, async () => { // Assign server instance
      logger.info('BNBmarket Backend Server Started');
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API accessible at http://localhost:${PORT}/api`);
      logger.info(`Database: PostgreSQL (SSL enabled)`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Health check: GET /api/health');
      logger.info('Admin endpoints: /api/admin/*');
      logger.info('=====================================');
      
      try {
        await pool.query('SELECT 1');
        logger.info('✓ Database connection OK');
      } catch (e) {
        logger.error('✗ Database connection ERROR:', e.message);
      }

      // Start Auto Market Generator if enabled
      if (process.env.ENABLE_AUTO_MARKETS === 'true') {
        logger.info('🎰 Starting Auto Market Generator...');
        AutoMarketGenerator.start();
      } else {
        logger.info('ℹ️  Auto Market Generator disabled (set ENABLE_AUTO_MARKETS=true to enable)');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Initialize database function for testing
async function initializeDatabase() {
  try {
    await runAllMigrations(pool);
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  AutoMarketGenerator.stop();
  await pool.end();
  logger.info('Database connections closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  AutoMarketGenerator.stop();
  await pool.end();
  logger.info('Database connections closed');
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = { app, pool, initializeDatabase, serverInstance };
