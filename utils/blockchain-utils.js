const Web3 = require('web3');
const { AppError, BadRequestError } = require('../errors/customErrors');
const logger = require('./logger');

class BlockchainUtils {
  constructor(rpcUrl) {
    // Use BSC RPC URL from environment or default
    this.rpcUrl = rpcUrl || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
    this.web3 = new Web3(new Web3.providers.HttpProvider(this.rpcUrl));
  }

  /**
   * Verify a blockchain transaction against expected parameters
   * @param {Object} params - Transaction verification parameters
   * @param {string} params.txHash - Transaction hash to verify
   * @param {string} params.expectedSender - Expected sender address
   * @param {string} params.expectedReceiver - Expected receiver address
   * @param {string} params.expectedValue - Expected transaction value
   * @param {number} [params.minConfirmations=3] - Minimum number of block confirmations
   * @returns {Promise<boolean>} - True if transaction is valid
   */
  async verifyTransaction({
    txHash,
    expectedSender,
    expectedReceiver,
    expectedValue,
    minConfirmations = 3
  }) {
    const performanceTracker = logger.trackPerformance('Transaction Verification');

    try {
      // Validate input parameters
      if (!txHash || !expectedSender || !expectedReceiver) {
        throw new BadRequestError('Missing required transaction verification parameters');
      }

      // Fetch transaction details
      const tx = await this.web3.eth.getTransaction(txHash);
      if (!tx) {
        throw new AppError('Transaction not found', 404);
      }

      // Get transaction receipt for confirmation count
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      const currentBlock = await this.web3.eth.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      // Log transaction details for debugging
      logger.debug('Transaction Verification Details', {
        txHash,
        sender: tx.from,
        receiver: tx.to,
        value: this.web3.utils.fromWei(tx.value, 'ether'),
        confirmations
      });

      // Validate sender
      if (tx.from.toLowerCase() !== expectedSender.toLowerCase()) {
        logger.warn('Sender Mismatch', {
          expected: expectedSender,
          actual: tx.from
        });
        throw new AppError('Transaction sender does not match expected sender', 400);
      }

      // Validate receiver
      if (tx.to.toLowerCase() !== expectedReceiver.toLowerCase()) {
        logger.warn('Receiver Mismatch', {
          expected: expectedReceiver,
          actual: tx.to
        });
        throw new AppError('Transaction receiver does not match expected receiver', 400);
      }

      // Validate value (converting to ether for comparison)
      const txValueEther = this.web3.utils.fromWei(tx.value, 'ether');
      const expectedValueEther = this.web3.utils.toWei(expectedValue, 'ether');

      if (txValueEther !== expectedValueEther) {
        logger.warn('Value Mismatch', {
          expected: expectedValueEther,
          actual: txValueEther
        });
        throw new AppError('Transaction value does not match expected value', 400);
      }

      // Validate confirmations
      if (confirmations < minConfirmations) {
        logger.warn('Insufficient Confirmations', {
          current: confirmations,
          required: minConfirmations
        });
        throw new AppError(`Insufficient block confirmations. Required: ${minConfirmations}`, 400);
      }

      performanceTracker.end();
      return true;

    } catch (error) {
      performanceTracker.end();

      // Log and rethrow AppErrors, wrap other errors
      if (error instanceof AppError) {
        error.log(logger);
        throw error;
      } else {
        const wrappedError = new AppError('Transaction verification failed', 500, false);
        wrappedError.originalError = error;
        wrappedError.log(logger);
        throw wrappedError;
      }
    }
  }

  /**
   * Convert Wei to Ether
   * @param {string|number} wei - Amount in Wei
   * @returns {string} Ether value
   */
  weiToEther(wei) {
    return this.web3.utils.fromWei(wei, 'ether');
  }

  /**
   * Convert Ether to Wei
   * @param {string|number} ether - Amount in Ether
   * @returns {string} Wei value
   */
  etherToWei(ether) {
    return this.web3.utils.toWei(ether, 'ether');
  }

  /**
   * Check if an address is valid
   * @param {string} address - Blockchain address to validate
   * @returns {boolean} True if valid, false otherwise
   */
  isValidAddress(address) {
    return this.web3.utils.isAddress(address);
  }
}

// Export a singleton instance
module.exports = new BlockchainUtils();