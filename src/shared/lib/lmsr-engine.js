const Decimal = require('decimal.js');
const logger = require('../utils/logger');

class LMSREngine {
  /**
   * Calculate probabilities for market outcomes using Logarithmic Market Scoring Rule
   * @param {Object} market - Market configuration
   * @param {Array} bets - Current bets in the market
   * @param {number} numOutcomes - Number of possible outcomes
   * @returns {Array} Probabilities for each outcome
   */
  static calculateProbabilities(market, bets, numOutcomes) {
    const liquidity = new Decimal(
      (market?.metadata?.liquidity_param && typeof market.metadata.liquidity_param === 'number')
        ? market.metadata.liquidity_param
        : 10
    );

    let outcomeTotals;

    // Attempt to use cached outcome totals
    if (market?.metadata?.cachedOutcomeTotals && Array.isArray(market.metadata.cachedOutcomeTotals)) {
      outcomeTotals = market.metadata.cachedOutcomeTotals.map(val => new Decimal(val));
      logger.debug(`Using cached outcome totals for market ${market.id}`);
    } else {
      // Recalculate outcome totals
      outcomeTotals = Array(numOutcomes).fill(new Decimal(0));

      bets.forEach(bet => {
        if (bet.option_id < numOutcomes) {
          outcomeTotals[bet.option_id] = outcomeTotals[bet.option_id].plus(new Decimal(bet.amount || 0));
        }
      });
      logger.debug(`Recalculated outcome totals for market ${market?.id || 'N/A'}`);
    }

    // Prevent zero division
    const initialLiquidity = liquidity.dividedBy(numOutcomes);
    const adjustedTotals = outcomeTotals.map(total => total.plus(initialLiquidity));

    // Advanced scaling to prevent overflow
    const scaleFactor = Decimal.max(...adjustedTotals).dividedBy(10);
    const expValues = adjustedTotals.map(total => Decimal.exp(total.dividedBy(Decimal.max(scaleFactor, 1))));

    // Probability calculation
    const sumExp = expValues.reduce((sum, exp) => sum.plus(exp), new Decimal(0));
    const probabilities = expValues.map(exp => exp.dividedBy(sumExp));

    return probabilities.map(p => p.toNumber());
  }

  /**
   * Calculate price for a specific outcome
   * @param {Object} market - Market configuration
   * @param {Array} bets - Current bets
   * @param {number} outcomeIndex - Index of the outcome
   * @param {number} numOutcomes - Total number of outcomes
   * @returns {number} Probability of the outcome
   */
  static calculatePrice(market, bets, outcomeIndex, numOutcomes) {
    const probabilities = this.calculateProbabilities(market, bets, numOutcomes);
    return probabilities[outcomeIndex] || (1 / numOutcomes);
  }

  /**
   * Calculate cost of adding shares to a specific outcome
   * @param {Object} market - Market configuration
   * @param {Array} bets - Current bets
   * @param {number} outcomeIndex - Index of the outcome
   * @param {number} shareAmount - Amount of shares to add
   * @param {number} numOutcomes - Total number of outcomes
   * @returns {number} Cost of adding shares
   */
  static calculateCost(market, bets, outcomeIndex, shareAmount, numOutcomes) {
    const currentProb = new Decimal(this.calculatePrice(market, bets, outcomeIndex, numOutcomes));

    const hypotheticalBets = [...bets, {
      option_id: outcomeIndex,
      amount: shareAmount
    }];

    const newProb = new Decimal(this.calculatePrice(market, hypotheticalBets, outcomeIndex, numOutcomes));

    // Advanced cost calculation
    const avgProb = currentProb.plus(newProb).dividedBy(2);
    return new Decimal(shareAmount).dividedBy(avgProb).toNumber();
  }

  /**
   * Advanced risk assessment for market outcomes
   * @param {Object} market - Market configuration
   * @param {Array} bets - Current bets
   * @returns {Object} Detailed market risk profile
   */
  static assessMarketRisk(market, bets) {
    const probabilities = this.calculateProbabilities(market, bets, market.options.length);

    return {
      probabilities,
      entropy: this.calculateEntropy(probabilities),
      concentration: this.calculateConcentration(probabilities)
    };
  }

  /**
   * Calculate market entropy (measure of uncertainty)
   * @param {Array} probabilities - Market outcome probabilities
   * @returns {number} Entropy value
   */
  static calculateEntropy(probabilities) {
    return -probabilities.reduce((entropy, p) =>
      p > 0 ? entropy + (p * Math.log2(p)) : entropy, 0);
  }

  /**
   * Calculate market concentration
   * @param {Array} probabilities - Market outcome probabilities
   * @returns {number} Concentration index
   */
  static calculateConcentration(probabilities) {
    return Math.max(...probabilities);
  }
}

module.exports = LMSREngine;