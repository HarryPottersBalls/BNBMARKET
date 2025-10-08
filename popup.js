document.addEventListener('DOMContentLoaded', async function() {
  const connectButton = document.getElementById('connectWallet');
  let currentAccount = null;

  // Check if already connected
  chrome.storage.local.get(['walletConnected', 'account'], function(result) {
    if (result.walletConnected && result.account) {
      updateWalletUI(result.account);
      currentAccount = result.account;
    }
  });

  connectButton.addEventListener('click', async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });

        if (accounts.length > 0) {
          currentAccount = accounts[0];
          updateWalletUI(currentAccount);

          // Save connection state
          chrome.storage.local.set({
            walletConnected: true,
            account: currentAccount
          });

          // Fetch initial predictions and market data
          await loadMarketData();
          await loadPredictions();
        }

      } catch (error) {
        console.error('Error connecting wallet:', error);
        showNotification('Error connecting wallet. Please try again.', 'error');
      }
    } else {
      showNotification('Please install MetaMask!', 'error');
    }
  });

  // Vote functionality with backend integration
  document.querySelectorAll('.vote-btn').forEach(button => {
    button.addEventListener('click', async function() {
      if (!currentAccount) {
        showNotification('Please connect wallet first!', 'error');
        return;
      }

      const predictionCard = this.closest('.prediction-card');
      const question = predictionCard.querySelector('.prediction-question').textContent;
      const voteType = this.textContent;

      // Vote animation
      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = 'scale(1)';
      }, 150);

      try {
        // Simulated backend vote submission
        const response = await submitVote(question, voteType, currentAccount);

        // Update local vote count
        updateVoteUI(predictionCard, response.votes);

        showNotification(`Voted ${voteType} successfully!`, 'info');
      } catch (error) {
        showNotification('Vote submission failed', 'error');
        console.error('Vote error:', error);
      }
    });
  });

  // Initial load if already connected
  if (currentAccount) {
    await loadMarketData();
    await loadPredictions();
  }
});

async function submitVote(prediction, voteType, walletAddress) {
  return new Promise((resolve, reject) => {
    // In a real-world scenario, this would call a backend service
    chrome.storage.local.get(['votes'], function(result) {
      const votes = result.votes || {};
      votes[prediction] = votes[prediction] || { yes: 0, no: 0 };

      if (voteType === 'YES') {
        votes[prediction].yes++;
      } else {
        votes[prediction].no++;
      }

      chrome.storage.local.set({ votes: votes }, function() {
        resolve({ votes: votes[prediction] });
      });
    });
  });
}

async function loadMarketData() {
  try {
    const marketData = await fetchMarketData();

    // Update Binance price
    const binancePriceEl = document.querySelector('.binance-price');
    if (binancePriceEl) {
      binancePriceEl.textContent = `Binance\n${marketData.binancePrice}`;
    }

    // Update volume stats
    const statCards = document.querySelectorAll('.stat-card');
    if (statCards.length >= 3) {
      statCards[0].querySelector('.stat-value').textContent = marketData.yinVolume;
      statCards[1].querySelector('.stat-value').textContent = marketData.perfectBalance;
      statCards[2].querySelector('.stat-value').textContent = marketData.yangVolume;
    }
  } catch (error) {
    console.error('Market data load failed:', error);
    showNotification('Failed to load market data', 'error');
  }
}

async function loadPredictions() {
  try {
    const predictions = await fetchPredictions();

    const predictionCards = document.querySelectorAll('.prediction-card');
    predictions.forEach((pred, index) => {
      if (predictionCards[index]) {
        const card = predictionCards[index];

        // Update prediction question if needed
        const questionEl = card.querySelector('.prediction-question');
        if (questionEl) questionEl.textContent = pred.question;

        // Update volume badge
        const volumeBadge = card.querySelector('.volume-badge');
        if (volumeBadge) {
          volumeBadge.textContent = `Volume: ${pred.volume} • ${pred.trend.toUpperCase()}`;
          volumeBadge.className = `volume-badge ${pred.trend}`;
        }

        // Update vote counts
        const yesVoteBtn = card.querySelector('.vote-btn.yes');
        const noVoteBtn = card.querySelector('.vote-btn.no');

        if (yesVoteBtn) {
          yesVoteBtn.nextElementSibling.textContent = pred.yesVotes;
        }

        if (noVoteBtn) {
          noVoteBtn.nextElementSibling.textContent = pred.noVotes;
        }
      }
    });
  } catch (error) {
    console.error('Predictions load failed:', error);
    showNotification('Failed to load predictions', 'error');
  }
}

function updateWalletUI(account) {
  const connectButton = document.getElementById('connectWallet');
  const shortenedAccount = `${account.slice(0, 6)}...${account.slice(-4)}`;

  connectButton.textContent = `Connected: ${shortenedAccount}`;
  connectButton.classList.add('connected');
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: ${type === 'error' ? '#E53E3E' : '#38A169'};
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 1000;
    font-size: 0.8rem;
    transition: opacity 0.3s;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Mock fetch functions (replace with actual API calls in production)
async function fetchMarketData() {
  return {
    binancePrice: '¥8,888.00',
    yinVolume: '¥9.2M',
    yangVolume: '¥9.4M',
    perfectBalance: '¥18.6M'
  };
}

// Import WASM module
import init, { calculate_lmsr_probabilities } from './wasm-lmsr/pkg/wasm_lmsr.js';

// WASM initialization
let wasmInitialized = false;
async function initWASM() {
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
}

// LMSR Probability Calculation
function calculateLMSRProbabilities(liquidity, numOutcomes, bets) {
  if (!wasmInitialized) {
    console.warn('WASM not initialized');
    return null;
  }
  return calculate_lmsr_probabilities(liquidity, numOutcomes, bets);
}

async function fetchPredictions() {
  await initWASM(); // Ensure WASM is initialized

  // Example of using WASM for probability calculation
  const predictionBets = [684, 324];
  const probabilities = calculateLMSRProbabilities(10.0, 2, predictionBets);

  return [
    {
      question: 'Will Bitcoin reach $100k by end of 2025?',
      yesVotes: 684,
      noVotes: 324,
      volume: '¥2.4M',
      trend: 'yang',
      probability: probabilities ? probabilities[0] : null
    },
    {
      question: 'Chinese GDP growth exceeds 5.5% this year?',
      yesVotes: 554,
      noVotes: 454,
      volume: '¥1.8M',
      trend: 'balanced',
      probability: probabilities ? probabilities[1] : null
    }
  ];
}

// Optional: Add disconnect functionality
function disconnectWallet() {
  chrome.storage.local.remove(['walletConnected', 'account'], function() {
    const connectButton = document.getElementById('connectWallet');
    connectButton.textContent = 'Connect Wallet';
    connectButton.classList.remove('connected');
  });
}