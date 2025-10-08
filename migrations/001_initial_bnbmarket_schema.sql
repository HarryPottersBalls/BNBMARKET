CREATE TABLE IF NOT EXISTS markets (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'other',
        creator_address VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP,
        total_volume DECIMAL(18, 9) DEFAULT 0,
        total_bets INTEGER DEFAULT 0,
        options JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'under_review',
        creation_signature VARCHAR(150),
        initial_liquidity DECIMAL(18, 9) DEFAULT 0,
        resolved BOOLEAN DEFAULT false,
        resolution_value TEXT,
        metadata JSONB DEFAULT '{}',
        market_image TEXT,
        total_lp_fees_accrued DECIMAL(18, 9) DEFAULT 0
      );
    
      CREATE TABLE IF NOT EXISTS bets (
        id SERIAL PRIMARY KEY,
        market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
        bettor_address VARCHAR(100) NOT NULL,
        option_id INTEGER NOT NULL,
        amount DECIMAL(18, 9) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        transaction_signature VARCHAR(150),
        status VARCHAR(20) DEFAULT 'confirmed',
        payout_amount DECIMAL(18, 9) DEFAULT 0,
        claimed BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}'
      );
    
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        bet_id INTEGER REFERENCES bets(id) ON DELETE CASCADE,
        user_address VARCHAR(100) NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    
      CREATE INDEX IF NOT EXISTS idx_markets_creator ON markets(creator_address);
      CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
      CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
      CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market_id);
      CREATE INDEX IF NOT EXISTS idx_bets_bettor ON bets(bettor_address);
      CREATE INDEX IF NOT EXISTS idx_bets_transaction ON bets(transaction_signature);
      CREATE INDEX IF NOT EXISTS idx_comments_bet_id ON comments(bet_id);
      CREATE INDEX IF NOT EXISTS idx_comments_user_address ON comments(user_address);

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(100) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

      CREATE TABLE IF NOT EXISTS liquidity_providers (
        id SERIAL PRIMARY KEY,
        market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
        provider_address VARCHAR(100) NOT NULL,
        current_staked_amount DECIMAL(18, 9) DEFAULT 0,
        total_provided_amount DECIMAL(18, 9) DEFAULT 0,
        total_withdrawn_amount DECIMAL(18, 9) DEFAULT 0,
        staked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_reward_claim_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_rewards_earned DECIMAL(18, 9) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active', -- 'active', 'withdrawn'
        UNIQUE (market_id, provider_address)
      );

      CREATE INDEX IF NOT EXISTS idx_lp_market ON liquidity_providers(market_id);
      CREATE INDEX IF NOT EXISTS idx_lp_provider ON liquidity_providers(provider_address);

      CREATE TABLE IF NOT EXISTS limit_orders (
        id SERIAL PRIMARY KEY,
        market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
        user_address VARCHAR(100) NOT NULL,
        option_id INTEGER NOT NULL,
        order_type VARCHAR(10) NOT NULL, -- 'buy'
        amount DECIMAL(18, 9) NOT NULL, -- Total amount to spend
        price_limit DECIMAL(18, 9) NOT NULL, -- Max price per share
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'filled', 'cancelled'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        filled_at TIMESTAMP,
        cancelled_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_limit_orders_market ON limit_orders(market_id);
      CREATE INDEX IF NOT EXISTS idx_limit_orders_user ON limit_orders(user_address);
      CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders(status);

      CREATE TABLE IF NOT EXISTS ip_blacklist (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) UNIQUE NOT NULL, -- IPv4 or IPv6
        reason TEXT,
        blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ip_blacklist_ip ON ip_blacklist(ip_address);