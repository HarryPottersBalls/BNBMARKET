use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use ethers::types::{U256, Address};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalMarketMetrics {
    pub total_market_volume: U256,
    pub active_markets: usize,
    pub total_users: usize,
    pub security_risk_level: RiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketHealthIndicators {
    pub market_id: String,
    pub current_volume: U256,
    pub total_bets: usize,
    pub liquidity_ratio: f64,
    pub manipulation_risk: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

pub struct ContinuousMonitoringDashboard {
    global_metrics: GlobalMarketMetrics,
    market_health: HashMap<String, MarketHealthIndicators>,
    security_events: Vec<SecurityEvent>,
    user_activity_map: HashMap<Address, UserActivityProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserActivityProfile {
    pub address: Address,
    pub total_bets: u64,
    pub total_volume: U256,
    pub last_activity: DateTime<Utc>,
    pub risk_score: f64,
}

impl ContinuousMonitoringDashboard {
    pub fn new() -> Self {
        ContinuousMonitoringDashboard {
            global_metrics: GlobalMarketMetrics {
                total_market_volume: U256::zero(),
                active_markets: 0,
                total_users: 0,
                security_risk_level: RiskLevel::Low,
            },
            market_health: HashMap::new(),
            security_events: Vec::new(),
            user_activity_map: HashMap::new(),
        }
    }

    pub fn update_global_metrics(&mut self, markets: &[Market]) {
        let total_volume: U256 = markets.iter()
            .map(|market| market.total_volume)
            .sum();

        let active_markets = markets.len();
        let total_users = self.user_activity_map.len();

        // Determine global security risk
        let security_risk_level = self.calculate_global_risk_level();

        self.global_metrics = GlobalMarketMetrics {
            total_market_volume: total_volume,
            active_markets,
            total_users,
            security_risk_level,
        };
    }

    pub fn update_market_health(&mut self, market: &Market) {
        let health_indicators = MarketHealthIndicators {
            market_id: market.id.clone(),
            current_volume: market.total_volume,
            total_bets: market.bets.len(),
            liquidity_ratio: calculate_liquidity_ratio(market),
            manipulation_risk: calculate_manipulation_risk(market),
        };

        self.market_health.insert(market.id.clone(), health_indicators);
    }

    pub fn track_user_activity(&mut self, address: Address, bet: &Bet) {
        let user_profile = self.user_activity_map
            .entry(address)
            .or_insert(UserActivityProfile {
                address,
                total_bets: 0,
                total_volume: U256::zero(),
                last_activity: Utc::now(),
                risk_score: 0.0,
            });

        user_profile.total_bets += 1;
        user_profile.total_volume += bet.amount;
        user_profile.last_activity = Utc::now();
        user_profile.risk_score = calculate_user_risk_score(user_profile);
    }

    fn calculate_global_risk_level(&self) -> RiskLevel {
        // Complex risk calculation based on multiple factors
        let high_risk_markets = self.market_health.values()
            .filter(|health| health.manipulation_risk > 0.7)
            .count();

        let security_events_severity: f64 = self.security_events.iter()
            .map(|event| match event.severity {
                SecurityEventSeverity::Low => 0.25,
                SecurityEventSeverity::Medium => 0.5,
                SecurityEventSeverity::High => 0.75,
                SecurityEventSeverity::Critical => 1.0,
            })
            .sum();

        // Combine market and event risks
        let risk_score = (high_risk_markets as f64 / self.market_health.len().max(1) as f64)
            + (security_events_severity / self.security_events.len().max(1) as f64);

        match risk_score {
            x if x < 0.2 => RiskLevel::Low,
            x if x < 0.5 => RiskLevel::Medium,
            x if x < 0.8 => RiskLevel::High,
            _ => RiskLevel::Critical,
        }
    }

    pub fn generate_security_dashboard_report(&self) -> SecurityDashboardReport {
        SecurityDashboardReport {
            global_metrics: self.global_metrics.clone(),
            market_health: self.market_health.clone(),
            recent_security_events: self.security_events.clone(),
            high_risk_users: self.identify_high_risk_users(),
        }
    }

    fn identify_high_risk_users(&self) -> Vec<UserActivityProfile> {
        self.user_activity_map.values()
            .filter(|profile| profile.risk_score > 0.7)
            .cloned()
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityDashboardReport {
    pub global_metrics: GlobalMarketMetrics,
    pub market_health: HashMap<String, MarketHealthIndicators>,
    pub recent_security_events: Vec<SecurityEvent>,
    pub high_risk_users: Vec<UserActivityProfile>,
}

// Helper functions (placeholders - implement with actual logic)
fn calculate_liquidity_ratio(market: &Market) -> f64 {
    // Implement liquidity ratio calculation
    0.5 // Placeholder
}

fn calculate_manipulation_risk(market: &Market) -> f64 {
    // Implement manipulation risk calculation
    0.3 // Placeholder
}

fn calculate_user_risk_score(profile: &UserActivityProfile) -> f64 {
    // Implement user risk scoring algorithm
    0.5 // Placeholder
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_continuous_monitoring_dashboard() {
        let mut dashboard = ContinuousMonitoringDashboard::new();

        // Simulate adding markets and tracking activities
        let test_market = Market {
            id: "test_market".to_string(),
            total_volume: U256::from(1000),
            bets: vec![],
        };

        dashboard.update_market_health(&test_market);

        let test_address: Address = "0x1234567890123456789012345678901234567890".parse().unwrap();
        let test_bet = Bet {
            amount: U256::from(100),
            user: test_address,
        };

        dashboard.track_user_activity(test_address, &test_bet);

        let report = dashboard.generate_security_dashboard_report();

        assert!(report.global_metrics.active_markets > 0);
    }
}