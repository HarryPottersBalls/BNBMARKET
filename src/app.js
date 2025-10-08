const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const config = require('./config/environment');
const setupMiddleware = require('./middleware');
const setupRoutes = require('./api/routes');
const errorHandler = require('./middleware/error-handler');

class Application {
    constructor() {
        this.app = express();
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    initializeMiddleware() {
        this.app.use(cors(config.corsOptions));
        this.app.use(helmet());
        this.app.use(express.json());
        setupMiddleware(this.app);
    }

    initializeRoutes() {
        setupRoutes(this.app);
    }

    initializeErrorHandling() {
        this.app.use(errorHandler);
    }

    async start() {
        const PORT = config.port;
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(PORT, () => {
                logger.info(`Server running on port ${PORT}`);
                resolve(this.server);
            }).on('error', reject);
        });
    }

    async stop() {
        if (this.server) {
            await new Promise((resolve, reject) => {
                this.server.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    }
}

module.exports = new Application();