const { faker } = require('@faker-js/faker');

// Mock data generators for various entities
class MockDataGenerator {
  // Generate a mock user
  static generateUser(overrides = {}) {
    return {
      id: faker.string.uuid(),
      username: faker.internet.username(), // Fixed: updated from deprecated userName()
      email: faker.internet.email(),
      walletAddress: faker.finance.ethereumAddress(),
      ...overrides
    };
  }

  // Generate a mock market
  static generateMarket(overrides = {}) {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      category: faker.helpers.arrayElement([
        'Sports', 'Politics', 'Finance', 'Technology', 'Entertainment'
      ]),
      resolutionDate: faker.date.future(),
      isResolved: false,
      ...overrides
    };
  }

  // Generate a mock bet
  static generateBet(marketId, userId, overrides = {}) {
    return {
      id: faker.string.uuid(),
      marketId,
      userId,
      amount: parseFloat(faker.finance.amount()),
      outcome: faker.helpers.arrayElement(['Yes', 'No']),
      timestamp: faker.date.recent(),
      ...overrides
    };
  }

  // Generate multiple mock entities
  static generateMockDataSet(count = 10) {
    const users = Array.from({ length: count }, () => this.generateUser());
    const markets = Array.from({ length: count }, () => this.generateMarket());

    const bets = markets.flatMap(market =>
      users.map(user => this.generateBet(market.id, user.id))
    );

    return { users, markets, bets };
  }
}

module.exports = MockDataGenerator;