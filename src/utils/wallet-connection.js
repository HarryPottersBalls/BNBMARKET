require('dotenv').config();
const Web3 = require('web3');
const { Web3Modal } = require('@web3modal/standalone');
const WalletConnectProvider = require('@walletconnect/web3-provider').default;

class WalletConnectionManager {
  constructor() {
    this.providers = {
      metamask: null,
      walletConnect: null,
      trustWallet: null,
      binanceChainWallet: null
    };
    this.web3 = null;
    this.walletConnectProjectId = process.env.WALLETCONNECT_PROJECT_ID || '';

    if (!this.walletConnectProjectId) {
      console.warn('WalletConnect Project ID is not set. WalletConnect functionality will be limited.');
    }

    // Initialize Web3Modal if Project ID is available
    if (this.walletConnectProjectId) {
      this.web3Modal = new Web3Modal({
        projectId: this.walletConnectProjectId,
        standaloneChains: ['eip155:56'], // BSC Mainnet
        walletConnectVersion: 2
      });
    }
  }

  async initMetaMask() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        this.providers.metamask = window.ethereum;
        this.web3 = new Web3(window.ethereum);
        return {
          connected: true,
          address: (await this.web3.eth.getAccounts())[0],
          provider: 'metamask'
        };
      } catch (error) {
        console.error('MetaMask connection failed', error);
        return { connected: false, error: error.message };
      }
    }
    return { connected: false, error: 'MetaMask not detected' };
  }

  async initWalletConnect() {
    if (!this.walletConnectProjectId) {
      return {
        connected: false,
        error: 'WalletConnect Project ID is required. Please set WALLETCONNECT_PROJECT_ID in your .env file.'
      };
    }

    try {
      const provider = new WalletConnectProvider({
        projectId: this.walletConnectProjectId,
        rpc: {
          56: 'https://bsc-dataseed.binance.org/', // Binance Smart Chain mainnet
          97: 'https://data-seed-prebsc-1-s1.binance.org:8545/' // Testnet
        },
        chainId: 56, // Default to mainnet
        qrcode: true // Show QR code modal
      });

      // Enable session (triggers QR Code modal)
      await provider.enable();

      this.providers.walletConnect = provider;
      this.web3 = new Web3(provider);

      const accounts = await this.web3.eth.getAccounts();
      return {
        connected: true,
        address: accounts[0],
        provider: 'walletConnect'
      };
    } catch (error) {
      console.error('WalletConnect failed', error);
      return { connected: false, error: error.message };
    }
  }

  async connectWallet(preferredProvider = null) {
    const providers = [
      this.initMetaMask,
      this.initWalletConnect
    ];

    // If preferred provider is specified, try that first
    if (preferredProvider && this[`init${preferredProvider}`]) {
      const result = await this[`init${preferredProvider}`]();
      if (result.connected) return result;
    }

    // Try all providers
    for (const providerInit of providers) {
      const result = await providerInit.call(this);
      if (result.connected) return result;
    }

    return {
      connected: false,
      error: 'No compatible wallet found. Please install MetaMask or use WalletConnect.'
    };
  }

  async disconnectWallet() {
    if (this.providers.walletConnect) {
      await this.providers.walletConnect.disconnect();
    }

    // Reset providers and web3
    this.providers = {
      metamask: null,
      walletConnect: null,
      trustWallet: null,
      binanceChainWallet: null
    };
    this.web3 = null;

    return { disconnected: true };
  }

  async switchToBSC() {
    const chainId = '0x38'; // BSC Mainnet
    const chainName = 'Binance Smart Chain';
    const nativeCurrency = {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18
    };
    const rpcUrls = ['https://bsc-dataseed.binance.org/'];
    const blockExplorerUrls = ['https://bscscan.com'];

    try {
      if (this.web3 && this.web3.currentProvider.request) {
        await this.web3.currentProvider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId,
            chainName,
            nativeCurrency,
            rpcUrls,
            blockExplorerUrls
          }]
        });
        return { switched: true };
      }
    } catch (error) {
      console.error('Failed to switch network', error);
      return { switched: false, error: error.message };
    }
  }
}

module.exports = new WalletConnectionManager();