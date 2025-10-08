const logger = require('./logger');

async function ensureUserExists(client, walletAddress) {
  try {
    const userResult = await client.query(
      'SELECT id FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    if (userResult.rows.length === 0) {
      logger.info(`User with wallet address ${walletAddress} not found. Registering new user.`);
      await client.query(
        'INSERT INTO users (wallet_address) VALUES ($1)',
        [walletAddress]
      );
      logger.info(`User ${walletAddress} registered automatically.`);
    }
  } catch (error) {
    logger.error(`Error ensuring user exists for ${walletAddress}:`, error);
    throw error;
  }
}

module.exports = {
  ensureUserExists,
};