class ImprovedLMSRChartEngine {
  constructor() {
    this.chartInstances = new Map();
    this.marketDataCache = new Map();
    this.pollingIntervals = new Map();
  }

  calculateLMSRProbabilities(volumes, liquidity = 15) {
    const numOptions = volumes.length;
    const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
    const dynamicLiquidity = Math.max(liquidity, totalVolume * 0.15);

    const adjustedVolumes = volumes.map((vol, index) =>
      vol + (dynamicLiquidity / numOptions) * (1 + Math.log(index + 2))
    );

    const maxVol = Math.max(...adjustedVolumes);
    const scaleFactor = Math.max(maxVol / 3, 1);
    const expValues = adjustedVolumes.map(vol => Math.exp(vol / scaleFactor));

    const sumExp = expValues.reduce((sum, exp) => sum + exp, 0);
    const probabilities = expValues.map(exp => exp / sumExp);

    return probabilities.map(p =>
      Math.max(Math.min(p, 0.99), 0.01)  // Strict probability bounds
    );
  }

  async safeApiRequest(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        console.warn(`API request failed: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      return null;
    }
  }

  async setupRealTimeUpdates(marketId, chartContainerId) {
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
        console.error('Update polling failed:', error);
      }
    };

    await pollForUpdates();

    const pollingInterval = setInterval(pollForUpdates, 5000);
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
  }
}

window.lmsrChartEngine = new ImprovedLMSRChartEngine();

window.addEventListener('resize', () => {
  if (window.lmsrChartEngine) {
    window.lmsrChartEngine.handleResize();
  }
});

window.LMSRChartEngine = ImprovedLMSRChartEngine;