class AdvancedLMSRChartEngine {
  constructor(options = {}) {
    this.chartInstances = new Map();
    this.marketDataCache = new Map();
    this.pollingIntervals = new Map();
    this.webSocketConnections = new Map();

    // WebSocket Configuration
    this.wsConfig = {
      url: options.wsUrl || `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}/ws`,
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 5
    };
  }

  // WebSocket Connection Management
  initWebSocket(marketId) {
    if (this.webSocketConnections.has(marketId)) {
      this.webSocketConnections.get(marketId).close();
    }

    const socket = new WebSocket(this.wsConfig.url);
    let reconnectAttempts = 0;

    socket.onopen = () => {
      console.log(`WebSocket connected for market ${marketId}`);

      // Subscribe to market updates
      socket.send(JSON.stringify({
        type: 'subscribe_market',
        marketId: marketId
      }));

      reconnectAttempts = 0;
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'market_update' && message.marketId === marketId) {
          this.handleMarketUpdate(marketId, message.data);
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    socket.onclose = (event) => {
      console.warn(`WebSocket closed for market ${marketId}. Attempting to reconnect...`);

      if (reconnectAttempts < this.wsConfig.maxReconnectAttempts) {
        setTimeout(() => {
          reconnectAttempts++;
          this.initWebSocket(marketId);
        }, this.wsConfig.reconnectInterval);
      } else {
        console.error(`Max reconnect attempts reached for market ${marketId}`);
      }
    };

    this.webSocketConnections.set(marketId, socket);
    return socket;
  }

  // Handle market update from WebSocket
  handleMarketUpdate(marketId, updateData) {
    const chart = this.chartInstances.get(marketId);
    if (!chart) return;

    // Update chart with new probabilities
    chart.data.datasets.forEach((dataset, index) => {
      dataset.data = [updateData.probabilities[index] * 100];
    });

    chart.data.labels = chart.data.datasets.map((dataset, index) =>
      `${chart.data.labels[index]} (${(updateData.probabilities[index] * 100).toFixed(1)}%)`
    );

    chart.update('none');

    // Optional: Broadcast update event for other parts of the application
    const updateEvent = new CustomEvent('market-update', {
      detail: { marketId, updateData }
    });
    window.dispatchEvent(updateEvent);
  }

  // Enhanced chart creation with WebSocket integration
  async createProbabilityChart(containerId, marketId) {
    try {
      const container = document.getElementById(containerId);
      if (!container) throw new Error('Container not found');

      // Fetch initial market data
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

      this.chartInstances.set(marketId, chart);

      // Initialize WebSocket for real-time updates
      this.initWebSocket(marketId);

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

  // Existing methods from previous implementation...
  // (safeApiRequest, getOptionColor, etc.)
}

// Global initialization
window.lmsrChartEngine = new AdvancedLMSRChartEngine({
  debugMode: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10
});

// Attach global event listeners
window.addEventListener('market-update', (event) => {
  console.log('Global market update:', event.detail);
});