import React, { useState, useEffect } from 'react';
import MarketCard from '../components/MarketCard.jsx';
import '../styles/Admin.css';

const API_BASE = '/api';

function Admin() {
  const [wallet, setWallet] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingMarkets, setPendingMarkets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null); // 'success' or 'error'

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage(null);
      setMessageType(null);
    }, 5000); // Message disappears after 5 seconds
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      showMessage('MetaMask not found! Please install MetaMask.', 'error');
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        const connectedWallet = accounts[0];
        setWallet(connectedWallet);

        const response = await fetch(`${API_BASE}/admin/check/${connectedWallet}`);
        const data = await response.json();

        setIsAdmin(data.isAdmin);

        if (data.isAdmin) {
          showMessage('Wallet connected and admin status confirmed.', 'success');
          loadPendingMarkets(connectedWallet);
          loadStats();
        } else {
          showMessage('Access denied: Admin wallet required.', 'error');
        }
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      showMessage('Failed to connect wallet: ' + error.message, 'error');
    }
  };

  const loadPendingMarkets = async (adminAddress) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/pending-markets?address=${adminAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPendingMarkets(data.markets);
      showMessage('Pending markets refreshed.', 'success');
    } catch (err) {
      console.error('Error loading pending markets:', err);
      setError('Failed to load pending markets.');
      showMessage('Failed to load pending markets.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const response = await fetch(`${API_BASE}/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
      showMessage('Statistics loaded.', 'success');
    } catch (err) {
      console.error('Error loading stats:', err);
      setStatsError('Failed to load statistics.');
      showMessage('Failed to load statistics.', 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  const approveMarket = async (marketId) => {
    if (!window.confirm('Approve this market? It will become active and available for betting.'))
      return;

    try {
      const response = await fetch(
        `${API_BASE}/admin/approve-market/${marketId}?address=${wallet}`,
        {
          method: 'POST',
        }
      );

      const data = await response.json();

      if (response.ok) {
        showMessage('Market approved successfully!', 'success');
        loadPendingMarkets(wallet);
        loadStats();
      } else {
        showMessage('Failed to approve market: ' + data.error, 'error');
      }
    } catch (error) {
      console.error('Error approving market:', error);
      showMessage('Error approving market: ' + error.message, 'error');
    }
  };

  const rejectMarket = async (marketId) => {
    const reason = window.prompt('Enter rejection reason (optional):');
    if (reason === null) return; // User cancelled

    try {
      const response = await fetch(
        `${API_BASE}/admin/reject-market/${marketId}?address=${wallet}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason || 'No reason provided' }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        showMessage('Market rejected successfully!', 'success');
        loadPendingMarkets(wallet);
        loadStats();
      } else {
        showMessage('Failed to reject market: ' + data.error, 'error');
      }
    } catch (error) {
      console.error('Error rejecting market:', error);
      showMessage('Error rejecting market: ' + error.message, 'error');
    }
  };

  const autoApproveAdminMarkets = async () => {
    if (!window.confirm('Auto-approve all admin-created markets that are stuck in review?')) return;

    try {
      const response = await fetch(
        `${API_BASE}/admin/auto-approve-admin-markets?address=${wallet}`,
        {
          method: 'POST',
        }
      );

      const data = await response.json();

      if (response.ok) {
        showMessage(`Auto-approved ${data.count} admin markets!`, 'success');
        loadPendingMarkets(wallet);
        loadStats();
      } else {
        showMessage('Failed to auto-approve: ' + data.error, 'error');
      }
    } catch (error) {
      console.error('Error auto-approving:', error);
      showMessage('Error auto-approving: ' + error.message, 'error');
    }
  };

  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const connectedWallet = accounts[0];
            setWallet(connectedWallet);
            const response = await fetch(`${API_BASE}/admin/check/${connectedWallet}`);
            const data = await response.json();
            setIsAdmin(data.isAdmin);
            if (data.isAdmin) {
              loadPendingMarkets(connectedWallet);
              loadStats();
            }
          }
        } catch (error) {
          console.error('Auto-connect error:', error);
        }
      }
    };

    checkWalletConnection();
  }, []);

  return (
    <div>
      <div className="admin-header">
        <h1>🛡️ BNBmarket Admin Dashboard</h1>
        <p>Review and manage prediction markets</p>
      </div>

      {message && (
        <div
          className={`info-panel ${messageType === 'error' ? 'error' : ''}`}
          style={{ margin: '20px' }}
        >
          {message}
        </div>
      )}

      <div className="wallet-connection">
        {!wallet ? (
          <button
            className="connect-btn"
            onClick={connectWallet}
            disabled={loading || statsLoading}
          >
            Connect Admin Wallet
          </button>
        ) : (
          <div>
            <p>
              Connected: <span>{wallet}</span>
            </p>
            <p>
              Status: <span>{isAdmin ? '✅ ADMIN' : '❌ NOT ADMIN'}</span>
            </p>
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          <div className="admin-actions">
            <button
              className="action-btn"
              onClick={() => loadPendingMarkets(wallet)}
              disabled={loading || statsLoading}
            >
              📋 Refresh Pending Markets
            </button>
            <button
              className="action-btn"
              onClick={autoApproveAdminMarkets}
              disabled={loading || statsLoading}
            >
              ✅ Auto-Approve Admin Markets
            </button>
            <button className="action-btn" onClick={loadStats} disabled={loading || statsLoading}>
              📊 Load Statistics
            </button>
          </div>

          <div className="stats-grid">
            {statsLoading && <div className="loading">Loading statistics...</div>}
            {statsError && <div className="error">{statsError}</div>}
            {stats && (
              <>
                <div className="stat-card">
                  <div className="stat-value">{pendingMarkets.length}</div>
                  <div className="stat-label">Pending Review</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalMarkets}</div>
                  <div className="stat-label">Total Markets</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalBets}</div>
                  <div className="stat-label">Total Bets</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalVolume.toFixed(2)}</div>
                  <div className="stat-label">Total Volume (BNB)</div>
                </div>
              </>
            )}
          </div>

          <div className="markets-container">
            {loading && <div className="loading">Loading pending markets...</div>}
            {error && <div className="error">{error}</div>}
            {!loading && !error && pendingMarkets.length === 0 && (
              <div className="info-panel">
                <h3>No pending markets</h3>
                <p>All markets have been reviewed. Admin-created markets are auto-approved.</p>
              </div>
            )}
            {!loading && !error && pendingMarkets.length > 0 && (
              <div id="marketsContent">
                {pendingMarkets.map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    onApprove={approveMarket}
                    onReject={rejectMarket}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Admin;
