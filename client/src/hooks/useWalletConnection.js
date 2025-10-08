import { useState, useEffect } from 'react';
import WalletConnectionManager from '../utils/walletConnection';

export const useWalletConnection = () => {
  const [wallet, setWallet] = useState({
    address: null,
    connected: false,
    provider: null,
    error: null,
  });

  const connectWallet = async (preferredProvider = null) => {
    try {
      const result = await WalletConnectionManager.connectWallet(preferredProvider);
      setWallet({
        address: result.address,
        connected: result.connected,
        provider: result.provider,
        error: result.error,
      });
      return result;
    } catch (error) {
      setWallet({
        address: null,
        connected: false,
        provider: null,
        error: error.message,
      });
      return { connected: false, error: error.message };
    }
  };

  const disconnectWallet = async () => {
    const result = await WalletConnectionManager.disconnectWallet();
    if (result.disconnected) {
      setWallet({
        address: null,
        connected: false,
        provider: null,
        error: null,
      });
    }
    return result;
  };

  const switchToBSC = async () => {
    return await WalletConnectionManager.switchToBSC();
  };

  return {
    wallet,
    connectWallet,
    disconnectWallet,
    switchToBSC,
  };
};
