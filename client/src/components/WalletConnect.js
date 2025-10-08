import React from 'react';
import { useWalletConnection } from '../hooks/useWalletConnection';

const WalletConnect = () => {
  const { wallet, connectWallet, disconnectWallet, switchToBSC } = useWalletConnection();

  const handleConnect = async (provider = null) => {
    await connectWallet(provider);
  };

  return (
    <div>
      {!wallet.connected ? (
        <div>
          <button onClick={() => handleConnect('MetaMask')}>Connect MetaMask</button>
          <button onClick={() => handleConnect('WalletConnect')}>Connect WalletConnect</button>
          <button onClick={() => handleConnect('TrustWallet')}>Connect Trust Wallet</button>
        </div>
      ) : (
        <div>
          <p>Connected: {wallet.address}</p>
          <p>Provider: {wallet.provider}</p>
          <button onClick={disconnectWallet}>Disconnect</button>
          <button onClick={switchToBSC}>Switch to BSC</button>
        </div>
      )}
      {wallet.error && <p style={{ color: 'red' }}>{wallet.error}</p>}
    </div>
  );
};

export default WalletConnect;
