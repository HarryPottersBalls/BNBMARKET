class AdvancedMarketProbabilityTracker {
  constructor(options = {}) {
    this.markets = new Map();
    this.decayFactor = options.decayFactor || 0.95;
    this.learningRate = options.learningRate || 0.1;
    this.manipulationThresholds = {
      rapidBetSequence: 3,
      unusualVolumeSpike: 1.5
    };
  }

  // Enhanced Logarithmic Scoring Rule Method
  logarithmicScore(probability, outcome) {
    return outcome === 1
      ? Math.log(probability)
      : Math.log(1 - probability);
  }

  // Risk scoring to penalize extreme bets
  calculateRiskScore(bidAmount, marketVolume) {
    const relativeSize = bidAmount / marketVolume;
    return Math.pow(relativeSize, 2);
  }

  // Advanced temporal decay
  calculateTemporalDecay(timeElapsed, baseDecay = 0.95) {
    return Math.pow(baseDecay, Math.log(timeElapsed + 1));
  }

  // Detect potential market manipulation
  detectPotentialManipulation(marketId, bidData) {
    const market = this.markets.get(marketId);
    if (!market) return false;

    const recentBets = market.bets || [];
    const rapidBets = recentBets.filter(
      bet => Date.now() - bet.timestamp < 60000 // 1-minute window
    );

    const volumeSpike = (bidData.amount / market.totalVolume) > this.manipulationThresholds.unusualVolumeSpike;
    const rapidSequence = rapidBets.length >= this.manipulationThresholds.rapidBetSequence;

    return volumeSpike || rapidSequence;
  }

  updateMarketProbability(marketId, bidData) {
    if (!this.markets.has(marketId)) {
      this.markets.set(marketId, {
        totalVolume: 0,
        optionVolumes: [],
        optionScores: [],
        lastUpdateTime: Date.now(),
        probabilities: [],
        bets: []
      });
    }

    const market = this.markets.get(marketId);
    const timeSinceLastUpdate = (Date.now() - market.lastUpdateTime) / 1000 / 60;

    // Enhanced temporal decay
    const decayMultiplier = this.calculateTemporalDecay(timeSinceLastUpdate);
    market.totalVolume *= decayMultiplier;
    market.optionVolumes = market.optionVolumes.map(
      vol => vol * decayMultiplier
    );

    // Manipulation detection
    const isPotentialManipulation = this.detectPotentialManipulation(marketId, bidData);
    if (isPotentialManipulation) {
      console.warn('Potential market manipulation detected');
      // Optional: Add additional handling like bet rejection or increased scrutiny
    }

    // Risk-adjusted bid processing
    const riskScore = this.calculateRiskScore(bidData.amount, market.totalVolume);
    const adjustedBidAmount = bidData.amount * (1 / (1 + riskScore));

    market.totalVolume += adjustedBidAmount;
    market.optionVolumes[bidData.optionId] =
      (market.optionVolumes[bidData.optionId] || 0) + adjustedBidAmount;

    // Track bet for future analysis
    market.bets.push({
      ...bidData,
      timestamp: Date.now(),
      riskScore
    });

    market.lastUpdateTime = Date.now();

    // Dynamic probability calculation
    const probabilities = this.calculateAdvancedProbabilities(market, bidData);

    // Optional: Confidence interval calculation
    const confidenceMetrics = this.calculateConfidenceInterval(probabilities);

    return {
      probabilities,
      confidenceMetrics,
      manipulationDetected: isPotentialManipulation
    };
  }

  calculateAdvancedProbabilities(market, bidData) {
    const totalVolume = market.totalVolume;
    const alpha = 1 + totalVolume / 100;

    if (market.probabilities.length === 0) {
      market.probabilities = new Array(market.optionVolumes.length).fill(1 / market.optionVolumes.length);
    }

    const newProbabilities = market.optionVolumes.map((volume, index) => {
      const volumeProbability = (volume + alpha) / (totalVolume + alpha * market.optionVolumes.length);
      const currentScore = this.logarithmicScore(
        market.probabilities[index],
        index === bidData.optionId ? 1 : 0
      );

      const adjustment = this.learningRate * currentScore;
      const adjustedProbability = volumeProbability * (1 + adjustment);

      return Math.max(0.01, Math.min(0.99, adjustedProbability));
    });

    const totalProb = newProbabilities.reduce((a, b) => a + b, 0);
    market.probabilities = newProbabilities.map(p => p / totalProb);

    return market.probabilities;
  }

  calculateConfidenceInterval(probabilities) {
    const mean = probabilities.reduce((a, b) => a + b, 0) / probabilities.length;
    const variance = probabilities.reduce((acc, prob) =>
      acc + Math.pow(prob - mean, 2), 0) / probabilities.length;

    return {
      mean,
      standardDeviation: Math.sqrt(variance),
      confidenceInterval: {
        lower: mean - 1.96 * variance,
        upper: mean + 1.96 * variance
      }
    };
  }

  simulateMarketEfficiency(marketId, groundTruthOutcome) {
    const market = this.markets.get(marketId);
    if (!market) return null;

    const finalProbabilities = market.probabilities;
    const performanceMetrics = finalProbabilities.map((prob, index) => ({
      probability: prob,
      accuracy: index === groundTruthOutcome ? 1 : 0,
      calibrationError: Math.abs(prob - (index === groundTruthOutcome ? 1 : 0))
    }));

    return {
      finalProbabilities,
      performanceMetrics,
      marketEfficiency: 1 - performanceMetrics.reduce((sum, metric) => sum + metric.calibrationError, 0)
    };
  }
}

module.exports = AdvancedMarketProbabilityTracker;