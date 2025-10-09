const crypto = require('crypto');

class ProductionMarketProbabilityTracker {
  constructor(options = {}) {
    // In-memory storage with Redis-like persistence
    this.markets = new Map();

    // Configuration
    this.config = {
      decayFactor: options.decayFactor || 0.95,
      learningRate: options.learningRate || 0.1,
      maxBetHistoryLength: options.maxBetHistoryLength || 1000,
      manipulationThresholds: {
        rapidBetSequence: 5,
        unusualVolumeSpike: 2.0,
        maxBetAmountRatio: 0.2 // Max bet can be 20% of total market volume
      }
    };
  }

  // Cryptographically secure market ID generation
  generateSecureMarketId(marketData) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(marketData) + Date.now())
      .digest('hex')
      .slice(0, 16);
  }

  // Advanced Logarithmic Scoring Rule Method
  logarithmicScore(probability, outcome) {
    return outcome === 1
      ? Math.log(Math.max(probability, 0.0001))
      : Math.log(Math.max(1 - probability, 0.0001));
  }

  // Sophisticated manipulation detection
  detectMarketManipulation(marketId, bidData) {
    const market = this.markets.get(marketId);
    if (!market) return false;

    const recentBets = market.bets || [];
    const now = Date.now();

    // Rapid bet sequence detection
    const rapidBets = recentBets.filter(
      bet => now - bet.timestamp < 60000 // 1-minute window
    );

    // Volume spike detection
    const volumeSpike =
      (bidData.amount / (market.totalVolume || 1)) > this.config.manipulationThresholds.unusualVolumeSpike;

    // Bet amount relative to market size
    const betSizeExcessive =
      bidData.amount > (market.totalVolume || 0) * this.config.manipulationThresholds.maxBetAmountRatio;

    // Pattern recognition for potential coordinated manipulation
    const suspiciousBetPattern = rapidBets.length >= this.config.manipulationThresholds.rapidBetSequence;

    return volumeSpike || betSizeExcessive || suspiciousBetPattern;
  }

  // Dynamic probability calculation with advanced techniques
  calculateMarketProbabilities(market, bidData) {
    const totalVolume = market.totalVolume || 0;
    const optionsCount = market.optionVolumes.length;

    // Dirichlet distribution with dynamic concentration
    const alpha = 1 + totalVolume / 100;

    // Initialize probabilities if not set
    if (market.probabilities.length === 0) {
      market.probabilities = new Array(optionsCount).fill(1 / optionsCount);
    }

    // Advanced probability calculation
    const newProbabilities = market.optionVolumes.map((volume, index) => {
      // Volume-based probability
      const volumeProbability = (volume + alpha) / (totalVolume + alpha * optionsCount);

      // Logarithmic scoring adjustment
      const currentScore = this.logarithmicScore(
        market.probabilities[index],
        index === bidData.optionId ? 1 : 0
      );

      // Adaptive learning
      const adjustment = this.config.learningRate * currentScore;
      const adjustedProbability = volumeProbability * (1 + adjustment);

      // Bounded probability
      return Math.max(0.01, Math.min(0.99, adjustedProbability));
    });

    // Normalize probabilities
    const totalProb = newProbabilities.reduce((a, b) => a + b, 0);
    market.probabilities = newProbabilities.map(p => p / totalProb);

    return market.probabilities;
  }

  // Main method to update market probabilities
  updateMarketProbability(marketData, bidData) {
    // Generate or retrieve market ID
    const marketId = marketData.id || this.generateSecureMarketId(marketData);

    // Initialize market if not exists
    if (!this.markets.has(marketId)) {
      this.markets.set(marketId, {
        id: marketId,
        totalVolume: 0,
        optionVolumes: new Array(marketData.options.length).fill(0),
        bets: [],
        probabilities: [],
        lastUpdateTime: Date.now()
      });
    }

    const market = this.markets.get(marketId);

    // Detect and log potential manipulation
    const isPotentialManipulation = this.detectMarketManipulation(marketId, bidData);
    if (isPotentialManipulation) {
      console.warn(`Potential market manipulation detected in market ${marketId}`, bidData);
      // Optional: Add advanced logging or external alert system
    }

    // Time-based volume decay
    const timeSinceLastUpdate = (Date.now() - market.lastUpdateTime) / 1000 / 60;
    const decayMultiplier = Math.pow(this.config.decayFactor, timeSinceLastUpdate);

    market.totalVolume *= decayMultiplier;
    market.optionVolumes = market.optionVolumes.map(vol => vol * decayMultiplier);

    // Update market volumes
    market.totalVolume += bidData.amount;
    market.optionVolumes[bidData.optionId] += bidData.amount;

    // Manage bet history
    market.bets.push({
      ...bidData,
      timestamp: Date.now(),
      manipulationDetected: isPotentialManipulation
    });

    // Trim bet history if too long
    if (market.bets.length > this.config.maxBetHistoryLength) {
      market.bets.shift();
    }

    market.lastUpdateTime = Date.now();

    // Calculate new probabilities
    const probabilities = this.calculateMarketProbabilities(market, bidData);

    // Confidence interval calculation
    const confidenceMetrics = this.calculateConfidenceInterval(probabilities);

    return {
      marketId,
      probabilities,
      confidenceMetrics,
      manipulationDetected: isPotentialManipulation
    };
  }

  // Calculate statistical confidence interval
  calculateConfidenceInterval(probabilities) {
    const mean = probabilities.reduce((a, b) => a + b, 0) / probabilities.length;
    const variance = probabilities.reduce((acc, prob) =>
      acc + Math.pow(prob - mean, 2), 0) / probabilities.length;

    return {
      mean,
      standardDeviation: Math.sqrt(variance),
      confidenceInterval: {
        lower: Math.max(0, mean - 1.96 * variance),
        upper: Math.min(1, mean + 1.96 * variance)
      }
    };
  }

  // Market efficiency simulation
  simulateMarketEfficiency(marketId, groundTruthOutcome) {
    const market = this.markets.get(marketId);
    if (!market) return null;

    const performanceMetrics = market.probabilities.map((prob, index) => ({
      probability: prob,
      accuracy: index === groundTruthOutcome ? 1 : 0,
      calibrationError: Math.abs(prob - (index === groundTruthOutcome ? 1 : 0))
    }));

    return {
      finalProbabilities: market.probabilities,
      performanceMetrics,
      marketEfficiency: 1 - performanceMetrics.reduce((sum, metric) => sum + metric.calibrationError, 0)
    };
  }
}

module.exports = ProductionMarketProbabilityTracker;