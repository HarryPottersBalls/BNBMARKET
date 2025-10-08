const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { queryDatabase } = require('../../utils/database');

/**
 * Auto Market Generator - "House Always Wins"
 *
 * Automatically generates prediction markets when activity is low
 * using free APIs and trending topics
 */
class AutoMarketGenerator {
  constructor() {
    this.minActivityThreshold = 10; // Minimum bets/hour before generating
    this.checkInterval = 60 * 60 * 1000; // Check every hour
    this.isRunning = false;

    // Free image sources
    this.stockImages = {
      crypto: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d',
      sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211',
      politics: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620',
      weather: 'https://images.unsplash.com/photo-1561553873-e8491a564fd0',
      entertainment: 'https://images.unsplash.com/photo-1574267432644-f74f35c53dd2',
      tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
      default: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e'
    };
  }

  /**
   * Start the auto-generation service
   */
  start() {
    if (this.isRunning) {
      console.log('AutoMarketGenerator already running');
      return;
    }

    this.isRunning = true;
    console.log('🎰 AutoMarketGenerator started - House always wins!');

    // Run immediately on start
    this.checkAndGenerate();

    // Then run on interval
    this.interval = setInterval(() => {
      this.checkAndGenerate();
    }, this.checkInterval);
  }

  /**
   * Stop the auto-generation service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('AutoMarketGenerator stopped');
  }

  /**
   * Check activity and generate markets if needed
   */
  async checkAndGenerate() {
    try {
      const recentActivity = await this.getRecentActivity();

      console.log(`📊 Recent activity: ${recentActivity} bets/hour`);

      if (recentActivity < this.minActivityThreshold) {
        console.log('🎯 Activity low - generating new markets...');
        await this.generateMarkets();
      } else {
        console.log('✅ Activity healthy - no generation needed');
      }
    } catch (error) {
      console.error('❌ Error in checkAndGenerate:', error);
    }
  }

  /**
   * Get recent betting activity
   */
  async getRecentActivity() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const result = await db.query(
        'SELECT COUNT(*) as count FROM bets WHERE created_at > $1',
        [oneHourAgo]
      );

      return parseInt(result.rows[0]?.count || 0);
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return 0;
    }
  }

  /**
   * Generate new markets from trending topics
   */
  async generateMarkets() {
    try {
      // Fetch trending topics from multiple sources
      const [cryptoTrends, sportsTrends, generalTrends] = await Promise.all([
        this.fetchCryptoTrends(),
        this.fetchSportsTrends(),
        this.fetchGeneralTrends()
      ]);

      // Combine and prioritize
      const allTrends = [
        ...cryptoTrends,
        ...sportsTrends,
        ...generalTrends
      ];

      // Create markets from top 3 trends
      const marketsToCreate = allTrends.slice(0, 3);

      for (const trend of marketsToCreate) {
        await this.createMarketFromTrend(trend);
      }

      console.log(`✅ Created ${marketsToCreate.length} new markets`);
    } catch (error) {
      console.error('Error generating markets:', error);
    }
  }

  /**
   * Fetch crypto trending topics
   */
  async fetchCryptoTrends() {
    try {
      // CoinGecko trending API (free, no key needed)
      const response = await fetch('https://api.coingecko.com/api/v3/search/trending');
      const data = await response.json();

      return data.coins.slice(0, 3).map(coin => ({
        category: 'crypto',
        question: `Will ${coin.item.name} (${coin.item.symbol}) reach $${this.generateTargetPrice(coin.item.market_cap_rank)} by end of month?`,
        description: `Market prediction for ${coin.item.name} - currently trending #${coin.item.market_cap_rank}`,
        image: this.stockImages.crypto,
        tags: ['crypto', coin.item.symbol.toLowerCase(), 'price'],
        metadata: {
          source: 'coingecko',
          coin_id: coin.item.id,
          trending_rank: coin.item.score
        }
      }));
    } catch (error) {
      console.error('Error fetching crypto trends:', error);
      return [];
    }
  }

  /**
   * Fetch sports trending topics
   */
  async fetchSportsTrends() {
    try {
      // Use free sports data or RSS feeds
      // For now, use predefined templates
      const sportsTemplates = [
        {
          category: 'sports',
          question: 'Will Team A win the championship this season?',
          description: 'Prediction market for major sports championship',
          image: this.stockImages.sports,
          tags: ['sports', 'championship'],
          metadata: { source: 'template' }
        }
      ];

      return sportsTemplates;
    } catch (error) {
      console.error('Error fetching sports trends:', error);
      return [];
    }
  }

  /**
   * Fetch general trending topics
   */
  async fetchGeneralTrends() {
    try {
      // Reddit RSS (no API key needed)
      const response = await fetch('https://www.reddit.com/r/worldnews/.json?limit=5', {
        headers: {
          'User-Agent': 'BNBMarket/1.0'
        }
      });
      const data = await response.json();

      const posts = data.data.children.slice(0, 2);

      return posts.map(post => ({
        category: 'news',
        question: `${this.convertToQuestion(post.data.title)}?`,
        description: post.data.selftext?.substring(0, 200) || post.data.title,
        image: this.stockImages.default,
        tags: ['news', 'trending'],
        metadata: {
          source: 'reddit',
          post_id: post.data.id,
          upvotes: post.data.ups
        }
      }));
    } catch (error) {
      console.error('Error fetching general trends:', error);
      return [];
    }
  }

  /**
   * Create a market from trending topic
   */
  async createMarketFromTrend(trend) {
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // 30 days from now

      const market = await db.query(
        `INSERT INTO markets
        (question, description, category, end_date, image_url, tags, metadata, created_by, is_auto_generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'system', true)
        RETURNING *`,
        [
          trend.question,
          trend.description,
          trend.category,
          endDate,
          trend.image,
          JSON.stringify(trend.tags),
          JSON.stringify(trend.metadata)
        ]
      );

      const marketId = market.rows[0].id;

      // House seeds initial liquidity (small amounts to kickstart)
      await this.seedInitialLiquidity(marketId);

      console.log(`✅ Created market: "${trend.question}"`);
      return market.rows[0];
    } catch (error) {
      console.error('Error creating market from trend:', error);
      throw error;
    }
  }

  /**
   * House seeds initial liquidity to new market
   */
  async seedInitialLiquidity(marketId) {
    try {
      const houseWallet = process.env.HOUSE_WALLET_ADDRESS || 'system';

      // Place small initial bets on both sides (5 BNB each)
      await db.query(
        `INSERT INTO bets (market_id, user_address, option_id, amount)
        VALUES
          ($1, $2, 0, 5),
          ($1, $2, 1, 5)`,
        [marketId, houseWallet]
      );

      console.log(`💰 Seeded ${marketId} with initial liquidity`);
    } catch (error) {
      console.error('Error seeding liquidity:', error);
    }
  }

  /**
   * Helper: Generate target price for crypto
   */
  generateTargetPrice(marketCapRank) {
    if (marketCapRank <= 10) return 100000;
    if (marketCapRank <= 50) return 10000;
    if (marketCapRank <= 100) return 1000;
    return 100;
  }

  /**
   * Helper: Convert news headline to question
   */
  convertToQuestion(headline) {
    // Simple conversion: take first clause and make it a prediction
    const simplified = headline.split('.')[0].split(',')[0];
    return `Will ${simplified.toLowerCase()} happen by end of month`;
  }
}

module.exports = new AutoMarketGenerator();
