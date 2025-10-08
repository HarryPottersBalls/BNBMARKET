// URL Router for BNBmarket
// Handles both static routes and dynamic slug-based URLs

// Static predefined routes (empty for now - will be populated as real markets are created)
const marketRoutes = {};

// Reverse mapping for generating URLs
const idToRoute = {};
Object.keys(marketRoutes).forEach(route => {
  idToRoute[marketRoutes[route]] = route;
});

// Generate SEO-friendly slug from market title and ID
function generateMarketSlug(title, id) {
  if (!title || !id) return `market-${id}`;
  
  // Clean and format the title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
  
  return `${slug}-${id}`;
}

// Extract market ID from slug (last number after hyphen)
function extractMarketId(slug) {
  const matches = slug.match(/-(\d+)$/);
  return matches ? parseInt(matches[1]) : null;
}

// Router functions
function getMarketIdFromRoute(route) {
  // Check static routes first
  if (marketRoutes[route]) {
    return marketRoutes[route];
  }
  
  // Try to extract ID from dynamic slug
  return extractMarketId(route);
}

function getRouteFromMarketId(id) {
  return idToRoute[id] || null;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    marketRoutes, 
    getMarketIdFromRoute, 
    getRouteFromMarketId, 
    extractMarketId,
    generateMarketSlug 
  };
}
