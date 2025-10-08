const Web3 = require('web3');
const PredictionMarketABI = require('../contracts/PredictionMarket.json');

class ContractService {
  constructor() {
    // BSC Mainnet or Testnet configuration
    this.network = {
      mainnet: {
        rpcUrl: 'https://bsc-dataseed.binance.org/',
        contractAddress: 'YOUR_DEPLOYED_CONTRACT_ADDRESS'
      },
      testnet: {
        rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        contractAddress: 'YOUR_TESTNET_CONTRACT_ADDRESS'
      }
    };

    // Default to testnet
    this.currentNetwork = this.network.testnet;
    this.web3 = new Web3(new Web3.providers.HttpProvider(this.currentNetwork.rpcUrl));
    this.contract = new this.web3.eth.Contract(
      PredictionMarketABI,
      this.currentNetwork.contractAddress
    );
  }

  async createPrediction(question, expirationTime, fromAddress) {
    try {
      const tx = await this.contract.methods.createPrediction(
        question,
        expirationTime
      ).send({ from: fromAddress });

      return {
        success: true,
        predictionId: tx.events.PredictionCreated.returnValues.predictionId,
        transactionHash: tx.transactionHash
      };
    } catch (error) {
      console.error('Prediction creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async votePrediction(predictionId, vote, amount, fromAddress) {
    try {
      const tx = await this.contract.methods.vote(
        predictionId,
        vote
      ).send({
        from: fromAddress,
        value: this.web3.utils.toWei(amount.toString(), 'ether')
      });

      return {
        success: true,
        transactionHash: tx.transactionHash
      };
    } catch (error) {
      console.error('Vote submission failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getPredictionDetails(predictionId) {
    try {
      const details = await this.contract.methods.getPredictionDetails(predictionId).call();
      return {
        question: details.question,
        yesVotes: details.yesVotes,
        noVotes: details.noVotes,
        totalVolume: this.web3.utils.fromWei(details.totalVolume, 'ether'),
        expirationTime: details.expirationTime,
        resolved: details.resolved,
        result: details.result
      };
    } catch (error) {
      console.error('Fetching prediction details failed:', error);
      return null;
    }
  }

  async switchNetwork(network = 'testnet') {
    this.currentNetwork = this.network[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(this.currentNetwork.rpcUrl));
    this.contract = new this.web3.eth.Contract(
      PredictionMarketABI,
      this.currentNetwork.contractAddress
    );
  }
}

module.exports = new ContractService();