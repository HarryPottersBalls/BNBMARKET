import React from 'react';
import { colors } from '../theme/colorscheme';

function MarketCard({ market, onApprove, onReject }) {
  return (
    <div className="market-card" key={market.id}>
      <div className="market-header">
        <div>
          <div className="market-title">{market.title}</div>
          <div className="market-meta">
            Created: {new Date(market.created_at).toLocaleDateString()} | Category:{' '}
            {market.category} | Creator: {market.creator_address.substring(0, 10)}...
            <span className="status-badge status-review">Under Review</span>
          </div>
        </div>
      </div>

      {market.description && <div className="market-description">{market.description}</div>}

      {market.market_image && (
        <div>
          <strong>Market Image:</strong>
          <br />
          <img src={market.market_image} alt="Market image" className="market-image" />
        </div>
      )}

      <div className="options-container">
        <div className="options-title">Options ({market.options.length}):</div>
        {market.options.map((option, index) => (
          <div className="option-item" key={index}>
            {option.image ? (
              <img src={option.image} alt={option.name} className="option-image" />
            ) : (
              <div className="no-image">No Image</div>
            )}
            <div className="option-name">{option.name}</div>
          </div>
        ))}
      </div>

      <div style={{ margin: '10px 0', fontSize: '0.9em', color: colors.accents.neutral }}>
        <strong>Creation Fee:</strong> {market.creation_fee_paid ? '✅ Paid' : '❌ Not Paid'} |
        <strong>Initial Liquidity:</strong> {market.initial_liquidity} BNB |
        <strong>Has Images:</strong> {market.metadata.hasOptionImages ? '✅ Yes' : '❌ No'}
      </div>

      <div className="market-actions">
        <button className="approve-btn" onClick={() => onApprove(market.id)}>
          ✅ Approve Market
        </button>
        <button className="reject-btn" onClick={() => onReject(market.id)}>
          ❌ Reject Market
        </button>
      </div>
    </div>
  );
}

export default MarketCard;
