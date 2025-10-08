const request = require('supertest');
const { app, pool } = require('../server');

// Health Check Endpoint
describe('Health Check Endpoint', () => {
  it('should respond with a 200 status code and health status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('timestamp');
  });
});

// Error Handling
describe('Error Handling Middleware', () => {
  it('should handle 404 for non-existent routes', async () => {
    const response = await request(app).get('/non-existent-route');
    expect(response.statusCode).toBe(404);
    expect(response.body).toHaveProperty('error');
  });
});

// Rate Limiting
describe('Rate Limiting', () => {
  it('should implement rate limiting', async () => {
    // This is a simplified test. You might need to adjust based on your actual implementation
    const requests = Array(100).fill().map(() =>
      request(app).get('/api/health')
    );

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(
      response => response.statusCode === 429
    );

    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});

// Database Connection
describe('Database Connection', () => {
  afterAll(async () => {
    await pool.end(); // Properly close the pool after tests
  });

  it('should establish a database connection', async () => {
    try {
      const client = await pool.connect();
      expect(client).toBeTruthy();
      client.release(); // Release the client back to the pool
    } catch (error) {
      fail('Database connection failed: ' + error.message);
    }
  });
});

// Logging Middleware (if applicable)
describe('Logging Middleware', () => {
  it('should log requests', async () => {
    // This might require mocking the logger or checking log files
    const response = await request(app).get('/api/health');
    // Add assertions based on your logging implementation
    expect(response.statusCode).toBe(200);
  });
});

// Environment Configuration
describe('Environment Configuration', () => {
  it('should have required environment variables', () => {
    const requiredEnvVars = [
      'DATABASE_URL',
      'PORT',
      'NODE_ENV'
    ];

    requiredEnvVars.forEach(varName => {
      expect(process.env[varName]).toBeDefined();
      expect(process.env[varName]).not.toBe('');
    });
  });
});