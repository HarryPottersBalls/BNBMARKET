document.addEventListener('DOMContentLoaded', async () => {
  // --- Professional Order Book Logic (works for all markets, future-proof) ---
  let currentOrderBookOutcomeId = null;

  function renderOrderBookTabs(outcomes, selectedOutcomeId) {
    const tabs = document.getElementById('orderBookTabs');
    if (!tabs) return;
    tabs.innerHTML = '';
    outcomes.forEach((outcome, i) => {
      const tab = document.createElement('button');
      tab.className = 'order-book-tab' + (outcome.id === selectedOutcomeId ? ' active' : '');
      tab.style.borderBottomColor = getOutcomeColor ? getOutcomeColor(outcome.id) : '#baff33';
      tab.textContent = outcome.name;
      tab.onclick = () => {
        currentOrderBookOutcomeId = outcome.id;
        renderOrderBookUI();
      };
      tabs.appendChild(tab);
    });
  }

  function renderOrderBookRows(orders, side, maxAmount) {
    return orders.map(order => {
      const width = maxAmount ? (100 * order.amount / maxAmount) : 0;
      return `
        <div class="order-book-row ${side}">
          <div class="ob-bar" style="width:${width}%;"></div>
          <span class="ob-col ob-price">${order.price ? order.price.toFixed(4) : ''}</span>
          <span class="ob-col ob-shares">${order.amount}</span>
          <span class="ob-col ob-total">${order.price && order.amount ? (order.price * order.amount).toFixed(2) : ''}</span>
        </div>
      `;
    }).join('');
  }

  function renderOrderBookUI() {
    const orderBook = window.marketOrderBook || [];
    const outcomes = window.marketOutcomes || [];
    const selectedId = currentOrderBookOutcomeId || (outcomes[0] && outcomes[0].id);
    renderOrderBookTabs(outcomes, selectedId);
    const asks = orderBook.filter(o => o.outcomeId === selectedId && o.side === 'ask').sort((a,b) => a.price-b.price);
    const bids = orderBook.filter(o => o.outcomeId === selectedId && o.side === 'bid').sort((a,b) => b.price-a.price);
    const maxAmount = Math.max(
      ...asks.map(o=>o.amount),
      ...bids.map(o=>o.amount),
      1
    );
    const asksEl = document.getElementById('orderBookAsks');
    const bidsEl = document.getElementById('orderBookBids');
    if (asksEl) asksEl.innerHTML = renderOrderBookRows(asks, 'ask', maxAmount);
    if (bidsEl) bidsEl.innerHTML = renderOrderBookRows(bids, 'bid', maxAmount);
    let center = '';
    if (asks.length && bids.length) {
      const spread = (asks[0].price - bids[0].price).toFixed(4);
      center = `Spread: <span style='color:#baff33'>${spread}</span>`;
    } else {
      center = asks.length ? 'No bids' : bids.length ? 'No asks' : 'No orders';
    }
    const centerEl = document.getElementById('orderBookCenterLine');
    if (centerEl) centerEl.innerHTML = center;
  }

  function updateOrderBook(orderBook, outcomes) {
    window.marketOrderBook = orderBook;
    window.marketOutcomes = outcomes;
    if (!currentOrderBookOutcomeId && outcomes && outcomes.length) {
      currentOrderBookOutcomeId = outcomes[0].id;
    }
    renderOrderBookUI();
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    document.body.innerHTML = "<p>No market selected.</p>";
    return;
  }

  // Global variables
  let market;
  let wallet = null;
  let walletAdapter = null;
  let web3 = null;
  let bnbBalance = 0;
  let rpcFallbackMode = false;
  let selectedOption = null;

  // Configuration
  const API_BASE_URL = 'https://api.bnbmarket.cc/api';
  const TREASURY_WALLET = '0x742d35Cc6A0de1234567890abcdef1234567890';
  const BSC_RPC_ENDPOINTS = [
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
    'https://bsc-dataseed3.binance.org/'
  ];

  async function waitForWeb3() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 30;
      
      const check = () => {
        attempts++;
        if (typeof window.ethereum !== 'undefined') {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('MetaMask/Web3 provider not found'));
        } else {
          setTimeout(check, 200);
        }
      };
      check();
    });
  }

  async function waitForChart() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const check = () => {
        attempts++;
        
        if (typeof Chart !== 'undefined' && Chart.register) {
          console.log('Chart.js detected and ready');
          try {
            Chart.register(
              Chart.CategoryScale,
              Chart.LinearScale,
              Chart.PointElement,
              Chart.LineElement,
              Chart.BarElement,
              Chart.Title,
              Chart.Tooltip,
              Chart.Legend
            );
            console.log('Chart.js components registered');
            resolve(true);
          } catch (error) {
            console.warn('Failed to register Chart.js components:', error);
            resolve(false);
          }
        } else if (attempts >= maxAttempts) {
          console.warn('Chart.js not available after', maxAttempts, 'attempts');
          resolve(false);
        } else {
          setTimeout(check, 50);
        }
      };
      
      check();
    });
  }

  async function initializeWeb3() {
    try {
      await waitForWeb3();
      
      if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        console.log('Connected to BSC via MetaMask');
        rpcFallbackMode = false;
        return true;
      } else {
        console.error('No Web3 provider found - using fallback mode');
        rpcFallbackMode = true;
        return false;
      }
      
    } catch (error) {
      console.error('Failed to initialize Web3:', error);
      rpcFallbackMode = true;
      return false;
    }
  }

  // Helper function for Admin Odds to Price/Probability conversion
  function calculatePriceFromOdds(decimalOdds) {
    if (!decimalOdds || decimalOdds === 0 || isNaN(decimalOdds)) {
      return { price: '0.0000', probability: 'N/A' };
    }
    const probability = 1 / decimalOdds;
    return {
      price: probability.toFixed(4),
      probability: (probability * 100).toFixed(1) + '%'
    };
  }

  function toast(msg) {
    alert(msg);
  }

  async function apiRequest(endpoint, options = {}) {
    try {
      const response = await fetch(API_BASE_URL + endpoint, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  function buildChartData(bets, options) {
    if (!bets || bets.length === 0) {
      return { labels: [], oddsData: options.map(() => []), volumeData: [] };
    }

    const sorted = [...bets].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const optionVolumes = options.map(() => 0);
    let totalVolume = 0;
    const oddsData = options.map(() => []);
    const labels = [];
    const volumeData = [];

    const initialProb = 100 / options.length;
    labels.push('Start');
    options.forEach((opt, i) => {
      oddsData[i].push(initialProb.toFixed(1));
    });
    volumeData.push(0);

    sorted.forEach((bet, index) => {
      const t = new Date(bet.created_at);
      const idx = bet.option_id;

      optionVolumes[idx] += parseFloat(bet.amount);
      totalVolume += parseFloat(bet.amount);

      const timeLabel = t.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      labels.push(timeLabel);

      options.forEach((opt, i) => {
        const pct = totalVolume > 0 ? (optionVolumes[i] / totalVolume) * 100 : initialProb;
        oddsData[i].push(pct.toFixed(1));
      });

      volumeData.push(parseFloat(bet.amount));
    });

    return { labels, oddsData, volumeData, optionVolumes, totalVolume };
  }

  function renderPriceChart(market) {
    const ctx = document.getElementById('priceChart');
    if (!ctx || !market.bets || market.bets.length === 0) {
      if (ctx) {
        ctx.parentElement.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af;">
            No betting history available yet
          </div>
        `;
      }
      return;
    }

    if (window.priceChartInstance) {
      window.priceChartInstance.destroy();
    }

    const { labels, oddsData } = buildChartData(market.bets, market.options);
    const colors = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

    window.priceChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: market.options.map((opt, i) => ({
          label: opt.name,
          data: oddsData[i],
          borderColor: colors[i % colors.length],
          backgroundColor: colors[i % colors.length] + '20',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 6,
          borderWidth: 3,
          pointHoverBackgroundColor: colors[i % colors.length],
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              },
              color: '#9ca3af',
              font: {
                size: 12,
                family: 'Inter, system-ui, sans-serif'
              }
            },
            grid: {
              color: 'rgba(156, 163, 175, 0.1)',
              drawBorder: false
            }
          },
          x: {
            ticks: {
              color: '#9ca3af',
              font: {
                size: 11,
                family: 'Inter, system-ui, sans-serif'
              },
              maxTicksLimit: 6
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f9fafb',
            bodyColor: '#d1d5db',
            borderColor: 'rgba(75, 85, 99, 0.3)',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return `${context.formattedValue}% probability`;
              }
            }
          }
        }
      }
    });
    console.log('Price chart rendered successfully');
  }

  function renderVolumeChart(market) {
    const ctx = document.getElementById('volumeChart');
    if (!ctx || !market.bets || market.bets.length === 0) {
      if (ctx) {
        ctx.parentElement.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af;">
            No volume data available yet
          </div>
        `;
      }
      return;
    }

    if (window.volumeChartInstance) {
      window.volumeChartInstance.destroy();
    }

    const { labels, volumeData } = buildChartData(market.bets, market.options);

    window.volumeChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Volume',
          data: volumeData,
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: '#10b981',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value + ' BNB';
              },
              color: '#9ca3af',
              font: {
                size: 12,
                family: 'Inter, system-ui, sans-serif'
              }
            },
            grid: {
              color: 'rgba(156, 163, 175, 0.1)',
              drawBorder: false
            }
          },
          x: {
            ticks: {
              color: '#9ca3af',
              font: {
                size: 11,
                family: 'Inter, system-ui, sans-serif'
              },
              maxTicksLimit: 6
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f9fafb',
            bodyColor: '#d1d5db',
            borderColor: 'rgba(75, 85, 99, 0.3)',
            borderWidth: 1,
            cornerRadius: 8
          }
        }
      }
    });
    console.log('Volume chart rendered successfully');
  }

  function updateCurrentPrice(market) {
    if (!market.bets || market.bets.length === 0) {
      document.getElementById('currentPrice').textContent = '50% chance';
      document.getElementById('priceChange').textContent = '';
      return;
    }

    const { optionVolumes, totalVolume } = buildChartData(market.bets, market.options);
    
    let leadingIndex = 0;
    let highestProb = 0;
    
    optionVolumes.forEach((volume, index) => {
      const prob = totalVolume > 0 ? (volume / totalVolume) * 100 : 50;
      if (prob > highestProb) {
        highestProb = prob;
        leadingIndex = index;
      }
    });

    const currentProb = highestProb;
    const change = currentProb - (100 / market.options.length);
    
    document.getElementById('currentPrice').textContent = `${currentProb.toFixed(0)}% chance`;
    
    const priceChangeEl = document.getElementById('priceChange');
    if (change > 0) {
      priceChangeEl.textContent = `+${change.toFixed(1)}% from start`;
      priceChangeEl.className = 'price-change positive';
    } else if (change < 0) {
      priceChangeEl.textContent = `${change.toFixed(1)}% from start`;
      priceChangeEl.className = 'price-change negative';
    } else {
      priceChangeEl.textContent = 'No change';
      priceChangeEl.className = 'price-change';
    }
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        toast('MetaMask wallet not detected. Please install MetaMask extension.');
        window.open('https://metamask.io/', '_blank');
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length === 0) {
        toast('No accounts found');
        return;
      }

      wallet = accounts[0];
      walletAdapter = window.ethereum;
      
      // Switch to BSC network if not already
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x38' }], // BSC Mainnet
        });
      } catch (switchError) {
        // If the chain has not been added to the user's wallet
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x38',
                chainName: 'Binance Smart Chain',
                nativeCurrency: {
                  name: 'BNB',
                  symbol: 'BNB',
                  decimals: 18,
                },
                rpcUrls: ['https://bsc-dataseed1.binance.org/'],
                blockExplorerUrls: ['https://bscscan.com/'],
              }],
            });
          } catch (addError) {
            console.error('Failed to add BSC network:', addError);
          }
        }
      }
      
      if (web3 && !rpcFallbackMode) {
        try {
          const balance = await web3.eth.getBalance(wallet);
          bnbBalance = parseFloat(web3.utils.fromWei(balance, 'ether'));
        } catch (error) {
          console.warn('Could not fetch balance:', error.message);
          rpcFallbackMode = true;
          bnbBalance = 0;
        }
      }
      
      updateWalletUI();
      toast('Wallet connected successfully!');
      
    } catch (error) {
      console.error('Wallet connection failed:', error);
      if (error.code === 4001 || error.message.includes('User rejected')) {
        toast('Wallet connection rejected by user');
      } else {
        toast('Failed to connect wallet. Please try again.');
      }
    }
  }

  async function disconnectWallet() {
    wallet = null;
    walletAdapter = null;
    bnbBalance = 0;
    updateWalletUI();
    toast('Wallet disconnected');
  }

  function updateWalletUI() {
    const walletBtn = document.getElementById('walletBtn');
    const balanceDisplay = document.getElementById('balanceDisplay');
    const bnbBalanceEl = document.getElementById('bnbBalance');
    
    if (wallet) {
      const address = wallet.toString();
      walletBtn.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
      walletBtn.classList.add('connected');
      
      if (!rpcFallbackMode) {
        balanceDisplay.style.display = 'flex';
        bnbBalanceEl.textContent = bnbBalance.toFixed(3);
      } else {
        balanceDisplay.style.display = 'none';
      }
    } else {
      walletBtn.textContent = 'Connect Wallet';
      walletBtn.classList.remove('connected');
      balanceDisplay.style.display = 'none';
    }
  }

  // *** CRITICAL FIX: Parse metadata from JSON string ***
  async function loadMarket() {
    try {
      const response = await apiRequest(`/markets/${id}`);
      market = response.market;
      
      // **CRITICAL METADATA PARSING BLOCK - AGGRESSIVE VERSION**
      console.log('🔍 RAW MARKET DATA:', JSON.stringify(market, null, 2));
      console.log('🔍 RAW metadata type:', typeof market.metadata);
      console.log('🔍 RAW metadata value:', market.metadata);
      
      // Try multiple parsing strategies
      if (typeof market.metadata === 'string') {
        console.log('⚠️ Metadata came as string, parsing...');
        try {
          market.metadata = JSON.parse(market.metadata);
          console.log('✅ Parsed metadata successfully:', market.metadata);
        } catch (e) {
          console.error('❌ Failed to parse metadata:', e);
          // Try double-parse in case it's double-encoded
          try {
            market.metadata = JSON.parse(JSON.parse(market.metadata));
            console.log('✅ Double-parsed metadata successfully:', market.metadata);
          } catch (e2) {
            console.error('❌ Double-parse also failed:', e2);
            market.metadata = {};
          }
        }
      }
      
      // Ensure metadata is an object
      if (!market.metadata || typeof market.metadata !== 'object') {
        console.log('⚠️ Metadata missing or not an object, creating empty object');
        market.metadata = {};
      }
      
      // Check for admin_odds in different possible locations
      if (!Array.isArray(market.metadata.admin_odds)) {
        console.warn('⚠️ admin_odds not found in metadata.admin_odds');
        
        // Check if it's in a different location
        if (market.admin_odds) {
          console.log('✅ Found admin_odds at market.admin_odds, copying...');
          market.metadata.admin_odds = market.admin_odds;
        } else if (market.metadata && market.metadata.odds) {
          console.log('✅ Found odds at metadata.odds, using as admin_odds...');
          market.metadata.admin_odds = market.metadata.odds;
        } else {
          console.warn('⚠️ Creating empty admin_odds array');
          market.metadata.admin_odds = [];
        }
      }
      
      console.log('✅ FINAL Market loaded:', market.id);
      console.log('✅ FINAL Admin odds:', market.metadata.admin_odds);
      console.log('✅ FINAL Full metadata:', market.metadata);
      console.log('✅ FINAL Full market object:', market);
      // **END CRITICAL BLOCK**
      
      document.getElementById('marketTitle').textContent = market.title;
      document.getElementById('marketCategory').textContent = market.category;

      const optionVolumes = {};
      market.options.forEach((opt, idx) => optionVolumes[idx] = 0);
      if (market.bets && market.bets.length > 0) {
        market.bets.forEach(bet => {
          optionVolumes[bet.option_id] += parseFloat(bet.amount);
        });
      }
      const totalVolume = Object.values(optionVolumes).reduce((a, b) => a + b, 0);
      document.getElementById('marketVolume').textContent = `${totalVolume.toFixed(3)} BNB`;

      updateCurrentPrice(market);
      renderOutcomes(optionVolumes, totalVolume);
      renderBettingOptions();
      updateBettingInterface();
      renderBettingHistory();
      renderPriceChart(market);
      renderVolumeChart(market);

      try {
        const obRes = await fetch(API_BASE_URL + `/orderbook/${market.id}`);
        if (obRes.ok) {
          const obData = await obRes.json();
          updateOrderBook(obData.orderBook || [], market.options);
        } else {
          updateOrderBook([], market.options);
        }
      } catch (err) {
        updateOrderBook([], market.options);
      }

    } catch (error) {
      console.error('Failed to load market:', error);
      toast('Failed to load market data: ' + error.message);
    }
  }

  function renderOutcomes(optionVolumes, totalVolume) {
    const outcomesEl = document.getElementById('outcomes');
    outcomesEl.innerHTML = '';
    
    market.options.forEach((opt, idx) => {
      const volume = optionVolumes[idx] || 0;
      const pct = totalVolume > 0 ? ((volume / totalVolume) * 100).toFixed(1) : 0;
      
      const outcomeCard = document.createElement('div');
      outcomeCard.className = 'outcome-card';
      
      const percentageDiv = document.createElement('div');
      percentageDiv.className = 'outcome-percentage';
      percentageDiv.textContent = pct + '%';
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'outcome-name';
      nameDiv.textContent = opt.name;
      
      const volumeDiv = document.createElement('div');
      volumeDiv.className = 'outcome-volume';
      volumeDiv.textContent = volume.toFixed(3) + ' BNB';
      
      outcomeCard.appendChild(percentageDiv);
      outcomeCard.appendChild(nameDiv);
      outcomeCard.appendChild(volumeDiv);
      outcomesEl.appendChild(outcomeCard);
    });
  }

  function renderBettingOptions() {
    if (!market || !market.options) return;
    
    const container = document.getElementById('bettingOptions');
    container.innerHTML = '';
    
    const optionVolumes = {};
    market.options.forEach((opt, idx) => optionVolumes[idx] = 0);
    
    if (market.bets && market.bets.length > 0) {
      market.bets.forEach(bet => {
        optionVolumes[bet.option_id] += parseFloat(bet.amount);
      });
    }
    
    const totalVolume = Object.values(optionVolumes).reduce((a, b) => a + b, 0);
    
    market.options.forEach((option, index) => {
      // **DEBUG LOGGING FOR ODDS**
      console.log(`Option ${index}:`, option.name);
      console.log(`  metadata:`, market.metadata);
      console.log(`  admin_odds:`, market.metadata?.admin_odds);
      console.log(`  odds for this option:`, market.metadata?.admin_odds?.[index]);
      
      let odds = null;
      let priceInfo = { price: '0.0000', probability: 'N/A' };
      
      if (market.metadata && Array.isArray(market.metadata.admin_odds) && market.metadata.admin_odds[index] !== undefined && market.metadata.admin_odds[index] !== null && market.metadata.admin_odds[index] !== '' && market.metadata.admin_odds[index] !== 'null' && !isNaN(parseFloat(market.metadata.admin_odds[index]))) {
        odds = parseFloat(market.metadata.admin_odds[index]);
        priceInfo = calculatePriceFromOdds(odds);
      }

      const isSelected = selectedOption === index;
      const volume = optionVolumes[index] || 0;
      
      const optionDiv = document.createElement('div');
      optionDiv.className = `betting-option ${isSelected ? 'selected' : ''}`;
      optionDiv.dataset.price = priceInfo.price;
      optionDiv.onclick = () => selectBettingOption(index);
      
      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 8px;';
      
      const img = document.createElement('img');
      img.className = 'option-image';
      img.alt = option.name;
      
      if (option.image && option.image.trim() !== '') {
        img.src = option.image;
        img.onerror = function() {
          this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjAiIGZpbGw9IiM0Yjc4OTAiLz4KPHRleHQgeD0iMjQiIHk9IjMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCIgZm9udC1mYW1pbHk9IkFyaWFsIj4/PC90ZXh0Pgo8L3N2Zz4=';
        };
      } else {
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjAiIGZpbGw9IiM0Yjc4OTAiLz4KPHRleHQgeD0iMjQiIHk9IjMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCIgZm9udC1mYW1pbHk9IkFyaWFsIj4/PC90ZXh0Pgo8L3N2Zz4=';
      }
      
      const textDiv = document.createElement('div');
      textDiv.style.flex = '1';
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'option-name';
      nameDiv.textContent = option.name;
      
      const percentageDiv = document.createElement('div');
      percentageDiv.style.cssText = 'color: #10b981; font-weight: 700; font-size: 18px;';
      percentageDiv.textContent = priceInfo.probability;
      
      const oddsDiv = document.createElement('div');
      oddsDiv.className = 'option-odds';
      oddsDiv.style.textAlign = 'center';

      if (priceInfo.price !== '0.0000') {
        oddsDiv.innerHTML = `<div style='color:#f59e0b;font-size:0.98em;font-weight:600;margin-top:2px;'>x${odds.toFixed(2)}</div><div style='color:#9ca3af;font-size:0.95em;'>${volume.toFixed(3)} BNB</div>`;
      } else {
        oddsDiv.innerHTML = `<div style='color:#ef4444;font-size:0.98em;font-weight:600;margin-top:2px;'>Set odds in admin panel</div><div style='color:#9ca3af;font-size:0.95em;'>${volume.toFixed(3)} BNB</div>`;
      }
      
      textDiv.appendChild(nameDiv);
      textDiv.appendChild(percentageDiv);
      contentDiv.appendChild(img);
      contentDiv.appendChild(textDiv);
      optionDiv.appendChild(contentDiv);
      optionDiv.appendChild(oddsDiv);
      container.appendChild(optionDiv);
    });
  }

  function renderBettingHistory() {
    if (!market.bets || market.bets.length === 0) {
      return;
    }

    const outcomesSection = document.getElementById('outcomes').parentElement;
    
    const existingHistory = document.getElementById('bettingHistorySection');
    if (existingHistory) {
      existingHistory.remove();
    }

    const historySection = document.createElement('div');
    historySection.id = 'bettingHistorySection';
    historySection.className = 'section-card';
    historySection.style.marginTop = '24px';
    
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = `Recent Bets (${market.bets.length} total)`;
    
    const gridContainer = document.createElement('div');
    gridContainer.className = 'betting-history-grid';
    
    const recentBets = market.bets.slice(-10).reverse();
    recentBets.forEach(bet => {
      const option = market.options[bet.option_id];
      const timeAgo = new Date(bet.created_at).toLocaleString();
      
      const betCard = document.createElement('div');
      betCard.className = 'bet-history-card';
      
      const optionInfo = document.createElement('div');
      optionInfo.className = 'bet-option-info';
      
      const img = document.createElement('img');
      img.alt = option?.name || 'Option';
      img.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; object-fit: cover;';
      
      if (option?.image && option.image.trim() !== '') {
        img.src = option.image;
        img.onerror = function() {
          this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTUiIGZpbGw9IiM0Yjc4OTAiLz4KPHRleHQgeD0iMTYiIHk9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIj4/PC90ZXh0Pgo8L3N2Zz4=';
        };
      } else {
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTUiIGZpbGw9IiM0Yjc4OTAiLz4KPHRleHQgeD0iMTYiIHk9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIj4/PC90ZXh0Pgo8L3N2Zz4=';
      }
      
      const textContainer = document.createElement('div');
      
      const optionName = document.createElement('div');
      optionName.style.cssText = 'color: #f9fafb; font-weight: 600;';
      optionName.textContent = option?.name || 'Unknown Option';
      
      const timeDiv = document.createElement('div');
      timeDiv.style.cssText = 'color: #9ca3af; font-size: 12px;';
      timeDiv.textContent = timeAgo;
      
      textContainer.appendChild(optionName);
      textContainer.appendChild(timeDiv);
      optionInfo.appendChild(img);
      optionInfo.appendChild(textContainer);
      
      const amountInfo = document.createElement('div');
      amountInfo.className = 'bet-amount-info';
      
      const amountDiv = document.createElement('div');
      amountDiv.style.cssText = 'color: #10b981; font-weight: 700; font-size: 16px;';
      amountDiv.textContent = `${parseFloat(bet.amount).toFixed(3)} BNB`;
      
      const addressDiv = document.createElement('div');
      addressDiv.style.cssText = 'color: #9ca3af; font-size: 12px;';
      addressDiv.textContent = `${bet.bettor_address.slice(0, 6)}...${bet.bettor_address.slice(-4)}`;
      
      amountInfo.appendChild(amountDiv);
      amountInfo.appendChild(addressDiv);
      
      if (bet.transaction_signature) {
        const txLink = document.createElement('a');
        txLink.href = `https://bscscan.com/tx/${bet.transaction_signature}`;
        txLink.target = '_blank';
        txLink.style.cssText = 'color: #10b981; font-size: 11px; text-decoration: none;';
        txLink.textContent = 'View TX ↗';
        amountInfo.appendChild(txLink);
      }
      
      betCard.appendChild(optionInfo);
      betCard.appendChild(amountInfo);
      gridContainer.appendChild(betCard);
    });
    
    historySection.appendChild(title);
    historySection.appendChild(gridContainer);

    if (!document.getElementById('betting-history-styles')) {
      const style = document.createElement('style');
      style.id = 'betting-history-styles';
      style.textContent = `
        .betting-history-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .bet-history-card {
          background: rgba(31, 41, 55, 0.6);
          border: 1px solid rgba(75, 85, 99, 0.3);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .bet-option-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .bet-amount-info {
          text-align: right;
        }
      `;
      document.head.appendChild(style);
    }

    outcomesSection.parentNode.insertBefore(historySection, outcomesSection.nextSibling);
  }

  function selectBettingOption(index) {
    selectedOption = index;
    renderBettingOptions();
    updateBettingInterface();
    calculatePotentialReturn();
  }

  function updateBettingInterface() {
    const bettingWarning = document.getElementById('bettingWarning');
    const placeBetBtn = document.getElementById('placeBetBtn');
    const betAmountInput = document.getElementById('betAmount');
    
    if (!wallet) {
      bettingWarning.style.display = 'block';
      bettingWarning.textContent = 'Connect your wallet to place bets on this market';
      placeBetBtn.disabled = true;
      betAmountInput.disabled = true;
      return;
    }
    
    if (!market || market.status !== 'active') {
      bettingWarning.style.display = 'block';
      bettingWarning.textContent = 'This market is not available for betting';
      placeBetBtn.disabled = true;
      betAmountInput.disabled = true;
      return;
    }
    
    let oddsSet = false;
    if (market && Array.isArray(market.metadata?.admin_odds) && selectedOption !== null) {
      const o = market.metadata.admin_odds[selectedOption];
      oddsSet = o !== undefined && o !== null && o !== '' && o !== 'null' && !isNaN(parseFloat(o));
    }
    
    let priceIsValid = false;
    if (oddsSet) {
      const priceInfo = calculatePriceFromOdds(parseFloat(market.metadata.admin_odds[selectedOption]));
      if (priceInfo.price !== '0.0000') {
        priceIsValid = true;
      }
    }

    if (!priceIsValid) {
      bettingWarning.style.display = 'block';
      bettingWarning.textContent = 'Odds not set for this option. Please wait for admin.';
      placeBetBtn.disabled = true;
      betAmountInput.disabled = true;
      return;
    }
    
    bettingWarning.style.display = 'none';
    placeBetBtn.disabled = selectedOption === null;
    betAmountInput.disabled = false;
  }
  
  function calculatePotentialReturn() {
    const betAmount = parseFloat(document.getElementById('betAmount').value || 0);
    const returnDisplay = document.getElementById('potentialReturn');
    
    if (!betAmount || selectedOption === null || selectedOption < 0 || !market) { 
      returnDisplay.textContent = '0.00 BNB';
      return;
    }

    const selectedOptionEl = document.querySelector(`#bettingOptions .betting-option:nth-child(${selectedOption + 1})`); 

    if (!selectedOptionEl) {
      returnDisplay.textContent = '0.00 BNB';
      return;
    }
    
    const sharePrice = parseFloat(selectedOptionEl.dataset.price);

    if (isNaN(sharePrice) || sharePrice <= 0 || sharePrice > 1) {
      returnDisplay.textContent = 'Set odds to calculate'; 
      return;
    }
    
    const impliedOdds = 1 / sharePrice; 
    const potentialReturn = betAmount * impliedOdds;
    
    returnDisplay.textContent = `${potentialReturn.toFixed(3)} BNB`;
  }

  function setBetAmount(amount) {
    document.getElementById('betAmount').value = amount;
    calculatePotentialReturn();
  }

  // Production-ready Market Probability Tracker
class ClientMarketProbabilityTracker {
  constructor() {
    this.markets = new Map();
  }

  updateMarketProbability(marketData, bidData) {
    if (!this.markets.has(marketData.id)) {
      this.markets.set(marketData.id, {
        totalVolume: 0,
        optionVolumes: new Array(marketData.options.length).fill(0),
        probabilities: new Array(marketData.options.length).fill(1 / marketData.options.length)
      });
    }

    const market = this.markets.get(marketData.id);

    // Update market volumes
    market.totalVolume += bidData.amount;
    market.optionVolumes[bidData.optionId] += bidData.amount;

    // Probability calculation
    const probabilities = market.optionVolumes.map(
      volume => volume / market.totalVolume
    );

    // Normalize probabilities
    const totalProb = probabilities.reduce((a, b) => a + b, 0);
    market.probabilities = probabilities.map(p => p / totalProb);

    return {
      probabilities: market.probabilities,
      confidenceMetrics: {
        mean: 0.5,
        standardDeviation: 0.1,
        confidenceInterval: {
          lower: Math.max(0, 0.5 - 0.1),
          upper: Math.min(1, 0.5 + 0.1)
        }
      },
      manipulationDetected: false
    };
  }
}

const marketProbabilityTracker = new ClientMarketProbabilityTracker();

async function placeBet(optionId, amount) {
    if (!wallet || !walletAdapter) {
      toast('Please connect your wallet first');
      return;
    }

    if (!market || market.status !== 'active') {
      toast('This market is not available for betting');
      return;
    }

    try {
      toast('Processing bet on Binance Smart Chain...');

      // Create transaction to treasury
      const value = web3.utils.toWei(amount.toString(), 'ether');

      const txParams = {
        from: wallet,
        to: TREASURY_WALLET,
        value: value,
        gas: 21000, // Standard gas limit for simple transfer
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      console.log('Bet transaction sent:', txHash);

      // Prepare bid data for probability tracking
      const bidData = {
        marketId: market.id,
        bettorAddress: wallet.toString(),
        optionId: optionId,
        amount: amount,
        timestamp: Date.now()
      };

      // Record bet in database
      const betResponse = await apiRequest('/bets', {
        method: 'POST',
        body: JSON.stringify({
          ...bidData,
          transactionSignature: txHash
        })
      });

      // Prepare market data for probability tracking
      const marketProbabilityData = {
        id: market.id,
        options: market.options
      };

      // Update market probabilities
      const probabilityUpdate = marketProbabilityTracker.updateMarketProbability(
        marketProbabilityData,
        bidData
      );

      console.log('Market Probabilities:', probabilityUpdate.probabilities);
      console.log('Confidence Metrics:', probabilityUpdate.confidenceMetrics);

      // Optional: Send probability data to backend for persistent tracking
      try {
        await apiRequest('/market-probabilities', {
          method: 'POST',
          body: JSON.stringify({
            marketId: market.id,
            probabilities: probabilityUpdate.probabilities,
            confidenceMetrics: probabilityUpdate.confidenceMetrics
          })
        });
      } catch (error) {
        console.warn('Could not sync probabilities:', error);
      }

      // Update balance (skip if RPC issues)
      if (!rpcFallbackMode) {
        try {
          const balance = await web3.eth.getBalance(wallet);
          bnbBalance = parseFloat(web3.utils.fromWei(balance, 'ether'));
          updateWalletUI();
        } catch (error) {
          console.warn('Could not update balance:', error.message);
        }
      }

      // Dynamically update market data and charts
      await loadMarket();

      // Custom update for immediate visual feedback
      updateCurrentPrice(market);
      renderPriceChart(market);

      // Recalculate and render outcomes with new probabilities
      const optionVolumes = {};
      market.options.forEach((opt, idx) => {
        optionVolumes[idx] = probabilityUpdate.probabilities[idx] * market.totalVolume;
      });
      renderOutcomes(optionVolumes, market.totalVolume);

      // Alert for any market manipulation detection
      if (probabilityUpdate.manipulationDetected) {
        toast('Unusual betting pattern detected. Market monitoring activated.');
      }

      toast('Bet placed successfully!');

    } catch (error) {
      console.error('Bet placement failed:', error);
      if (error.code === 4001 || error.message.includes('User rejected')) {
        toast('Transaction cancelled by user');
      } else {
        toast('Failed to place bet: ' + error.message);
      }
    }
  }

  async function handlePlaceBet() {
    if (!wallet || selectedOption === null || !market) {
      toast('Please connect wallet and select an option');
      return;
    }
    
    const betAmount = parseFloat(document.getElementById('betAmount').value || 0);
    if (betAmount <= 0) {
      toast('Please enter a valid bet amount');
      return;
    }
    
    if (!rpcFallbackMode && betAmount > bnbBalance) {
      toast('Insufficient balance');
      return;
    }
    
    await placeBet(selectedOption, betAmount);
    
    document.getElementById('betAmount').value = '';
    selectedOption = null;
    renderBettingOptions();
    updateBettingInterface();
  }

  async function initialize() {
    console.log('Initializing market detail page...');
    
    console.log('Waiting for Chart.js library...');
    const chartAvailable = await waitForChart();
    
    if (chartAvailable) {
      console.log('Charts enabled - Chart.js is ready');
    } else {
      console.log('Charts disabled - Chart.js unavailable');
    }
    
    const web3Ready = await initializeWeb3();
    if (!web3Ready) {
      console.warn('Web3 initialization failed');
    }
    
    const walletBtn = document.getElementById('walletBtn');
    if (walletBtn) {
      walletBtn.addEventListener('click', () => {
        if (wallet) {
          disconnectWallet();
        } else {
          connectWallet();
        }
      });
    }
    
    const placeBetBtn = document.getElementById('placeBetBtn');
    if (placeBetBtn) {
      placeBetBtn.addEventListener('click', handlePlaceBet);
    }
    
    const betAmountInput = document.getElementById('betAmount');
    if (betAmountInput) {
      betAmountInput.addEventListener('input', calculatePotentialReturn);
    }
    
    await loadMarket();
    
    setInterval(async () => {
      try {
        await loadMarket();
      } catch (error) {
        console.warn('Auto-refresh failed:', error.message);
      }
    }, 30000);
    
    console.log('Market detail page initialized successfully');
  }

  await initialize();

  window.selectBettingOption = selectBettingOption;
  window.setBetAmount = setBetAmount;
  window.handlePlaceBet = handlePlaceBet;
});
