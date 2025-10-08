const axios = require('axios');

class MarketService {
  constructor() {
    this.baseURL = process.env.MARKET_API_URL || 'https://api.yinyangmarket.com';
  }

  async getMarketData() {
    try {
      const response = await axios.get(`${this.baseURL}/market-stats`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      return {
        binancePrice: '¥8,888.00',
        yinVolume: '¥9.2M',
        yangVolume: '¥9.4M',
        perfectBalance: '¥18.6M'
      };
    }
  }

  async submitVote(prediction, voteType, walletAddress) {
    try {
      const response = await axios.post(`${this.baseURL}/vote`, {
        prediction,
        voteType,
        walletAddress
      });
      return response.data;
    } catch (error) {
      console.error('Failed to submit vote:', error);
      throw error;
    }
  }

  async getPredictions() {
    try {
      const response = await axios.get(`${this.baseURL}/predictions`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
      return [
        {
          question: 'Will Bitcoin reach $100k by end of 2025?',
          yesVotes: 684,
          noVotes: 324,
          volume: '¥2.4M',
          trend: 'yang'
        },
        {
          question: 'Chinese GDP growth exceeds 5.5% this year?',
          yesVotes: 554,
          noVotes: 454,
          volume: '¥1.8M',
          trend: 'balanced'
        }
      ];
    }
  }
}

module.exports = new MarketService();