const { MongoClient } = require('mongodb');
const logger = require('../src/utils/logger');

// Global test configuration
global.testConfig = {
    mongoUri: process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/test-bnbmarket',
};

beforeAll(async () => {
    // Global setup before all tests
    global.mongoConnection = await MongoClient.connect(global.testConfig.mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    global.testDatabase = global.mongoConnection.db();

    logger.info('Test suite setup complete');
});

afterAll(async () => {
    // Cleanup after all tests
    await global.mongoConnection.close();
    logger.info('Test suite teardown complete');
});

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    throw reason;
});