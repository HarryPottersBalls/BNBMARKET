/**
 * LMSR Chart Engine for BNBmarket
 * Simplified but powerful charting system for prediction markets
 */

class LMSRChartEngine {
  constructor() {
    this.chartInstances = new Map();
  }

  /**
   * Create real-time probability chart for market detail page
   */
  async createProbabilityChart(containerId, marketId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      // Get historical betting data
      const betsResponse = await fetch(`${window.API_BASE_URL}/bets?marketId=${marketId}`);
      const betsData = await betsResponse.json();
      const bets = betsData.bets || [];

      // Get market data
      const marketResponse = await fetch(`${window.API_BASE_URL}/markets/${marketId}`);
      const marketData = await marketResponse.json();
      const market = marketData.market;

      if (!market.options) return;

      // Calculate probability over time
      const timeSeriesData = this.calculateProbabilityTimeSeries(bets, market.options.length);

      // Create Chart.js chart
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);

      const chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: timeSeriesData.labels,
          datasets: market.options.map((option, index) => ({
            label: option.name,
            data: timeSeriesData.probabilities[index],
            borderColor: this.getOptionColor(index),
            backgroundColor: this.getOptionColor(index) + '20',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 3
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
                font: { size: 12, family: 'Inter, system-ui, sans-serif' }
              },
              grid: {
                color: 'rgba(156, 163, 175, 0.1)',
                drawBorder: false
              },
              title: {
                display: true,
                text: 'Probability (%)',
                color: '#9ca3af',
                font: { size: 14, weight: 'bold' }
              }
            },
            x: {
              ticks: {
                color: '#9ca3af',
                font: { size: 11, family: 'Inter, system-ui, sans-serif' },
                maxTicksLimit: 8
              },
              grid: { display: false },
              title: {
                display: true,
                text: 'Time',
                color: '#9ca3af',
                font: { size: 14, weight: 'bold' }
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#d1d5db',
                font: { size: 12, weight: 'bold' },
                usePointStyle: true,
                pointStyle: 'circle'
              }
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
                  return `${context.dataset.label}: ${context.formattedValue}%`;
                }
              }
            }
          }
        }
      });

      this.chartInstances.set(containerId, chart);
      return chart;

    } catch (error) {
      console.error('Failed to create probability chart:', error);
      container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 40px;">Failed to load chart data</div>';
    }
  }

  /**
   * Create current probability distribution chart
   */
  async createCurrentDistributionChart(containerId, marketId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      // Get current probabilities
      const probResponse = await fetch(`${window.API_BASE_URL}/markets/${marketId}/probabilities`);
      const probData = await probResponse.json();

      // Get market data for option names
      const marketResponse = await fetch(`${window.API_BASE_URL}/markets/${marketId}`);
      const marketData = await marketResponse.json();
      const market = marketData.market;

      if (!probData.probabilities || !market.options) return;

      // Create Chart.js doughnut chart
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);

      const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: market.options.map(opt => opt.name),
          datasets: [{
            data: probData.probabilities,
            backgroundColor: market.options.map((_, index) => this.getOptionColor(index) + '80'),
            borderColor: market.options.map((_, index) => this.getOptionColor(index)),
            borderWidth: 2,
            hoverBackgroundColor: market.options.map((_, index) => this.getOptionColor(index) + 'CC'),
            hoverBorderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#d1d5db',
                font: { size: 12, weight: 'bold' },
                padding: 20,
                usePointStyle: true
              }
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
                  return `${context.label}: ${context.formattedValue}%`;
                }
              }
            }
          },
          cutout: '60%'
        }
      });

      // Add center text showing total volume
      const centerText = {
        id: 'centerText',
        beforeDatasetsDraw(chart) {
          const { ctx, data } = chart;
          ctx.save();
          
          const centerX = chart.getDatasetMeta(0).data[0].x;
          const centerY = chart.getDatasetMeta(0).data[0].y;
          
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Total volume text
          ctx.fillStyle = '#f9fafb';
          ctx.font = 'bold 16px Inter';
          ctx.fillText(`${probData.total_volume.toFixed(2)} BNB`, centerX, centerY - 5);
          
          ctx.fillStyle = '#9ca3af';
          ctx.font = '12px Inter';
          ctx.fillText('Total Volume', centerX, centerY + 15);
          
          ctx.restore();
        }
      };

      Chart.register(centerText);
      this.chartInstances.set(containerId, chart);
      return chart;

    } catch (error) {
      console.error('Failed to create distribution chart:', error);
      container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 40px;">Failed to load distribution data</div>';
    }
  }

  /**
   * Calculate probability time series from betting data
   */
  calculateProbabilityTimeSeries(bets, numOptions) {
    if (!bets.length) {
      return {
        labels: ['Start'],
        probabilities: Array(numOptions).fill([100 / numOptions])
      };
    }

    // Sort bets by time
    const sortedBets = [...bets].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    const labels = ['Start'];
    const probabilities = Array(numOptions).fill(null).map(() => [100 / numOptions]);
    
    // Track cumulative volume per option
    const optionVolumes = Array(numOptions).fill(0);
    
    sortedBets.forEach((bet, index) => {
      const optionIndex = bet.option_id;
      const amount = parseFloat(bet.amount || 0);
      
      if (optionIndex < numOptions) {
        optionVolumes[optionIndex] += amount;
      }
      
      // Calculate LMSR probabilities
      const totalVolume = optionVolumes.reduce((sum, vol) => sum + vol, 0);
      const newProbs = this.calculateLMSRProbabilities(optionVolumes, 10);
      
      // Add time point (every 5th bet or last bet to avoid too many points)
      if (index % 5 === 0 || index === sortedBets.length - 1) {
        const timeLabel = new Date(bet.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        labels.push(timeLabel);
        
        newProbs.forEach((prob, i) => {
          probabilities[i].push(Math.round(prob * 100 * 100) / 100); // Round to 2 decimals
        });
      }
    });
    
    return { labels, probabilities };
  }

  /**
   * Calculate LMSR probabilities (simplified version)
   */
  calculateLMSRProbabilities(volumes, liquidity = 10) {
    const numOptions = volumes.length;
    
    // Add small initial liquidity
    const adjustedVolumes = volumes.map(vol => vol + liquidity / numOptions);
    
    // Calculate exponentials with scaling
    const maxVol = Math.max(...adjustedVolumes);
    const scaleFactor = Math.max(maxVol / 10, 1);
    const expValues = adjustedVolumes.map(vol => Math.exp(vol / scaleFactor));
    
    // Normalize to probabilities
    const sumExp = expValues.reduce((sum, exp) => sum + exp, 0);
    return expValues.map(exp => exp / sumExp);
  }

  /**
   * Get consistent colors for options
   */
  getOptionColor(index) {
    const colors = [
      '#10b981', // Green
      '#ef4444', // Red  
      '#3b82f6', // Blue
      '#f59e0b', // Orange
      '#8b5cf6', // Purple
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316'  // Orange-red
    ];
    return colors[index % colors.length];
  }

  /**
   * Update chart with new data
   */
  async updateChart(containerId, marketId) {
    const chart = this.chartInstances.get(containerId);
    if (!chart) return;

    try {
      // Recreate the chart with fresh data
      chart.destroy();
      this.chartInstances.delete(containerId);
      
      if (containerId.includes('probability')) {
        await this.createProbabilityChart(containerId, marketId);
      } else if (containerId.includes('distribution')) {
        await this.createCurrentDistributionChart(containerId, marketId);
      }
    } catch (error) {
      console.error('Failed to update chart:', error);
    }
  }

  /**
   * Resize all charts
   */
  handleResize() {
    this.chartInstances.forEach(chart => {
      if (chart && chart.resize) {
        chart.resize();
      }
    });
  }

  /**
   * Clean up charts
   */
  destroy() {
    this.chartInstances.forEach(chart => {
      if (chart && chart.destroy) {
        chart.destroy();
      }
    });
    this.chartInstances.clear();
  }
}

// Initialize global chart engine
window.lmsrChartEngine = new LMSRChartEngine();

// Auto-resize handler
window.addEventListener('resize', () => {
  if (window.lmsrChartEngine) {
    window.lmsrChartEngine.handleResize();
  }
});

// Export for use
window.LMSRChartEngine = LMSRChartEngine;
