import { MetaMaskSDK } from '@metamask/sdk';

const MMSDK = new MetaMaskSDK({
  useDeeplink: false,
  communicationMode: 'webview',
  checkInstallationImmediately: false,
  dappMetadata: {
    name: 'BNBMARKET',
    url: window.location.origin,
  }
});

const connectWallet = async (preferredProvider = null) => {
  try {
    // Request account access
    const accounts = await MMSDK.connect();

    if (!accounts || accounts.length === 0) {
      return {
        connected: false,
        error: 'Connection failed or no accounts found'
      };
    }

    return {
      address: accounts[0],
      connected: true,
      provider: 'MetaMask',
      error: null
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
};

const disconnectWallet = async () => {
  try {
    MMSDK.disconnect();
    return {
      disconnected: true,
      message: 'Wallet disconnected'
    };
  } catch (error) {
    return {
      disconnected: false,
      error: error.message
    };
  }
};

const switchToBSC = async () => {
  try {
    const chainId = '0x38'; // BSC Mainnet
    await MMSDK.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: chainId,
        chainName: 'Binance Smart Chain',
        nativeCurrency: {
          name: 'BNB',
          symbol: 'BNB',
          decimals: 18
        },
        rpcUrls: ['https://bsc-dataseed.binance.org/'],
        blockExplorerUrls: ['https://bscscan.com/']
      }]
    });

    return {
      switched: true,
      network: 'BSC'
    };
  } catch (error) {
    return {
      switched: false,
      error: error.message
    };
  }
};

const walletConnection = {
  connectWallet,
  disconnectWallet,
  switchToBSC
};

export default walletConnection;
