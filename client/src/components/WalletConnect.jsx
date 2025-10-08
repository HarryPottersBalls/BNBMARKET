import React, { useState } from 'react';
import walletConnection from '../utils/walletConnection';

export function WalletConnect() {
  const [wallet, setWallet] = useState({
    connected: false,
    address: null,
    error: null,
  });

  const connectWallet = async () => {
    const result = await walletConnection.connectMetaMask();
    setWallet(result);
  };

  const switchToBSC = async () => {
    const result = await walletConnection.switchToBSC();
    if (result.switched) {
      console.log('Switched to BSC successfully');
    } else {
      console.error('Failed to switch network', result.error);
    }
  };

  const disconnectWallet = async () => {
    await walletConnection.disconnectWallet();
    setWallet({
      connected: false,
      address: null,
      error: null,
    });
  };

  return (
    <div>
      {!wallet.connected ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          <p>Connected: {wallet.address}</p>
          <button onClick={switchToBSC}>Switch to BSC</button>
          <button onClick={disconnectWallet}>Disconnect</button>
        </div>
      )}
      {wallet.error && <p style={{ color: 'red' }}>{wallet.error}</p>}
    </div>
  );
}
