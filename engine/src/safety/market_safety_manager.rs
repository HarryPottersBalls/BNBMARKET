use ethers::types::{U256, Address};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketSafetyConfig {
    pub max_market_volume: f64, // BNB
    pub max_single_bet_ratio: f64,
    pub min_liquidity_threshold: f64,
    pub manipulation_detection_window: u64, // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BetRiskProfile {
    pub bet_amount: U256, // Use U256 for precise blockchain amounts
    pub market_volume: U256,
    pub timestamp: DateTime<Utc>,
    pub user_address: Address,
    pub market_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketRiskAssessment {
    pub market_id: String,
    pub risk_level: RiskLevel,
    pub risk_factors: Vec<String>,
    pub recommended_action: String,
}

pub struct MarketSafetyManager {
    config: MarketSafetyConfig,
    market_bets: Arc<Mutex<HashMap<String, Vec<BetRiskProfile>>>>,
    blacklisted_addresses: Arc<Mutex<Vec<Address>>>,
}

impl MarketSafetyManager {
    pub fn new(config: MarketSafetyConfig) -> Self {
        MarketSafetyManager {
            config,
            market_bets: Arc::new(Mutex::new(HashMap::new())),
            blacklisted_addresses: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn is_address_blacklisted(&self, address: &Address) -> bool {
        let blacklist = self.blacklisted_addresses.lock().unwrap();
        blacklist.contains(address)
    }

    pub fn blacklist_address(&self, address: Address) {
        let mut blacklist = self.blacklisted_addresses.lock().unwrap();
        if !blacklist.contains(&address) {
            blacklist.push(address);
        }
    }

    pub fn assess_bet_risk(&self, bet: BetRiskProfile) -> Result<RiskLevel, String> {
        // Check blacklisted addresses first
        if self.is_address_blacklisted(&bet.user_address) {
            return Err("User address is blacklisted".to_string());
        }

        let mut market_bets = self.market_bets.lock().unwrap();

        let market_bets_vec = market_bets.entry(bet.market_id.clone()).or_insert_with(Vec::new);

        // Convert U256 to f64 for ratio calculations (with potential loss of precision)
        let bet_amount_f64 = bet.bet_amount.as_u64() as f64;
        let market_volume_f64 = bet.market_volume.as_u64() as f64;

        // Volume check
        if market_volume_f64 > self.config.max_market_volume {
            return Err("Market volume exceeds maximum allowed".to_string());
        }

        // Single bet ratio check
        let bet_ratio = bet_amount_f64 / market_volume_f64;
        if bet_ratio > self.config.max_single_bet_ratio {
            // Potential high-risk bet, consider blacklisting
            self.blacklist_address(bet.user_address);
            return Ok(RiskLevel::Critical);
        }

        // Detect rapid betting patterns
        let now = Utc::now();
        let recent_bets: Vec<&BetRiskProfile> = market_bets_vec
            .iter()
            .filter(|b|
                (now - b.timestamp).num_seconds() < self.config.manipulation_detection_window as i64
            )
            .collect();

        let risk_level = match recent_bets.len() {
            0..=2 => RiskLevel::Low,
            3..=5 => RiskLevel::Medium,
            6..=10 => RiskLevel::High,
            _ => RiskLevel::Critical,
        };

        // Add current bet to market bets
        market_bets_vec.push(bet.clone());

        // Optional: Trim old bets to prevent memory growth
        if market_bets_vec.len() > 100 {
            market_bets_vec.remove(0);
        }

        Ok(risk_level)
    }

    pub fn generate_market_risk_report(&self, market_id: &str) -> Option<MarketRiskAssessment> {
        let market_bets = self.market_bets.lock().unwrap();

        let market_bet_history = market_bets.get(market_id)?;

        // Advanced risk assessment logic
        let risk_factors = vec![];

        Some(MarketRiskAssessment {
            market_id: market_id.to_string(),
            risk_level: RiskLevel::Low, // Placeholder
            risk_factors,
            recommended_action: "MONITOR".to_string(),
        })
    }
}

// Example configuration
impl Default for MarketSafetyConfig {
    fn default() -> Self {
        MarketSafetyConfig {
            max_market_volume: 1_000_000.0, // 1M BNB
            max_single_bet_ratio: 0.1,      // 10% of market volume
            min_liquidity_threshold: 0.05,  // 5% minimum liquidity
            manipulation_detection_window: 300, // 5 minutes
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::{U256, Address};

    #[test]
    fn test_market_safety_risk_assessment() {
        let safety_manager = MarketSafetyManager::new(MarketSafetyConfig::default());

        let test_address: Address = "0x742d35Cc6A0de1234567890abcdef1234567890".parse().unwrap();

        let bet = BetRiskProfile {
            bet_amount: U256::from(5000_u64), // 5000 BNB
            market_volume: U256::from(50_000_u64), // 50,000 BNB
            timestamp: Utc::now(),
            user_address: test_address,
            market_id: "market_1".to_string(),
        };

        let risk_level = safety_manager.assess_bet_risk(bet).expect("Risk assessment failed");

        assert!(matches!(risk_level, RiskLevel::Low | RiskLevel::Medium));
    }

    #[test]
    fn test_address_blacklisting() {
        let safety_manager = MarketSafetyManager::new(MarketSafetyConfig::default());

        let test_address: Address = "0x742d35Cc6A0de1234567890abcdef1234567890".parse().unwrap();

        // Blacklist address
        safety_manager.blacklist_address(test_address);

        // Verify blacklist
        assert!(safety_manager.is_address_blacklisted(&test_address));
    }
}