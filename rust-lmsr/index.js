import * as wasm from './pkg/rust_lmsr.js';

// Export the WASM module for direct use
export const LMSREngine = wasm;

// Wrapper class for easier interaction
export class MarketEngine {
  constructor(liquidityParam = 10, numOutcomes = 2, marketType = wasm.MarketType.Binary) {
    this.engine = new wasm.PredictionMarketEngine(liquidityParam, numOutcomes, marketType);
  }

  calculateProbabilities(bets) {
    try {
      return this.engine.calculate_probabilities(bets);
    } catch (error) {
      console.error('Probability calculation error:', error);
      return null;
    }
  }

  calculateMarketPrice(bets, outcomeIndex) {
    try {
      return this.engine.calculate_price(bets, outcomeIndex);
    } catch (error) {
      console.error('Price calculation error:', error);
      return null;
    }
  }

  simulateMarketMaking(bets) {
    try {
      return this.engine.simulate_market_making(bets);
    } catch (error) {
      console.error('Market making simulation error:', error);
      return null;
    }
  }

  assessMarketRisk(bets) {
    try {
      return this.engine.assess_market_risk(bets);
    } catch (error) {
      console.error('Market risk assessment error:', error);
      return null;
    }
  }
}

// Utility function to create sample bets
export function createSampleBets(numBets = 2) {
  return Array.from({ length: numBets }, (_, index) => ({
    option_id: index,
    amount: Math.random() * 100
  }));
}

// Self-test function
export function runSelfTest() {
  console.log('Running LMSR Engine Self-Test');

  const engine = new MarketEngine();
  const sampleBets = createSampleBets();

  console.log('Sample Bets:', sampleBets);

  const probabilities = engine.calculateProbabilities(sampleBets);
  console.log('Probabilities:', probabilities);

  const marketPrice = engine.calculateMarketPrice(sampleBets, 0);
  console.log('Market Price:', marketPrice);

  const marketMaking = engine.simulateMarketMaking(sampleBets);
  console.log('Market Making Strategy:', marketMaking);

  const riskProfile = engine.assessMarketRisk(sampleBets);
  console.log('Market Risk Profile:', riskProfile);
}

// Run self-test if not in module context
if (typeof window !== 'undefined') {
  window.runLMSRSelfTest = runSelfTest;
}