const axios = require('axios');
const ContractService = require('./ContractService');

class BackendService {
  constructor() {
    this.apiBaseUrl = process.env.BACKEND_API_URL || 'https://api.yinyangmarket.com';
  }

  async syncPredictions(walletAddress) {
    try {
      // Fetch active predictions from backend
      const response = await axios.get(`${this.apiBaseUrl}/predictions`, {
        params: { walletAddress }
      });

      const predictions = await Promise.all(
        response.data.map(async (prediction) => {
          // Fetch on-chain details
          const contractDetails = await ContractService.getPredictionDetails(prediction.contractId);

          return {
            ...prediction,
            ...contractDetails
          };
        })
      );

      return predictions;
    } catch (error) {
      console.error('Predictions sync failed:', error);
      return [];
    }
  }

  async submitVote(predictionId, vote, amount, walletAddress) {
    try {
      // Submit vote to smart contract
      const contractResult = await ContractService.votePrediction(
        predictionId,
        vote === 'YES',
        amount,
        walletAddress
      );

      if (!contractResult.success) {
        throw new Error(contractResult.error);
      }

      // Log vote to backend
      await axios.post(`${this.apiBaseUrl}/vote`, {
        predictionId,
        vote,
        amount,
        walletAddress,
        transactionHash: contractResult.transactionHash
      });

      return {
        success: true,
        transactionHash: contractResult.transactionHash
      };
    } catch (error) {
      console.error('Vote submission failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getMarketStats() {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/market-stats`);
      return response.data;
    } catch (error) {
      console.error('Market stats fetch failed:', error);
      return {
        binancePrice: '¥8,888.00',
        yinVolume: '¥9.2M',
        yangVolume: '¥9.4M',
        perfectBalance: '¥18.6M'
      };
    }
  }

  async createPrediction(question, expirationTime, walletAddress) {
    try {
      // Create prediction on smart contract
      const contractResult = await ContractService.createPrediction(
        question,
        expirationTime,
        walletAddress
      );

      if (!contractResult.success) {
        throw new Error(contractResult.error);
      }

      // Log prediction to backend
      const backendResponse = await axios.post(`${this.apiBaseUrl}/predictions`, {
        question,
        expirationTime,
        contractId: contractResult.predictionId,
        creator: walletAddress
      });

      return {
        success: true,
        predictionId: backendResponse.data.id,
        contractId: contractResult.predictionId
      };
    } catch (error) {
      console.error('Prediction creation failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BackendService();