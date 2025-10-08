class AdvancedLMSRChartEngine {
  constructor(options = {}) {
    this.chartInstances = new Map();
    this.marketDataCache = new Map();
    this.pollingIntervals = new Map();
    this.requestCache = new Map();

    // Configurable options with defaults
    this.config = {
      pollingInterval: options.pollingInterval || 5000,
      cacheExpiration: options.cacheExpiration || 30000, // 30 seconds
      requestTimeout: options.requestTimeout || 10000,
      retryAttempts: options.retryAttempts || 3,
      debugMode: options.debugMode || false
    };
  }

  // Advanced logging mechanism
  _log(message, level = 'info') {
    if (this.config.debugMode) {
      const levels = {
        'info': console.log,
        'warn': console.warn,
        'error': console.error
      };
      levels[level](`[LMSRChartEngine] ${message}`);
    }
  }

  // Sophisticated caching mechanism with expiration
  _cacheRequest(key, data) {
    const cacheEntry = {
      data,
      timestamp: Date.now()
    };
    this.requestCache.set(key, cacheEntry);
  }

  _getCachedRequest(key) {
    const entry = this.requestCache.get(key);
    if (!entry) return null;

    // Check cache expiration
    if (Date.now() - entry.timestamp > this.config.cacheExpiration) {
      this.requestCache.delete(key);
      return null;
    }

    return entry.data;
  }

  // Enhanced probabilistic calculation with more dynamic parameters
  calculateLMSRProbabilities(volumes, options = {}) {
    const {
      liquidity = 15,
      timeSensitivity = 0.5,
      volumeImpact = 0.3
    } = options;

    const numOptions = volumes.length;
    const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);

    // Dynamic liquidity with time and volume sensitivity
    const dynamicLiquidity = Math.max(
      liquidity,
      totalVolume * (0.15 + volumeImpact * timeSensitivity)
    );

    // Enhanced volume adjustment with logarithmic and exponential scaling
    const adjustedVolumes = volumes.map((vol, index) =>
      vol + (dynamicLiquidity / numOptions) * (
        1 +
        Math.log(index + 2) * timeSensitivity *
        Math.exp(vol / (totalVolume + 1))
      )
    );

    // Advanced scaling with adaptive factor
    const maxVol = Math.max(...adjustedVolumes);
    const scaleFactor = Math.max(maxVol / (3 + timeSensitivity), 1);

    const expValues = adjustedVolumes.map(vol =>
      Math.exp(vol / (scaleFactor * (1 + timeSensitivity)))
    );

    const sumExp = expValues.reduce((sum, exp) => sum + exp, 0);
    const probabilities = expValues.map(exp => exp / sumExp);

    return probabilities.map(p =>
      Math.max(Math.min(p, 0.99), 0.01)  // Strict probability bounds
    );
  }

  // Robust API request with advanced error handling and retry mechanism
  async safeApiRequest(url, options = {}) {
    const {
      method = 'GET',
      timeout = this.config.requestTimeout,
      retries = this.config.retryAttempts
    } = options;

    // Check cache first
    const cachedResponse = this._getCachedRequest(url);
    if (cachedResponse) {
      this._log(`Cache hit for ${url}`, 'info');
      return cachedResponse;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          this._log(`Request failed: ${response.status}`, 'warn');
          continue;
        }

        const data = await response.json();

        // Cache successful response
        this._cacheRequest(url, data);

        return data;
      } catch (error) {
        this._log(`Request attempt ${attempt} failed: ${error.message}`, 'error');

        if (attempt === retries) {
          throw new Error(`Failed to fetch data after ${retries} attempts`);
        }

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
      }
    }
  }

  // Real-time updates with more sophisticated polling
  async setupRealTimeUpdates(marketId, chartContainerId) {
    // Clear any existing polling for this market
    if (this.pollingIntervals.has(marketId)) {
      clearInterval(this.pollingIntervals.get(marketId));
    }

    const pollForUpdates = async () => {
      try {
        const probData = await this.safeApiRequest(
          `${window.API_BASE_URL}/markets/${marketId}/probabilities`
        );

        if (probData) {
          this.updateChartProbabilities(chartContainerId, probData);
        }
      } catch (error) {
        this._log(`Polling update failed for market ${marketId}`, 'error');
      }
    };

    // Initial immediate update
    await pollForUpdates();

    // Periodic updates
    const pollingInterval = setInterval(
      pollForUpdates,
      this.config.pollingInterval
    );

    this.pollingIntervals.set(marketId, pollingInterval);
    return pollingInterval;
  }

  updateChartProbabilities(chartContainerId, probData) {
    const chart = this.chartInstances.get(chartContainerId);
    if (!chart) return;

    chart.data.datasets.forEach((dataset, index) => {
      dataset.data = [probData.probabilities[index] * 100];
    });

    chart.data.labels = chart.data.datasets.map((dataset, index) =>
      `${chart.data.labels[index]} (${(probData.probabilities[index] * 100).toFixed(1)}%)`
    );

    chart.update('none');
  }

  async createProbabilityChart(containerId, marketId) {
    try {
      const container = document.getElementById(containerId);
      if (!container) throw new Error('Container not found');

      const probData = await this.safeApiRequest(
        `${window.API_BASE_URL}/markets/${marketId}/probabilities`
      );
      const marketData = await this.safeApiRequest(
        `${window.API_BASE_URL}/markets/${marketId}`
      );

      if (!probData || !marketData) {
        throw new Error('Failed to fetch market data');
      }

      const canvas = document.createElement('canvas');
      container.innerHTML = '';
      container.appendChild(canvas);

      const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: marketData.market.options.map((opt, index) =>
            `${opt.name} (${(probData.probabilities[index] * 100).toFixed(1)}%)`
          ),
          datasets: [{
            data: probData.probabilities.map(prob => prob * 100),
            backgroundColor: marketData.market.options.map((_, index) =>
              this.getOptionColor(index) + '80'
            ),
            borderColor: marketData.market.options.map((_, index) =>
              this.getOptionColor(index)
            ),
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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

      this.chartInstances.set(containerId, chart);
      this.setupRealTimeUpdates(marketId, containerId);

      return chart;
    } catch (error) {
      console.error('Chart creation failed:', error);
      container.innerHTML = `
        <div style='color: #9ca3af; text-align: center; padding: 40px;'>
          Failed to load chart: ${error.message}
        </div>
      `;
    }
  }

  handleResize() {
    this.chartInstances.forEach(chart => {
      if (chart && chart.resize) {
        chart.resize();
      }
    });
  }

  getOptionColor(index) {
    const colors = [
      '#10b981', '#ef4444', '#3b82f6', '#f59e0b',
      '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
    ];
    return colors[index % colors.length];
  }

  destroy() {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals.clear();
    this.chartInstances.forEach(chart => chart.destroy());
    this.chartInstances.clear();
    this.requestCache.clear();
  }
}

// Global initialization with optional configuration
window.lmsrChartEngine = new AdvancedLMSRChartEngine({
  debugMode: true,  // Enable detailed logging
  pollingInterval: 3000,  // More frequent updates
  cacheExpiration: 20000  // Shorter cache window
});

// Resize and cleanup handlers
window.addEventListener('resize', () => {
  if (window.lmsrChartEngine) {
    window.lmsrChartEngine.handleResize();
  }
});

window.addEventListener('beforeunload', () => {
  if (window.lmsrChartEngine) {
    window.lmsrChartEngine.destroy();
  }
});

window.LMSRChartEngine = AdvancedLMSRChartEngine;