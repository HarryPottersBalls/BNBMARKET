import {
  PredictionMarketEngine,
  Bet,
  MarketType,
  MarketRiskProfile,
  MarketMakingStrategy
} from '../../rust-lmsr/pkg';

export class MarketEngineService {
  private engine: PredictionMarketEngine;

  constructor(
    liquidityParam: number = 10,
    numOutcomes: number = 2,
    marketType: MarketType = MarketType.Binary
  ) {
    this.engine = new PredictionMarketEngine(
      liquidityParam,
      numOutcomes,
      marketType
    );
  }

  calculateProbabilities(bets: Bet[]): number[] {
    try {
      return this.engine.calculate_probabilities(bets);
    } catch (error) {
      console.error('Probability calculation failed:', error);
      return new Array(bets.length).fill(0);
    }
  }

  calculateMarketPrice(bets: Bet[], outcomeIndex: number): number {
    try {
      return this.engine.calculate_price(bets, outcomeIndex);
    } catch (error) {
      console.error('Price calculation failed:', error);
      return 0;
    }
  }

  assessMarketRisk(bets: Bet[]): MarketRiskProfile {
    try {
      return this.engine.assess_market_risk(bets);
    } catch (error) {
      console.error('Risk assessment failed:', error);
      return {
        probabilities: [],
        entropy: 0,
        concentration: 0,
        expected_volatility: 0,
        liquidity_risk: 0
      };
    }
  }

  simulateMarketMaking(bets: Bet[]): MarketMakingStrategy {
    try {
      return this.engine.simulate_market_making(bets);
    } catch (error) {
      console.error('Market making simulation failed:', error);
      return {
        bid_prices: [],
        ask_prices: [],
        spread: 0,
        recommended_liquidity: 0
      };
    }
  }

  // Factory method for creating market engines
  static createMarketEngine(
    liquidityParam: number = 10,
    numOutcomes: number = 2,
    marketType: MarketType = MarketType.Binary
  ): MarketEngineService {
    return new MarketEngineService(liquidityParam, numOutcomes, marketType);
  }
}