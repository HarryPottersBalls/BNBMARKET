const axios = require('axios');
const WebSocket = require('ws');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

class BNBChainPriceProvider extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // Default configurations
            pollingInterval: config.pollingInterval || 5000, // 5 seconds
            providers: [
                {
                    name: 'PancakeSwap',
                    type: 'http',
                    url: 'https://api.pancakeswap.com/api/v1/price'
                },
                {
                    name: 'CoinGecko',
                    type: 'http',
                    url: 'https://api.coingecko.com/api/v3/simple/price'
                }
            ],
            websocketEndpoints: [
                'wss://stream.binance.com:9443/ws/bnbusdt@trade',
                'wss://stream.binance.com:9443/ws/ethbnb@trade'
            ]
        };

        this.prices = {
            tokens: {},
            lastUpdated: null
        };

        this.init();
    }

    init() {
        this.startHttpPolling();
        this.startWebSocketStreams();
    }

    startHttpPolling() {
        this.pollingTimer = setInterval(async () => {
            try {
                const fetchedPrices = await this.fetchPricesFromProviders();
                this.updatePrices(fetchedPrices);
            } catch (error) {
                logger.error('Price fetching error:', error);
            }
        }, this.config.pollingInterval);
    }

    async fetchPricesFromProviders() {
        const prices = {};

        for (const provider of this.config.providers) {
            try {
                const response = await axios.get(provider.url, {
                    timeout: 3000,
                    params: {
                        // Customize params for each provider
                        ids: 'binancecoin,ethereum',
                        vs_currencies: 'usd'
                    }
                });

                // Parse response based on provider
                if (provider.name === 'CoinGecko') {
                    prices[provider.name] = {
                        BNB: response.data['binancecoin']?.usd,
                        ETH: response.data['ethereum']?.usd
                    };
                }
            } catch (error) {
                logger.warn(`Price fetch failed for ${provider.name}:`, error.message);
            }
        }

        return prices;
    }

    startWebSocketStreams() {
        this.websocketConnections = this.config.websocketEndpoints.map(endpoint => {
            const ws = new WebSocket(endpoint);

            ws.on('open', () => {
                logger.info(`WebSocket connected: ${endpoint}`);
            });

            ws.on('message', (data) => {
                try {
                    const parsedData = JSON.parse(data);
                    this.handleWebSocketMessage(parsedData);
                } catch (error) {
                    logger.error('WebSocket message parsing error:', error);
                }
            });

            ws.on('error', (error) => {
                logger.error(`WebSocket error for ${endpoint}:`, error);
            });

            return ws;
        });
    }

    handleWebSocketMessage(data) {
        // Binance WebSocket trade message processing
        if (data.s && data.p) {  // Symbol and Price
            const symbol = data.s.toLowerCase();
            const price = parseFloat(data.p);

            this.prices.tokens[symbol] = {
                price,
                timestamp: Date.now()
            };

            // Emit real-time price update event
            this.emit('priceUpdate', {
                symbol,
                price,
                timestamp: Date.now()
            });
        }
    }

    updatePrices(fetchedPrices) {
        this.prices.tokens = {
            ...this.prices.tokens,
            ...Object.fromEntries(
                Object.entries(fetchedPrices).flatMap(
                    ([provider, providerPrices]) =>
                        Object.entries(providerPrices).map(
                            ([token, price]) => [token.toLowerCase(), { price, provider }]
                        )
                )
            )
        };
        this.prices.lastUpdated = Date.now();

        // Emit update event
        this.emit('update', this.prices);
    }

    // Extensible method for getting current prices
    getCurrentPrices() {
        return this.prices;
    }

    // Clean up resources
    destroy() {
        clearInterval(this.pollingTimer);
        this.websocketConnections.forEach(ws => ws.close());
    }
}

module.exports = BNBChainPriceProvider;