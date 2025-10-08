import { MarketEngineService } from '../src/services/MarketEngineService';
import { Bet, MarketType } from '../../rust-lmsr/pkg';

describe('MarketEngineService', () => {
  let marketEngine: MarketEngineService;
  let mockBets: Bet[];

  beforeEach(() => {
    marketEngine = MarketEngineService.createMarketEngine(
      10,  // liquidity parameter
      2,   // number of outcomes
      MarketType.Binary
    );

    mockBets = [
      { option_id: 0, amount: 50 },
      { option_id: 1, amount: 30 }
    ];
  });

  test('calculates probabilities', () => {
    const probabilities = marketEngine.calculateProbabilities(mockBets);

    expect(probabilities).toBeDefined();
    expect(probabilities.length).toBe(2);
    expect(probabilities.every(p => p >= 0 && p <= 1)).toBe(true);
  });

  test('calculates market price', () => {
    const price = marketEngine.calculateMarketPrice(mockBets, 0);

    expect(price).toBeDefined();
    expect(price).toBeGreaterThan(0);
    expect(price).toBeLessThan(1);
  });

  test('assesses market risk', () => {
    const riskProfile = marketEngine.assessMarketRisk(mockBets);

    expect(riskProfile).toBeDefined();
    expect(riskProfile.probabilities).toBeDefined();
    expect(riskProfile.entropy).toBeGreaterThan(0);
  });

  test('simulates market making', () => {
    const marketMakingStrategy = marketEngine.simulateMarketMaking(mockBets);

    expect(marketMakingStrategy).toBeDefined();
    expect(marketMakingStrategy.bid_prices).toBeDefined();
    expect(marketMakingStrategy.ask_prices).toBeDefined();
  });
});