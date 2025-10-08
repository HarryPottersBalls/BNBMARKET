const WebSocket = require('ws');

class WebSocketManager {
  constructor(wss, options = {}) {
    this.wss = wss;
    this.logger = options.logger || console;
    this.authenticator = options.authenticator;
    this.probabilityTracker = options.probabilityTracker;
    
    this.activeConnections = new Set();
    this.marketSubscriptions = new Map();

    this.setupConnectionHandlers();
  }

  setupConnectionHandlers() {
    this.wss.on('connection', (ws, req) => {
      if (this.authenticator && !this.authenticator.authenticateConnection(ws, req)) {
        return;
      }

      this.activeConnections.add(ws);
      this.logger.info('New WebSocket connection established');

      ws.on('message', (rawMessage) => {
        try {
          const message = JSON.parse(rawMessage);
          this.handleIncomingMessage(ws, message);
        } catch (error) {
          this.logger.error('Message processing error', { error: error.message });
          this.sendErrorResponse(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.activeConnections.delete(ws);
        this.cleanupSubscriptions(ws);
      });

      ws.on('error', (error) => {
        this.logger.error('WebSocket error', { error: error.message });
      });
    });
  }

  handleIncomingMessage(ws, message) {
    switch (message.type) {
      case 'market_subscribe':
        this.subscribeToMarket(ws, message.marketId);
        break;
      case 'market_unsubscribe':
        this.unsubscribeFromMarket(ws, message.marketId);
        break;
      default:
        this.logger.warn('Unknown message type', { type: message.type });
        this.sendErrorResponse(ws, 'Unknown message type');
    }
  }

  sendErrorResponse(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message
      }));
    }
  }

  subscribeToMarket(ws, marketId) {
    if (!this.marketSubscriptions.has(marketId)) {
      this.marketSubscriptions.set(marketId, new Set());
    }
    this.marketSubscriptions.get(marketId).add(ws);
    this.logger.info(`Client subscribed to market ${marketId}`);
  }

  unsubscribeFromMarket(ws, marketId) {
    const marketSubscribers = this.marketSubscriptions.get(marketId);
    if (marketSubscribers) {
      marketSubscribers.delete(ws);
      
      // Clean up if no more subscribers
      if (marketSubscribers.size === 0) {
        this.marketSubscriptions.delete(marketId);
      }

      this.logger.info(`Client unsubscribed from market ${marketId}`);
    }
  }

  cleanupSubscriptions(ws) {
    for (const [marketId, subscribers] of this.marketSubscriptions.entries()) {
      subscribers.delete(ws);
      
      // Clean up empty market subscriptions
      if (subscribers.size === 0) {
        this.marketSubscriptions.delete(marketId);
      }
    }
  }

  broadcastMarketUpdate(marketId, updateData) {
    const subscribers = this.marketSubscriptions.get(marketId);
    
    if (!subscribers) return;

    const message = JSON.stringify({
      type: 'market_update',
      marketId,
      data: updateData
    });

    subscribers.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

module.exports = WebSocketManager;
