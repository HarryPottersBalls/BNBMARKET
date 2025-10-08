# 🎰 Auto Market Generator - "House Always Wins"

## Overview

The Auto Market Generator automatically creates prediction markets when trading activity is low, ensuring your platform always has fresh, engaging content.

## Features

✅ **Free APIs** - Uses CoinGecko, Reddit, and other free data sources
✅ **No Python** - Pure Node.js solution, easy to deploy
✅ **Smart Detection** - Only generates when activity drops below threshold
✅ **House Liquidity** - Automatically seeds new markets with initial bets
✅ **Multiple Categories** - Crypto, sports, news, weather, entertainment
✅ **Stock Images** - Uses free Unsplash images for market cards

## How It Works

```javascript
1. Check trading activity every hour
2. If activity < threshold (default: 10 bets/hour):
   → Fetch trending topics from free APIs
   → Generate 3 prediction markets
   → Seed each market with house liquidity (5 BNB yes, 5 BNB no)
3. Log activity and continue monitoring
```

## Configuration

Add to your `.env` file:

```bash
# Enable the generator
ENABLE_AUTO_MARKETS=true

# House wallet for initial liquidity (can use ADMIN_WALLET)
HOUSE_WALLET_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

# Optional: Customize thresholds
AUTO_MARKET_MIN_ACTIVITY=10        # Bets per hour threshold
AUTO_MARKET_CHECK_INTERVAL=3600000 # Check interval in ms (1 hour)
```

## Data Sources

### Crypto Markets (CoinGecko)
- **Endpoint**: `https://api.coingecko.com/api/v3/search/trending`
- **Rate Limit**: Free tier, no API key needed
- **Example**: "Will Bitcoin reach $100k by end of month?"

### News Markets (Reddit)
- **Endpoint**: `https://www.reddit.com/r/worldnews/.json`
- **Rate Limit**: 60 requests/minute, no API key needed
- **Example**: "Will [trending news topic] happen by end of month?"

### Sports Markets (Templates)
- **Source**: Predefined templates + manual updates
- **Example**: "Will Team A win the championship this season?"

## Generated Market Format

```javascript
{
  question: "Will Bitcoin reach $100,000 by end of month?",
  description: "Market prediction for Bitcoin - currently trending #1",
  category: "crypto",
  end_date: "2025-11-08", // 30 days from creation
  image_url: "https://images.unsplash.com/photo-...",
  tags: ["crypto", "btc", "price"],
  metadata: {
    source: "coingecko",
    coin_id: "bitcoin",
    trending_rank: 5
  },
  created_by: "system",
  is_auto_generated: true
}
```

## House Liquidity Seeding

Each auto-generated market receives:
- **5 BNB on "Yes"** (option_id: 0)
- **5 BNB on "No"** (option_id: 1)

This:
- Provides instant liquidity
- Creates realistic initial odds (50/50)
- Makes markets tradeable immediately
- Attracts user participation

## Monitoring

Check logs for activity:

```bash
# Activity healthy
📊 Recent activity: 25 bets/hour
✅ Activity healthy - no generation needed

# Low activity, generating
📊 Recent activity: 5 bets/hour
🎯 Activity low - generating new markets...
✅ Created market: "Will Bitcoin reach $100,000 by end of month?"
💰 Seeded market_123 with initial liquidity
✅ Created 3 new markets
```

## Manual Control

Start/stop programmatically:

```javascript
const AutoMarketGenerator = require('./src/services/AutoMarketGenerator');

// Start
AutoMarketGenerator.start();

// Stop
AutoMarketGenerator.stop();

// Check status
console.log(AutoMarketGenerator.isRunning); // true/false
```

## Deployment

### Render.com

Add environment variable in dashboard:
```
ENABLE_AUTO_MARKETS=true
```

### Docker

```dockerfile
ENV ENABLE_AUTO_MARKETS=true
ENV HOUSE_WALLET_ADDRESS=system
```

### Manual

```bash
# Local development
echo "ENABLE_AUTO_MARKETS=true" >> .env
npm start
```

## Cost & Rate Limits

| API | Cost | Rate Limit | Notes |
|-----|------|------------|-------|
| CoinGecko | Free | 10-50 calls/min | More than enough |
| Reddit | Free | 60 calls/min | No auth needed |
| Unsplash | Free | N/A | Using direct image URLs |

**Total cost**: $0/month ✅

## Customization

### Add New Data Sources

```javascript
// src/services/AutoMarketGenerator.js

async fetchWeatherTrends() {
  const response = await axios.get('https://api.openweathermap.org/...');
  return response.data.map(weather => ({
    category: 'weather',
    question: `Will temperature exceed ${weather.temp}°F today?`,
    // ...
  }));
}
```

### Adjust Market Templates

```javascript
convertToQuestion(headline) {
  // Custom logic to convert headlines to questions
  return `Will ${headline.toLowerCase()} happen by end of month?`;
}
```

### Change Seeding Amounts

```javascript
async seedInitialLiquidity(marketId) {
  // Change from 5 BNB to custom amount
  await db.query(
    `INSERT INTO bets (market_id, user_address, option_id, amount)
    VALUES
      ($1, $2, 0, 10),  // 10 BNB on Yes
      ($1, $2, 1, 10)`, // 10 BNB on No
    [marketId, houseWallet]
  );
}
```

## Security

✅ **No Private Keys** - Uses system wallet, not real funds
✅ **Rate Limited** - Respects API rate limits
✅ **Error Handling** - Fails gracefully, logs errors
✅ **Toggle Switch** - Easy to disable via environment variable

## Troubleshooting

### Markets not generating?

1. Check if enabled: `process.env.ENABLE_AUTO_MARKETS === 'true'`
2. Check activity threshold: Might be too high
3. Check logs for API errors
4. Verify database connection

### API errors?

```javascript
// Reduce check frequency if hitting rate limits
AUTO_MARKET_CHECK_INTERVAL=7200000 // 2 hours instead of 1
```

### Want different market types?

Edit `fetchCryptoTrends()`, `fetchSportsTrends()`, etc. in `AutoMarketGenerator.js`

## Future Enhancements

Potential additions:
- [ ] Weather markets (OpenWeatherMap API)
- [ ] Stock market predictions (Yahoo Finance)
- [ ] Political prediction markets (Polymarket-style)
- [ ] Custom market templates per category
- [ ] Machine learning for market popularity prediction
- [ ] Dynamic house liquidity based on category

---

**Status**: ✅ Production Ready
**Maintenance**: Low (all free APIs, no dependencies)
**ROI**: High (keeps platform active, increases engagement)
