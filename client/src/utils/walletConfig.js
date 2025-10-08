import { createConfig, http } from 'wagmi';
import { mainnet, bsc } from 'wagmi/chains';
import { injected, metaMask } from 'wagmi/connectors';

// Simple MetaMask integration - no API keys needed!
export const config = createConfig({
  chains: [mainnet, bsc],
  connectors: [
    metaMask({
      dappMetadata: {
        name: 'BNBMarket',
        url: 'https://bnbmarket.com',
      },
    }),
    injected(), // Fallback for other injected wallets (Trust, Coinbase, etc.)
  ],
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http('https://bsc-dataseed.binance.org/'),
  },
});
