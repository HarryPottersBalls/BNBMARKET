const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { UnauthorizedError, ForbiddenError } = require('./error-handler');
const config = require('../config/environment');
const logger = require('../utils/logger');

class AuthService {
  // Generate a secure, time-limited access token
  static generateAccessToken(user, expiresIn = '1h') {
    return jwt.sign(
      {
        sub: user.id,
        address: user.walletAddress,
        role: user.role || 'user'
      },
      config.jwt.secret,
      { expiresIn }
    );
  }

  // Generate a refresh token
  static generateRefreshToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        type: 'refresh'
      },
      config.jwt.secret,
      { expiresIn: '30d' }
    );
  }

  // Verify and decode JWT
  static verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  // Challenge-response authentication for wallet login
  static createLoginChallenge(address) {
    const challenge = crypto.randomBytes(32).toString('hex');

    // Store challenge with expiration (5 minutes)
    const challengeKey = `challenge:${address}`;
    // In a real implementation, use Redis or another cache
    global.challenges = global.challenges || {};
    global.challenges[challengeKey] = {
      challenge,
      createdAt: Date.now()
    };

    return challenge;
  }

  // Verify challenge response
  static verifyLoginChallenge(address, challenge, signature) {
    const challengeKey = `challenge:${address}`;
    const storedChallenge = global.challenges?.[challengeKey];

    // Check challenge exists and is recent
    if (!storedChallenge ||
        Date.now() - storedChallenge.createdAt > 5 * 60 * 1000) {
      throw new UnauthorizedError('Challenge expired or invalid');
    }

    // Verify signature (simplified - in production, use web3.js or ethers.js)
    // This is a placeholder and needs proper blockchain signature verification
    const isValidSignature = this.verifySignature(
      address,
      storedChallenge.challenge,
      signature
    );

    if (!isValidSignature) {
      throw new UnauthorizedError('Invalid signature');
    }

    // Remove used challenge
    delete global.challenges[challengeKey];

    return true;
  }

  // Middleware to require authentication
  static requireAuth(roles = ['user']) {
    return (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        throw new UnauthorizedError('No token provided');
      }

      const decoded = this.verifyToken(token);

      // Check user role
      if (!roles.includes(decoded.role)) {
        throw new ForbiddenError('Insufficient permissions');
      }

      req.user = decoded;
      next();
    };
  }

  // Rate limit authentication attempts
  static authRateLimiter() {
    const attempts = new Map();

    return (req, res, next) => {
      const ip = req.ip;
      const currentTime = Date.now();

      // Remove old attempts
      const filteredAttempts = Array.from(attempts.entries())
        .filter(([, time]) => currentTime - time < 15 * 60 * 1000);

      attempts.clear();
      filteredAttempts.forEach(([key, value]) => attempts.set(key, value));

      // Count attempts
      const attemptsCount = (attempts.get(ip) || 0) + 1;
      attempts.set(ip, currentTime);

      if (attemptsCount > 5) {
        throw new ForbiddenError('Too many authentication attempts');
      }

      next();
    };
  }

  // Placeholder for signature verification
  static verifySignature(address, message, signature) {
    // In a real implementation, use web3.js or ethers.js to verify
    // Ethereum/Solana signature against the message and address
    logger.warn('Signature verification is a placeholder');
    return true;
  }
}

module.exports = AuthService;