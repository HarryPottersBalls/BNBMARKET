class MarketProbabilityTracker {
  constructor(options = {}) {
    this.markets = new Map();
    this.decayFactor = options.decayFactor || 0.95; // Time decay
  }

  updateMarketProbability(marketId, bidData) {
    if (!this.markets.has(marketId)) {
      this.markets.set(marketId, {
        totalVolume: 0,
        optionVolumes: [],
        lastUpdateTime: Date.now()
      });
    }

    const market = this.markets.get(marketId);
    const timeSinceLastUpdate = (Date.now() - market.lastUpdateTime) / 1000 / 60; // minutes

    // Apply time-based volume decay
    market.totalVolume *= Math.pow(this.decayFactor, timeSinceLastUpdate);
    market.optionVolumes = market.optionVolumes.map(
      vol => vol * Math.pow(this.decayFactor, timeSinceLastUpdate)
    );

    // Update with new bid
    market.totalVolume += bidData.amount;
    market.optionVolumes[bidData.optionId] = 
      (market.optionVolumes[bidData.optionId] || 0) + bidData.amount;
    market.lastUpdateTime = Date.now();

    return this.calculateProbabilities(market);
  }

  calculateProbabilities(market) {
    const totalVolume = market.totalVolume;
    
    // Dirichlet distribution for more nuanced probability
    const alpha = 1; // Base concentration parameter
    const probabilities = market.optionVolumes.map(
      volume => (volume + alpha) / (totalVolume + alpha * market.optionVolumes.length)
    );

    return probabilities;
  }
}

module.exports = MarketProbabilityTracker;
