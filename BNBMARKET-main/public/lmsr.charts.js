/**
 * Enhanced LMSR Chart Engine for BNBmarket
 * Real-time, dynamic probability visualization
 */
class ImprovedLMSRChartEngine {
  constructor() {
    this.chartInstances = new Map();
    this.marketDataCache = new Map();
    this.socketConnections = new Map();
  }

  // Enhanced probability calculation with more sensitive dynamics
  calculateLMSRProbabilities(volumes, liquidity = 15) {
    const numOptions = volumes.length;

    // Dynamic liquidity adjustment
    const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
    const dynamicLiquidity = Math.max(
      liquidity,
      totalVolume * 0.15  // More responsive to market volume
    );

    // Weighted volume calculation with logarithmic bias
    const adjustedVolumes = volumes.map((vol, index) =>
      vol + (dynamicLiquidity / numOptions) * (1 + Math.log(index + 2))
    );

    // Advanced exponential scaling
    const maxVol = Math.max(...adjustedVolumes);
    const scaleFactor = Math.max(maxVol / 3, 1);
    const expValues = adjustedVolumes.map(vol =>
      Math.exp(vol / scaleFactor)
    );

    // Normalize probabilities with minimum threshold
    const sumExp = expValues.reduce((sum, exp) => sum + exp, 0);
    const probabilities = expValues.map(exp => exp / sumExp);

    return probabilities.map(p =>
      Math.max(Math.min(p, 0.99), 0.01)  // Strict probability bounds
    );
  }

  // Fetch market data with robust error handling
  async fetchMarketData(marketId) {
    try {
      const response = await fetch(`/api/markets/${marketId}`);
      if (!response.ok) throw new Error('Failed to fetch market data');
      const data = await response.json();
      return data.market;
    } catch (error) {
      console.error('Market data fetch error:', error);
      throw error;
    }
  }

  // Real-time WebSocket data streaming
  async setupMarketDataStream(marketId, chartContainerId) {
    // Close existing connection if any
    if (this.socketConnections.has(marketId)) {
      this.socketConnections.get(marketId).close();
    }

    // Implement long-polling as a fallback
    const pollForUpdates = async () => {
      try {
        const probData = await this.fetchLatestMarketProbabilities(marketId);
        this.updateChartProbabilities(chartContainerId, probData);
      } catch (error) {
        console.error('Polling update failed:', error);
      }
    };

    // Poll every 5 seconds
    const pollingInterval = setInterval(pollForUpdates, 5000);
    this.socketConnections.set(marketId, {
      close: () => clearInterval(pollingInterval)
    });

    // Initial data fetch
    await pollForUpdates();

    return this.socketConnections.get(marketId);
  }

  // Fetch latest market probabilities
  async fetchLatestMarketProbabilities(marketId) {
    try {
      const response = await fetch(`/api/markets/${marketId}/probabilities`);
      if (!response.ok) throw new Error('Failed to fetch probabilities');
      return await response.json();
    } catch (error) {
      console.error('Probability fetch error:', error);
      throw error;
    }
  }

  // Update chart probabilities
  updateChartProbabilities(chartContainerId, probData) {
    const chart = this.chartInstances.get(chartContainerId);
    if (!chart) return;

    // Update datasets with new probabilities
    chart.data.datasets.forEach((dataset, index) => {
      dataset.data = [probData.probabilities[index] * 100];
    });

    // Update labels with current probabilities
    chart.data.labels = chart.data.datasets.map((dataset, index) =>
      `${chart.data.labels[index]} (${(probData.probabilities[index] * 100).toFixed(1)}%)`
    );

    // Trigger chart update
    chart.update('none');
  }

  // Create probability distribution chart
  async createProbabilityChart(containerId, marketId) {
    try {
      const container = document.getElementById(containerId);
      if (!container) throw new Error('Container not found');

      // Fetch initial data
      const probData = await this.fetchLatestMarketProbabilities(marketId);
      const marketData = await this.fetchMarketData(marketId);

      // Create canvas
      const canvas = document.createElement('canvas');
      container.innerHTML = ''; // Clear previous content
      container.appendChild(canvas);

      // Chart configuration
      const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: marketData.options.map((opt, index) =>
            `${opt.name} (${(probData.probabilities[index] * 100).toFixed(1)}%)`
          ),
          datasets: [{
            data: probData.probabilities.map(prob => prob * 100),
            backgroundColor: marketData.options.map((_, index) =>
              this.getOptionColor(index) + '80'
            ),
            borderColor: marketData.options.map((_, index) =>
              this.getOptionColor(index)
            ),
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = context.parsed;
                  return `${context.label}: ${value.toFixed(1)}%`;
                }
              }
            }
          }
        }
      });

      // Store chart instance
      this.chartInstances.set(containerId, chart);

      // Setup real-time updates
      this.setupMarketDataStream(marketId, containerId);

      return chart;
    } catch (error) {
      console.error('Chart creation failed:', error);
      throw error;
    }
  }

  // Utility method for consistent color generation
  getOptionColor(index) {
    const colors = [
      '#10b981', // Green
      '#ef4444', // Red
      '#3b82f6', // Blue
      '#f59e0b', // Orange
      '#8b5cf6', // Purple
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316'  // Orange-red
    ];
    return colors[index % colors.length];
  }

  // Clean up method
  destroy() {
    this.socketConnections.forEach(connection => connection.close());
    this.socketConnections.clear();

    this.chartInstances.forEach(chart => chart.destroy());
    this.chartInstances.clear();
  }
}

// Global initialization
window.lmsrChartEngine = new ImprovedLMSRChartEngine();
window.ImprovedLMSRChartEngine = ImprovedLMSRChartEngine;