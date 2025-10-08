import Web3 from 'web3';

class WalletConnectionManager {
  constructor() {
    this.web3 = null;
    this.account = null;
  }

  async connectMetaMask() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });

        this.web3 = new Web3(window.ethereum);
        this.account = accounts[0];

        return {
          connected: true,
          address: this.account,
          provider: 'MetaMask',
        };
      } catch (error) {
        console.error('MetaMask connection failed', error);
        return {
          connected: false,
          error: error.message,
        };
      }
    }
    return {
      connected: false,
      error: 'MetaMask not detected',
    };
  }

  async switchToBSC() {
    if (!this.web3) {
      return {
        switched: false,
        error: 'Not connected to a wallet',
      };
    }

    const chainId = '0x38'; // BSC Mainnet
    const chainName = 'Binance Smart Chain';
    const nativeCurrency = {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    };
    const rpcUrls = ['https://bsc-dataseed.binance.org/'];
    const blockExplorerUrls = ['https://bscscan.com'];

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId,
            chainName,
            nativeCurrency,
            rpcUrls,
            blockExplorerUrls,
          },
        ],
      });
      return { switched: true };
    } catch (error) {
      console.error('Failed to switch network', error);
      return {
        switched: false,
        error: error.message,
      };
    }
  }

  async disconnectWallet() {
    this.web3 = null;
    this.account = null;
    return { disconnected: true };
  }
}

export default new WalletConnectionManager();
