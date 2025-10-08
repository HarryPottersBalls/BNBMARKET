const Joi = require('joi');
const logger = require('../utils/logger');

// Performance and security optimized validation
const crypto = require('crypto');

// Memoize compiled schemas for performance
const schemaCache = new Map();

const validate = (schema, property, options = {}) => {
  // Cache the schema itself (Joi schemas are already compiled)
  const cachedSchema = schemaCache.get(schema) || schema;
  schemaCache.set(schema, cachedSchema);

  const defaultOptions = {
    abortEarly: false,
    stripUnknown: true, // Remove unknown keys
    convert: true, // Type coercion
    allowUnknown: false, // Reject unknown keys
    presence: 'required', // Make all fields required by default
    cache: true // Use Joi's internal caching
  };

  return (req, res, next) => {
    const validationId = crypto.randomUUID();
    const { error, value } = cachedSchema.validate(
      req[property],
      { ...defaultOptions, ...options }
    );

    if (error) {
      // Sanitize error messages to prevent information leakage
      const sanitizedErrors = error.details.map(detail => ({
        message: detail.message.replace(/"/g, ''),
        path: detail.path.join('.')
      }));

      logger.warn('Validation Failed', {
        validationId,
        method: req.method,
        path: req.path,
        property,
        errors: sanitizedErrors,
        requestId: req.requestId || 'unknown'
      });

      return res.status(400).json({
        status: 'error',
        validationId,
        errors: sanitizedErrors
      });
    }

    // Replace original request property with validated and transformed value
    req[property] = value;
    next();
  };
};

// Schemas
const marketSchema = Joi.object({
  title: Joi.string().min(10).max(500).required(),
  description: Joi.string().allow('').optional(),
  category: Joi.string().valid('sports', 'politics', 'tech', 'finance', 'other').default('other'),
  creator_address: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(), // Basic Ethereum address validation
  creatorAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(), // Allow creatorAddress as alternative
  endDate: Joi.date().iso().min('now').required(),
  initialLiquidity: Joi.number().min(0).default(0),
  options: Joi.array().items(
    Joi.object({
      name: Joi.string().min(1).max(100).required(),
      image: Joi.string().uri().allow(null).optional()
    })
  ).min(2).required(),
  creationSignature: Joi.string().optional(),
  marketImage: Joi.string().uri().allow(null).optional(),
  autoApprove: Joi.boolean().optional(), // Used by admin
  liquidityParam: Joi.number().positive().min(1).default(10) // Allow setting initial liquidity parameter
});

const betSchema = Joi.object({
  marketId: Joi.number().integer().min(1).required(),
  bettorAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  optionId: Joi.number().integer().min(0).required(),
  amount: Joi.number().positive().required(),
  transactionSignature: Joi.string().required(),
  maxPriceImpact: Joi.number().positive().max(1).optional() // Max acceptable price impact as a percentage (e.g., 0.05 for 5%)
});

const resolveMarketSchema = Joi.object({
  winningOptionId: Joi.number().integer().min(0).required(),
  resolutionSignature: Joi.string().required(),
  resolutionSource: Joi.string().uri().optional().allow(null, '') // Optional URL for resolution source
});

const stakeLiquiditySchema = Joi.object({
  providerAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  amount: Joi.number().positive().required()
});

const claimLpRewardsSchema = Joi.object({
  providerAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  transactionSignature: Joi.string().required()
});

const getLpRewardsSchema = Joi.object({
  providerAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

const placeLimitOrderSchema = Joi.object({
  userAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  optionId: Joi.number().integer().min(0).required(),
  amount: Joi.number().positive().required(), // Total amount to spend
  priceLimit: Joi.number().positive().required(), // Max price per share
  orderType: Joi.string().valid('buy').default('buy') // For now, only 'buy' limit orders
});

const cancelLimitOrderSchema = Joi.object({
  userAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
});

const registerUserSchema = Joi.object({
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  username: Joi.string().min(3).max(30).optional().allow(null, '')
});

const getUserSchema = Joi.object({
  address: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
});

const blacklistIpSchema = Joi.object({
  ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).required(),
  reason: Joi.string().min(3).optional().allow(null, ''),
  expiresAt: Joi.date().iso().min('now').optional().allow(null)
});

const unstakeLiquiditySchema = Joi.object({
  providerAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  amount: Joi.number().positive().required()
});

const sellSharesSchema = Joi.object({
  userAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  amount: Joi.number().positive().required(), // Amount of shares to sell
  transactionSignature: Joi.string().required(),
});

// Export validation middleware for specific schemas
module.exports = {
  validateMarket: validate(marketSchema, 'body'),
  validateBet: validate(betSchema, 'body'),
  validateResolveMarket: validate(resolveMarketSchema, 'body'),
  validateStakeLiquidity: validate(stakeLiquiditySchema, 'body'),
  validateClaimLpRewards: validate(claimLpRewardsSchema, 'body'),
  validateGetLpRewards: validate(getLpRewardsSchema, 'query'),
  validatePlaceLimitOrder: validate(placeLimitOrderSchema, 'body'),
  validateCancelLimitOrder: validate(cancelLimitOrderSchema, 'body'),
  validateRegisterUser: validate(registerUserSchema, 'body'),
  validateGetUser: validate(getUserSchema, 'params'),
  validateBlacklistIp: validate(blacklistIpSchema, 'body'),
  validateUnstakeLiquidity: validate(unstakeLiquiditySchema, 'body'),
  validateSellShares: validate(sellSharesSchema, 'body'),
  // Add more validation functions as needed for other endpoints
};
