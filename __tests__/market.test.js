const MockDataGenerator = require('./utils/mockData');

describe('Market Data Generation', () => {
  it('should generate realistic mock market data', () => {
    const { users, markets, bets } = MockDataGenerator.generateMockDataSet(5);

    expect(users.length).toBe(5);
    expect(markets.length).toBe(5);
    expect(bets.length).toBe(25); // 5 markets * 5 users

    users.forEach(user => {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('walletAddress');
    });

    markets.forEach(market => {
      expect(market).toHaveProperty('id');
      expect(market).toHaveProperty('title');
      expect(market.isResolved).toBe(false);
    });
  });
});