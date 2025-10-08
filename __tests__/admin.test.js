const request = require('supertest');
let { app, pool, initializeDatabase } = require('../server');

describe('Admin API Endpoints', () => {
  let testMarketId;
  let marketToRejectId;
  let marketToApproveId;

  beforeAll(async () => {
    // Ensure a test database is used
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL is not set. Please configure your .env file for testing.');
    }
  });

  beforeEach(async () => {
    // Clear tables before each test to ensure isolation
    await pool.query('TRUNCATE TABLE markets RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE bets RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE comments RESTART IDENTITY CASCADE');
    await initializeDatabase(); // Re-initialize tables

    // Create a market for general testing purposes (auto-approved)
    const marketData = {
      title: 'Test Market for Admin',
      description: 'This is a test market for admin API integration tests.',
      category: 'test',
      creatorAddress: '0x7eCa382995Df91C250896c0EC73c9d2893F7800e', // Admin wallet
      endDate: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
      initialLiquidity: 0,
      options: [{ name: 'Yes' }, { name: 'No' }],
      autoApprove: true,
    };
    const res = await request(app).post('/api/markets').send(marketData);
    expect(res.statusCode).toEqual(201);
    testMarketId = res.body.market.id;

    // Create a market specifically for approval (under review)
    const marketDataToApprove = {
      title: 'Test Market to Approve',
      description: 'This market will be approved.',
      category: 'test',
      creatorAddress: '0x7eCa382995Df91C250896c0EC73c9d2893F7800e', // Admin wallet
      endDate: new Date(Date.now() + 86400000).toISOString(),
      initialLiquidity: 0,
      options: [{ name: 'Option X' }, { name: 'Option Y' }],
      autoApprove: false,
    };
    const createResToApprove = await request(app).post('/api/markets').send(marketDataToApprove);
    expect(createResToApprove.statusCode).toEqual(201);
    marketToApproveId = createResToApprove.body.market.id;

    // Create a market specifically for rejection (under review)
    const marketDataToReject = {
      title: 'Another Test Market to Reject',
      description: 'This market will be rejected.',
      category: 'test',
      creatorAddress: '0x7eCa382995Df91C250896c0EC73c9d2893F7800e', // Admin wallet
      endDate: new Date(Date.now() + 86400000).toISOString(),
      initialLiquidity: 0,
      options: [{ name: 'Option A' }, { name: 'Option B' }],
      autoApprove: false,
    };
    const createResToReject = await request(app).post('/api/markets').send(marketDataToReject);
    expect(createResToReject.statusCode).toEqual(201);
    marketToRejectId = createResToReject.body.market.id;
  });



  it('should fetch pending markets (admin only)', async () => {
    const adminWallet = process.env.ADMIN_WALLET || '0x7eCa382995Df91C250896c0EC73c9d2893F7800e';
    const res = await request(app).get(`/api/admin/pending-markets?address=${adminWallet}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.markets).toBeInstanceOf(Array);
    // Expect the marketToApproveId and marketToRejectId to be in the pending list
    const pendingMarketIds = res.body.markets.map(m => m.id);
    expect(pendingMarketIds).toContain(marketToApproveId);
    expect(pendingMarketIds).toContain(marketToRejectId);
  });

  it('should approve a market (admin only)', async () => {
    const adminWallet = process.env.ADMIN_WALLET || '0x7eCa382995Df91C250896c0EC73c9d2893F7800e';
    const res = await request(app)
      .post(`/api/admin/approve-market/${marketToApproveId}?address=${adminWallet}`)
      .send();

    expect(res.statusCode).toEqual(200);
    expect(res.body.market.status).toEqual('active');
  });

  it('should reject a market (admin only)', async () => {
    const adminWallet = process.env.ADMIN_WALLET || '0x7eCa382995Df91C250896c0EC73c9d2893F7800e';
    const res = await request(app)
      .post(`/api/admin/reject-market/${marketToRejectId}?address=${adminWallet}`)
      .send({ reason: 'Inappropriate content' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.market.status).toEqual('rejected');
    expect(res.body.market.metadata.rejection_reason).toEqual('Inappropriate content');
  });
});