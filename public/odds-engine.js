// Odds Engine for BNBmarket
// Handles LMSR (Logarithmic Market Scoring Rule) calculations and visualizations

class OddsEngine {
  constructor() {
    this.liquidity = 10; // Default LMSR liquidity parameter
    console.log('OddsEngine initialized with LMSR support');
  }

  // Calculate LMSR probabilities from bets
  calculateLMSRProbabilities(bets, numOutcomes, liquidity = this.liquidity) {
    // Calculate total bet amounts per outcome
    const outcomeTotals = Array(numOutcomes).fill(0);
    
    bets.forEach(bet => {
      if (bet.option_id < numOutcomes) {
        outcomeTotals[bet.option_id] += parseFloat(bet.amount || 0);
      }
    });
    
    // Add small initial liquidity to prevent division by zero
    const initialLiquidity = liquidity / numOutcomes;
    const adjustedTotals = outcomeTotals.map(total => total + initialLiquidity);
    
    // Calculate exponentials (scaled down to prevent overflow)
    const scaleFactor = Math.max(...adjustedTotals) / 10;
    const expValues = adjustedTotals.map(total => Math.exp(total / Math.max(scaleFactor, 1)));
    
    // Calculate probabilities
    const sumExp = expValues.reduce((sum, exp) => sum + exp, 0);
    const probabilities = expValues.map(exp => exp / sumExp);
    
    return probabilities;
  }

  // Convert probability to odds
  probabilityToOdds(probability) {
    if (probability <= 0) return 999;
    if (probability >= 1) return 1.01;
    return Math.max(1.01, 1 / probability);
  }

  // Convert odds to probability
  oddsToProbability(odds) {
    if (odds <= 1) return 0.99;
    return Math.min(0.99, 1 / odds);
  }

  // Calculate LMSR price for specific outcome
  calculatePrice(bets, outcomeIndex, numOutcomes, liquidity = this.liquidity) {
    const probabilities = this.calculateLMSRProbabilities(bets, numOutcomes, liquidity);
    return probabilities[outcomeIndex] || (1 / numOutcomes);
  }

  // Calculate cost of buying shares in LMSR
  calculateCost(bets, outcomeIndex, shareAmount, numOutcomes, liquidity = this.liquidity) {
    const currentProb = this.calculatePrice(bets, outcomeIndex, numOutcomes, liquidity);
    
    // Create hypothetical bet to see new price
    const hypotheticalBets = [...bets, {
      option_id: outcomeIndex,
      amount: shareAmount
    }];
    
    const newProb = this.calculatePrice(hypotheticalBets, outcomeIndex, numOutcomes, liquidity);
    
    // Simple cost calculation based on probability change
    const avgProb = (currentProb + newProb) / 2;
    return shareAmount / avgProb;
  }

  // Get market summary with LMSR data
  getMarketSummary(market) {
    if (!market || !market.bets || !market.options) {
      return null;
    }

    const numOutcomes = market.options.length;
    const probabilities = this.calculateLMSRProbabilities(market.bets, numOutcomes);
    const odds = probabilities.map(prob => this.probabilityToOdds(prob));

    // Calculate volume per outcome
    const outcomeVolumes = Array(numOutcomes).fill(0);
    market.bets.forEach(bet => {
      if (bet.option_id < numOutcomes) {
        outcomeVolumes[bet.option_id] += parseFloat(bet.amount || 0);
      }
    });

    return {
      market_id: market.id,
      probabilities: probabilities.map(prob => Math.round(prob * 10000) / 100), // Percentages
      odds: odds,
      volumes: outcomeVolumes,
      total_volume: outcomeVolumes.reduce((sum, vol) => sum + vol, 0),
      num_outcomes: numOutcomes,
      liquidity: this.liquidity
    };
  }

  // Calculate potential profit for a bet
  calculatePotentialProfit(amount, currentOdds, fees = { bid: 0.01, payout: 0.01 }) {
    if (!amount || amount <= 0 || !currentOdds || currentOdds <= 1) {
      return { gross: 0, fees: 0, net: 0 };
    }

    // Apply bid fee (1% on amount)
    const bidFee = amount * fees.bid;
    const netBetAmount = amount - bidFee;

    // Calculate gross winnings
    const grossWinnings = netBetAmount * currentOdds;

    // Apply payout fee (1% on winnings)
    const payoutFee = grossWinnings * fees.payout;
    const netWinnings = grossWinnings - payoutFee;

    return {
      gross: grossWinnings,
      fees: bidFee + payoutFee,
      net: netWinnings,
      bidFee: bidFee,
      payoutFee: payoutFee
    };
  }
}

// Odds Visualizer for charts and displays
class OddsVisualizer {
  constructor(oddsEngine) {
    this.engine = oddsEngine;
    console.log('OddsVisualizer initialized');
  }

  // Create simple probability display
  createProbabilityDisplay(container, probabilities, options) {
    if (!container || !probabilities || !options) return;

    container.innerHTML = '';
    
    probabilities.forEach((prob, index) => {
      const option = options[index];
      if (!option) return;

      const optionElement = document.createElement('div');
      optionElement.className = 'probability-option';
      optionElement.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        margin: 5px 0;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        border-left: 4px solid #9aff00;
      `;

      const percentage = Math.round(prob * 100);
      const odds = this.engine.probabilityToOdds(prob);

      optionElement.innerHTML = `
        <span style="font-weight: 500;">${option.name}</span>
        <div style="text-align: right;">
          <div style="color: #9aff00; font-weight: 600;">${percentage}%</div>
          <div style="color: #aaa; font-size: 0.9em;">${odds.toFixed(2)}x</div>
        </div>
      `;

      container.appendChild(optionElement);
    });
  }

  // Create odds comparison chart (if Chart.js is available)
  createOddsChart(canvasId, probabilities, options) {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not available for odds visualization');
      return null;
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: options.map(opt => opt.name),
        datasets: [{
          data: probabilities.map(prob => Math.round(prob * 100)),
          backgroundColor: [
            '#9aff00',
            '#ff6b6b',
            '#4ecdc4',
            '#45b7d1',
            '#f9ca24',
            '#f0932b'
          ],
          borderWidth: 2,
          borderColor: '#1a1a2e'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#ffffff'
            }
          }
        }
      }
    });
  }
}

// Demo system for testing (optional)
class ReactiveOddsDemo {
  constructor(oddsEngine) {
    this.engine = oddsEngine;
    this.isRunning = false;
  }

  startDemo() {
    if (this.isRunning) return;
    
    console.log('🎮 Demo mode started - this is for testing only');
    this.isRunning = true;
    
    // Demo would simulate market activity
    // This is disabled in production
  }

  stopDemo() {
    this.isRunning = false;
    console.log('Demo mode stopped');
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.OddsEngine = OddsEngine;
  window.OddsVisualizer = OddsVisualizer;
  window.ReactiveOddsDemo = ReactiveOddsDemo;
}

console.log('✅ Odds Engine loaded successfully');
