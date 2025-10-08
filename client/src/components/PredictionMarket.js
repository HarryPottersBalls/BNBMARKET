import React, { useState } from 'react';
import WalletConnect from './WalletConnect';
import { colors } from '../theme/colorscheme';

function PredictionMarket({ question, totalVolume, yesVolume, noVolume }) {
  const calculateProbability = (volume, total) => {
    return total > 0 ? ((volume / total) * 100).toFixed(0) : 0;
  };

  const yesProbability = calculateProbability(yesVolume, totalVolume);
  const noProbability = calculateProbability(noVolume, totalVolume);

  return (
    <div className="prediction-market" style={{ backgroundColor: colors.primary.dark }}>
      <div className="market-header" style={{ backgroundColor: colors.accents.yin }}>
        <h3 style={{ color: colors.text.light }}>{question}</h3>
        <div className="market-volume" style={{ color: colors.text.light }}>
          Total Volume: {totalVolume}
        </div>
      </div>

      <div className="market-options">
        <div
          className="option yes-option"
          style={{
            width: `${yesProbability}%`,
            backgroundColor: colors.accents.balanced,
          }}
        >
          <span className="option-label">Yes</span>
          <span className="option-probability">{yesProbability}¢</span>
          <span className="option-volume">{yesVolume}</span>
        </div>
        <div
          className="option no-option"
          style={{
            width: `${noProbability}%`,
            backgroundColor: colors.accents.yang,
          }}
        >
          <span className="option-label">No</span>
          <span className="option-probability">{noProbability}¢</span>
          <span className="option-volume">{noVolume}</span>
        </div>
      </div>
    </div>
  );
}

function PredictionMarketPage() {
  const markets = [
    {
      question: 'Will Bitcoin reach $100K by end of 2025?',
      totalVolume: 2.4,
      yesVolume: 1.6,
      noVolume: 0.8,
    },
    {
      question: 'Chinese GDP growth exceeds 5.5% this year?',
      totalVolume: 1.8,
      yesVolume: 1.1,
      noVolume: 0.7,
    },
  ];

  return (
    <div className="prediction-market-page" style={{ backgroundColor: colors.background }}>
      <header>
        <h1 style={{ color: colors.text.light }}>Prediction Markets</h1>
        <WalletConnect />
      </header>

      {markets.map((market, index) => (
        <PredictionMarket key={index} {...market} />
      ))}
    </div>
  );
}

export default PredictionMarketPage;
