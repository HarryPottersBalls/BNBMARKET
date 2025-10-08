/**
 * Represents a market configuration for the LMSR (Logarithmic Market Scoring Rule) engine
 */
export interface LMSRMarketConfig {
  /**
   * Liquidity parameter that controls market sensitivity
   */
  liquidityParam: number;

  /**
   * Number of possible outcomes in the market
   */
  numOutcomes: number;
}

/**
 * Represents a single bet in the market
 */
export interface MarketBet {
  /**
   * Index of the outcome being bet on
   */
  outcomeIndex: number;

  /**
   * Amount of the bet
   */
  amount: number;
}

/**
 * Interface for LMSR probability calculation
 */
export interface LMSREngine {
  /**
   * Calculate market probabilities based on current bets
   * @param bets Array of bet amounts for each outcome
   * @returns Calculated probabilities for each outcome
   */
  calculateProbabilities(bets: number[]): number[];

  /**
   * Calculate the price of a specific outcome
   * @param bets Array of bet amounts for each outcome
   * @param outcomeIndex Index of the outcome to price
   * @returns Price of the specified outcome
   */
  calculatePrice(bets: number[], outcomeIndex: number): number;

  /**
   * Assess market risk based on current bets
   * @param bets Array of bet amounts for each outcome
   * @returns Risk profile including probabilities, entropy, and concentration
   */
  assessMarketRisk(bets: number[]): {
    probabilities: number[];
    entropy: number;
    concentration: number;
  };
}

/**
 * LMSR Engine initialization options
 */
export interface LMSREngineOptions {
  /**
   * Liquidity parameter for the market
   */
  liquidityParam?: number;

  /**
   * Number of possible outcomes
   */
  numOutcomes: number;
}

/**
 * WebAssembly LMSR Engine Type Definition
 */
export interface WasmLMSREngine {
  /**
   * Calculate LMSR probabilities directly from WebAssembly
   * @param liquidityParam Liquidity parameter
   * @param numOutcomes Number of outcomes
   * @param bets Bet amounts for each outcome
   * @returns Calculated probabilities
   */
  calculate_lmsr_probabilities(
    liquidityParam: number,
    numOutcomes: number,
    bets: Float64Array
  ): Float64Array;
}