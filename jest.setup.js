// Jest setup file for backend tests
require('dotenv-flow').config();

// Add any global setup for tests
beforeAll(() => {
  // Global setup tasks
});

afterAll(() => {
  // Global cleanup tasks
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});