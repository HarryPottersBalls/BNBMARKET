// Error Handling Module
class ErrorHandler {
  constructor(options = {}) {
    this.reportEndpoint = options.reportEndpoint || '/api/error-reporting';
    this.sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i
    ];

    // Advanced error tracking
    this.errorLog = [];
    this.maxErrorLogSize = 50;

    // Performance tracking
    this.performanceMetrics = {
      totalErrors: 0,
      errorTypes: {},
      lastErrorTimestamp: null
    };
  }

  // Enhanced error sanitization with more context
  sanitizeError(error) {
    const sanitizedMessage = this.sanitizeMessage(error.message || 'Unknown error');

    return {
      id: this.generateErrorId(),
      message: sanitizedMessage,
      name: error.name || 'Error',
      stack: this.sanitizeStackTrace(error.stack || ''),
      browserInfo: this.getBrowserInfo(),
      timestamp: new Date().toISOString()
    };
  }

  // Generate unique error ID
  generateErrorId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // Collect browser information for context
  getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };
  }

  // Advanced message sanitization
  sanitizeMessage(message) {
    return this.sensitivePatterns.reduce(
      (msg, pattern) => msg.replace(pattern, '***'),
      message
    );
  }

  // Improved stack trace sanitization
  sanitizeStackTrace(stack) {
    return stack.split('\n')
      .filter(line =>
        !line.includes('node_modules') &&
        !line.includes('internal/') &&
        line.trim() !== ''
      )
      .map(line => {
        // Remove full file paths, keep function names and line numbers
        const pathStripped = line.replace(/\/.*\//, '');
        return pathStripped.length > 200 ? pathStripped.substr(0, 200) + '...' : pathStripped;
      })
      .slice(0, 10)
      .join('\n');
  }

  // Track performance metrics
  trackErrorMetrics(error) {
    this.performanceMetrics.totalErrors++;

    const errorType = error.name || 'UnknownError';
    this.performanceMetrics.errorTypes[errorType] =
      (this.performanceMetrics.errorTypes[errorType] || 0) + 1;

    this.performanceMetrics.lastErrorTimestamp = new Date().toISOString();
  }

  // Store error in local log
  logError(sanitizedError, context) {
    this.errorLog.push({
      ...sanitizedError,
      context
    });

    // Maintain maximum log size
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.shift();
    }
  }

  // Advanced error reporting with fallback mechanisms
  async reportError(error, context = {}) {
    const sanitizedError = this.sanitizeError(error);

    // Track error metrics
    this.trackErrorMetrics(error);

    // Log error locally
    this.logError(sanitizedError, context);

    // Detailed console logging
    console.error('Captured Advanced Error', {
      ...sanitizedError,
      context,
      performanceMetrics: this.performanceMetrics
    });

    try {
      const response = await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Source': 'client',
          'X-Error-ID': sanitizedError.id
        },
        body: JSON.stringify({
          error: sanitizedError,
          context,
          performanceMetrics: this.performanceMetrics
        })
      });

      if (!response.ok) {
        throw new Error('Error reporting failed');
      }
    } catch (reportError) {
      // Fallback error reporting
      this.fallbackErrorReporting(sanitizedError, context, reportError);
    }

    return sanitizedError.id;
  }

  // Fallback error reporting mechanism
  fallbackErrorReporting(sanitizedError, context, reportError) {
    console.warn('Primary error reporting failed. Attempting fallback...', reportError);

    // Option 1: Local Storage Backup
    try {
      const errorBackup = localStorage.getItem('error_backup') || '[]';
      const errorArray = JSON.parse(errorBackup);

      errorArray.push({
        error: sanitizedError,
        context,
        timestamp: new Date().toISOString()
      });

      // Limit local storage backup
      if (errorArray.length > 20) {
        errorArray.shift();
      }

      localStorage.setItem('error_backup', JSON.stringify(errorArray));
    } catch (storageError) {
      console.error('Fallback error storage failed', storageError);
    }

    // Option 2: Retry with reduced payload
    setTimeout(() => {
      try {
        navigator.sendBeacon(this.reportEndpoint, JSON.stringify({
          errorId: sanitizedError.id,
          message: sanitizedError.message,
          timestamp: sanitizedError.timestamp
        }));
      } catch (beaconError) {
        console.error('Beacon error reporting failed', beaconError);
      }
    }, 1000);
  }

  // Method to retrieve error logs (for debugging)
  getErrorLogs() {
    return this.errorLog;
  }

  // Method to retrieve performance metrics
  getPerformanceMetrics() {
    return this.performanceMetrics;
  }
}

// Enhanced global error handling
window.addEventListener('error', (event) => {
  const errorHandler = window.errorHandler || new ErrorHandler();
  errorHandler.reportError(event.error || new Error(event.message), {
    source: 'global-error-handler',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Unhandled promise rejection tracking
window.addEventListener('unhandledrejection', (event) => {
  const errorHandler = window.errorHandler || new ErrorHandler();
  errorHandler.reportError(event.reason || new Error('Unhandled Promise Rejection'), {
    source: 'unhandled-promise-rejection'
  });
});

// WebSocket Connection Manager
class WebSocketManager {
  constructor(options = {}) {
    this.url = options.url || this.getDefaultWebSocketUrl();
    this.errorHandler = options.errorHandler || new ErrorHandler();
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectDelay = options.reconnectDelay || 1000;
  }

  getDefaultWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  connect() {
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.dispatchMessage(message);
        } catch (error) {
          this.errorHandler.reportError(error, {
            source: 'websocket-message-parsing',
            rawMessage: event.data
          });
        }
      };

      this.socket.onclose = () => this.reconnect();
      this.socket.onerror = (error) => {
        this.errorHandler.reportError(error, { source: 'websocket-connection' });
        this.reconnect();
      };

      return this.socket;
    } catch (error) {
      this.errorHandler.reportError(error, { source: 'websocket-connection-setup' });
      this.reconnect();
    }
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max WebSocket reconnect attempts reached');
      return;
    }

    const delay = this.calculateReconnectDelay();
    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`WebSocket reconnect attempt ${this.reconnectAttempts}`);
      this.connect();
    }, delay);
  }

  calculateReconnectDelay() {
    return this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
  }

  dispatchMessage(message) {
    const handlers = this.listeners.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        this.errorHandler.reportError(error, {
          source: 'message-handler',
          messageType: message.type
        });
      }
    });
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  off(type, callback) {
    const handlers = this.listeners.get(type) || [];
    this.listeners.set(type, handlers.filter(handler => handler !== callback));
  }

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}

// Advanced LMSR Chart Engine
class AdvancedLMSRChartEngine {
  constructor(options = {}) {
    this.chartInstances = new Map();
    this.wsManager = options.wsManager || new WebSocketManager();
    this.errorHandler = options.errorHandler || new ErrorHandler();

    this.setupWebSocketListeners();
  }

  setupWebSocketListeners() {
    this.wsManager.on('market_update', (message) => {
      try {
        this.handleMarketUpdate(message.marketId, message.data);
      } catch (error) {
        this.errorHandler.reportError(error, {
          source: 'market-update-handler',
          marketId: message.marketId
        });
      }
    });
  }

  async createProbabilityChart(containerId, marketId) {
    try {
      const container = document.getElementById(containerId);
      if (!container) throw new Error('Container not found');

      const probData = await this.fetchMarketProbabilities(marketId);
      const marketData = await this.fetchMarketDetails(marketId);

      const canvas = document.createElement('canvas');
      container.innerHTML = '';
      container.appendChild(canvas);

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
      return chart;
    } catch (error) {
      this.errorHandler.reportError(error, {
        source: 'create-probability-chart',
        marketId
      });

      container.innerHTML = `
        <div class="error-container">
          Failed to load chart: ${error.message}
        </div>
      `;
    }
  }

  handleMarketUpdate(marketId, updateData) {
    const chart = this.chartInstances.get(marketId);
    if (!chart) return;

    // Smooth chart update
    chart.data.datasets[0].data = updateData.probabilities.map(prob => prob * 100);
    chart.data.labels = chart.data.datasets[0].data.map((value, index) =>
      `${chart.data.labels[index].split('(')[0]} (${value.toFixed(1)}%)`
    );

    chart.update('none');
  }

  getOptionColor(index) {
    const colors = [
      '#10b981', '#ef4444', '#3b82f6', '#f59e0b',
      '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
    ];
    return colors[index % colors.length];
  }

  async fetchMarketProbabilities(marketId) {
    try {
      const response = await fetch(`/api/markets/${marketId}/probabilities`);
      if (!response.ok) throw new Error('Failed to fetch probabilities');
      return await response.json();
    } catch (error) {
      this.errorHandler.reportError(error, {
        source: 'fetch-market-probabilities',
        marketId
      });
      throw error;
    }
  }

  async fetchMarketDetails(marketId) {
    try {
      const response = await fetch(`/api/markets/${marketId}`);
      if (!response.ok) throw new Error('Failed to fetch market details');
      return await response.json();
    } catch (error) {
      this.errorHandler.reportError(error, {
        source: 'fetch-market-details',
        marketId
      });
      throw error;
    }
  }
}

// Global initialization
window.errorHandler = new ErrorHandler();
window.wsManager = new WebSocketManager();
window.lmsrChartEngine = new AdvancedLMSRChartEngine();

// Connect WebSocket on page load
window.wsManager.connect();