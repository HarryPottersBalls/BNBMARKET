// URL Router for BNBmarket
// Maps SEO-friendly URLs to market IDs

const marketRoutes = {
  // Crypto markets
  'bitcoin-100k-2025': 1,
  'ethereum-10k-2024': 2,
  'bnb-price-prediction-2024': 3,
  'crypto-market-crash-2024': 4,
  
  // Politics
  'us-election-2024-results': 5,
  'trump-presidency-2025': 6,
  'biden-reelection-2024': 7,
  
  // Sports
  'world-cup-2026-winner': 8,
  'nfl-superbowl-2025': 9,
  'nba-championship-2024': 10,
  
  // Technology
  'ai-breakthrough-2024': 11,
  'tesla-stock-prediction': 12,
  'metaverse-adoption-2025': 13,
  
  // Economy
  'recession-2024-prediction': 14,
  'inflation-rate-2024': 15,
  'stock-market-crash-2024': 16
};

// Reverse mapping for generating URLs
const idToRoute = {};
Object.keys(marketRoutes).forEach(route => {
  idToRoute[marketRoutes[route]] = route;
});

// Router functions
function getMarketIdFromRoute(route) {
  return marketRoutes[route] || null;
}

function getRouteFromMarketId(id) {
  return idToRoute[id] || null;
}

function handleRouting() {
  const path = window.location.pathname;
  
  // Check if it's a market route
  if (path.startsWith('/market/')) {
    const route = path.replace('/market/', '');
    const marketId = getMarketIdFromRoute(route);
    
    if (marketId) {
      // Redirect to market.html with the correct ID
      window.location.href = `/market.html?id=${marketId}`;
      return;
    }
  }
  
  // Check for root market routes
  const route = path.replace('/', '');
  const marketId = getMarketIdFromRoute(route);
  
  if (marketId) {
    window.location.href = `/market.html?id=${marketId}`;
    return;
  }
}

// Initialize routing when page loads
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', handleRouting);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { marketRoutes, getMarketIdFromRoute, getRouteFromMarketId };
}
