const logger = require('./logger');
const Decimal = require('decimal.js'); // Import decimal.js for precise calculations

// Helper function to properly parse JSONB fields
function parseJSONBField(field, fieldName = 'field') {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      logger.error(`Failed to parse ${fieldName}:`, e);
      return fieldName === 'metadata' ? {} : [];
    }
  }
  return field || (fieldName === 'metadata' ? {} : []);
}

// LMSR (Logarithmic Market Scoring Rule) Functions
function calculateLMSRProbabilities(market, bets, numOutcomes) {
  const liquidity = new Decimal((market && market.metadata && typeof market.metadata.liquidity_param === 'number') 
    ? market.metadata.liquidity_param 
    : 10); // Default to 10 if not found or invalid

  let outcomeTotals;

  // Try to use cached outcome totals from market metadata
  if (market && market.metadata && Array.isArray(market.metadata.cachedOutcomeTotals)) {
    outcomeTotals = market.metadata.cachedOutcomeTotals.map(val => new Decimal(val)); // Ensure Decimal objects
    logger.debug(`Using cached outcome totals for market ${market.id}`);
  } else {
    // Calculate total bet amounts per outcome if no cache or invalid cache
    outcomeTotals = Array(numOutcomes).fill(new Decimal(0));
    
    bets.forEach(bet => {
      if (bet.option_id < numOutcomes) {
        outcomeTotals[bet.option_id] = outcomeTotals[bet.option_id].plus(new Decimal(bet.amount || 0));
      }
    });
    logger.debug(`Recalculated outcome totals for market ${market ? market.id : 'N/A'}`);
  }
  
  // Add small initial liquidity to prevent division by zero
  const initialLiquidity = liquidity.dividedBy(numOutcomes);
  const adjustedTotals = outcomeTotals.map(total => total.plus(initialLiquidity));
  
  // Calculate exponentials (scaled down to prevent overflow)
  const scaleFactor = Decimal.max(...adjustedTotals).dividedBy(10); // Scale to manageable numbers
  const expValues = adjustedTotals.map(total => Decimal.exp(total.dividedBy(Decimal.max(scaleFactor, 1))));
  
  // Calculate probabilities
  const sumExp = expValues.reduce((sum, exp) => sum.plus(exp), new Decimal(0));
  const probabilities = expValues.map(exp => exp.dividedBy(sumExp));
  
  return probabilities.map(p => p.toNumber()); // Return as numbers for now, can be Decimal if needed downstream
}

function calculateLMSRPrice(market, bets, outcomeIndex, numOutcomes) {
  const probabilities = calculateLMSRProbabilities(market, bets, numOutcomes);
  return probabilities[outcomeIndex] || (new Decimal(1).dividedBy(numOutcomes).toNumber()); // Default equal probability
}

function calculateLMSRCost(market, bets, outcomeIndex, shareAmount, numOutcomes) {
  // Current state
  const currentProb = new Decimal(calculateLMSRPrice(market, bets, outcomeIndex, numOutcomes));
  
  // Create hypothetical bet to see new price
  const hypotheticalBets = [...bets, {
    option_id: outcomeIndex,
    amount: shareAmount
  }];
  
  const newProb = new Decimal(calculateLMSRPrice(market, hypotheticalBets, outcomeIndex, numOutcomes));
  
  // Simple cost calculation based on probability change
  const avgProb = currentProb.plus(newProb).dividedBy(2);
  return new Decimal(shareAmount).dividedBy(avgProb).toNumber();
}

module.exports = {
  calculateLMSRProbabilities,
  calculateLMSRPrice,
  calculateLMSRCost,
  parseJSONBField,
};