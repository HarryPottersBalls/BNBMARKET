const prometheus = require('prom-client');
const logger = require('./logger');

class PerformanceMonitor {
    constructor() {
        // Enable default metrics collection
        prometheus.collectDefaultMetrics({
            prefix: 'bnbmarket_',
            labels: {
                service: 'prediction_market',
                environment: process.env.NODE_ENV || 'development'
            }
        });

        // Custom metrics for market operations
        this.marketCreationCounter = new prometheus.Counter({
            name: 'market_creation_total',
            help: 'Total number of markets created',
            labelNames: ['market_type', 'creator_type']
        });

        this.marketProbabilityHistogram = new prometheus.Histogram({
            name: 'market_probability_calculation_seconds',
            help: 'Histogram of market probability calculation duration',
            labelNames: ['market_type'],
            buckets: [0.001, 0.01, 0.1, 0.5, 1, 5, 10]
        });

        this.betPlacementCounter = new prometheus.Counter({
            name: 'bet_placement_total',
            help: 'Total number of bets placed',
            labelNames: ['market_type', 'outcome']
        });
    }

    // Track market creation
    recordMarketCreation(marketType, creatorType) {
        this.marketCreationCounter.inc({
            market_type: marketType,
            creator_type: creatorType
        });
    }

    // Measure probability calculation performance
    measureProbabilityCalculation(marketType, calculationFn) {
        const end = this.marketProbabilityHistogram.startTimer({ market_type: marketType });
        try {
            return calculationFn();
        } finally {
            end();
        }
    }

    // Track bet placements
    recordBetPlacement(marketType, outcome) {
        this.betPlacementCounter.inc({
            market_type: marketType,
            outcome: outcome
        });
    }

    // Expose Prometheus metrics endpoint
    createMetricsEndpoint(app) {
        app.get('/metrics', async (req, res) => {
            try {
                res.set('Content-Type', prometheus.register.contentType);
                res.end(await prometheus.register.metrics());
            } catch (error) {
                logger.error('Failed to generate metrics', error);
                res.status(500).send('Metrics generation failed');
            }
        });
    }
}

module.exports = new PerformanceMonitor();