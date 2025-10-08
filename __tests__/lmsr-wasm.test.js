import { MarketEngine, createSampleBets } from '../rust-lmsr/index.js';
import * as wasm from '../rust-lmsr/pkg/rust_lmsr.js';

describe('LMSR WebAssembly Engine', () => {
  let engine;
  let sampleBets;

  beforeEach(() => {
    engine = new MarketEngine();
    sampleBets = createSampleBets();
  });

  test('should create market engine', () => {
    expect(engine).toBeDefined();
    expect(engine.engine).toBeDefined();
  });

  test('should calculate probabilities', () => {
    const probabilities = engine.calculateProbabilities(sampleBets);

    expect(probabilities).toBeDefined();
    expect(probabilities.length).toBe(2);
    probabilities.forEach(prob => {
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    });
  });

  test('should calculate market price', () => {
    const price = engine.calculateMarketPrice(sampleBets, 0);

    expect(price).toBeDefined();
    expect(price).toBeGreaterThanOrEqual(0);
    expect(price).toBeLessThanOrEqual(1);
  });

  test('should simulate market making', () => {
    const strategy = engine.simulateMarketMaking(sampleBets);

    expect(strategy).toBeDefined();
    expect(strategy.bid_prices).toBeDefined();
    expect(strategy.ask_prices).toBeDefined();
    expect(strategy.spread).toBeDefined();
    expect(strategy.recommended_liquidity).toBeDefined();
  });

  test('should assess market risk', () => {
    const riskProfile = engine.assessMarketRisk(sampleBets);

    expect(riskProfile).toBeDefined();
    expect(riskProfile.probabilities).toBeDefined();
    expect(riskProfile.entropy).toBeDefined();
    expect(riskProfile.concentration).toBeDefined();
    expect(riskProfile.expected_volatility).toBeDefined();
    expect(riskProfile.liquidity_risk).toBeDefined();
  });

  test('should handle different market types', () => {
    const categoricalEngine = new MarketEngine(10, 3, wasm.MarketType.Categorical);
    const categoricalBets = createSampleBets(3);

    const probabilities = categoricalEngine.calculateProbabilities(categoricalBets);

    expect(probabilities).toBeDefined();
    expect(probabilities.length).toBe(3);
  });

  test('should handle error scenarios', () => {
    // Test with invalid outcome index
    const invalidIndexPrice = engine.calculateMarketPrice(sampleBets, 10);
    expect(invalidIndexPrice).toBeNull();

    // Test with empty bets
    const emptyBetsProbabilities = engine.calculateProbabilities([]);
    expect(emptyBetsProbabilities).toBeNull();
  });
});