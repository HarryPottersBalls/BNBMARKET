use serde::{Serialize, Deserialize};
use std::env;
use dotenv::dotenv;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfiguration {
    // Security Configuration
    pub security: SecurityConfig,

    // Performance Configuration
    pub performance: PerformanceConfig,

    // Market Specific Configuration
    pub market: MarketConfig,

    // Blockchain Specific Configuration
    pub blockchain: BlockchainConfig,

    // Market Safety Configuration
    pub market_safety_config: MarketSafetyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub log_level: LogLevel,
    pub security_event_retention_days: u32,
    pub max_login_attempts: u8,
    pub session_timeout_minutes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    pub max_concurrent_transactions: usize,
    pub transaction_queue_size: usize,
    pub profiling_sample_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketConfig {
    pub max_market_volume: f64,
    pub min_bet_amount: f64,
    pub max_bet_amount: f64,
    pub market_creation_fee: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainConfig {
    pub network: BlockchainNetwork,
    pub rpc_endpoint: String,
    pub chain_id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketSafetyConfig {
    pub max_bet_ratio: f64,
    pub manipulation_detection_window: u64,
    pub blacklist_threshold: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlockchainNetwork {
    BinanceSmartChain,
    Ethereum,
    Polygon,
    Local,
}

impl SystemConfiguration {
    pub fn load() -> Result<Self, config::ConfigError> {
        // Load environment variables
        dotenv().ok();

        Ok(SystemConfiguration {
            security: SecurityConfig {
                log_level: env::var("LOG_LEVEL")
                    .map(|level| match level.to_lowercase().as_str() {
                        "debug" => LogLevel::Debug,
                        "info" => LogLevel::Info,
                        "warn" => LogLevel::Warn,
                        "error" => LogLevel::Error,
                        "critical" => LogLevel::Critical,
                        _ => LogLevel::Info,
                    })
                    .unwrap_or(LogLevel::Info),
                security_event_retention_days: env::var("SECURITY_EVENT_RETENTION")
                    .map(|days| days.parse().unwrap_or(30))
                    .unwrap_or(30),
                max_login_attempts: env::var("MAX_LOGIN_ATTEMPTS")
                    .map(|attempts| attempts.parse().unwrap_or(5))
                    .unwrap_or(5),
                session_timeout_minutes: env::var("SESSION_TIMEOUT")
                    .map(|timeout| timeout.parse().unwrap_or(60))
                    .unwrap_or(60),
            },
            performance: PerformanceConfig {
                max_concurrent_transactions: env::var("MAX_CONCURRENT_TRANSACTIONS")
                    .map(|txns| txns.parse().unwrap_or(100))
                    .unwrap_or(100),
                transaction_queue_size: env::var("TRANSACTION_QUEUE_SIZE")
                    .map(|size| size.parse().unwrap_or(1000))
                    .unwrap_or(1000),
                profiling_sample_rate: env::var("PROFILING_SAMPLE_RATE")
                    .map(|rate| rate.parse().unwrap_or(0.1))
                    .unwrap_or(0.1),
            },
            market: MarketConfig {
                max_market_volume: env::var("MAX_MARKET_VOLUME")
                    .map(|vol| vol.parse().unwrap_or(1_000_000.0))
                    .unwrap_or(1_000_000.0),
                min_bet_amount: env::var("MIN_BET_AMOUNT")
                    .map(|amount| amount.parse().unwrap_or(1.0))
                    .unwrap_or(1.0),
                max_bet_amount: env::var("MAX_BET_AMOUNT")
                    .map(|amount| amount.parse().unwrap_or(10_000.0))
                    .unwrap_or(10_000.0),
                market_creation_fee: env::var("MARKET_CREATION_FEE")
                    .map(|fee| fee.parse().unwrap_or(50.0))
                    .unwrap_or(50.0),
            },
            blockchain: BlockchainConfig {
                network: env::var("BLOCKCHAIN_NETWORK")
                    .map(|network| match network.to_lowercase().as_str() {
                        "bsc" => BlockchainNetwork::BinanceSmartChain,
                        "eth" => BlockchainNetwork::Ethereum,
                        "polygon" => BlockchainNetwork::Polygon,
                        _ => BlockchainNetwork::Local,
                    })
                    .unwrap_or(BlockchainNetwork::BinanceSmartChain),
                rpc_endpoint: env::var("RPC_ENDPOINT")
                    .unwrap_or_else(|_| "https://bsc-dataseed.binance.org/".to_string()),
                chain_id: env::var("CHAIN_ID")
                    .map(|id| id.parse().unwrap_or(56))
                    .unwrap_or(56), // BSC Mainnet
            },
            market_safety_config: MarketSafetyConfig {
                max_bet_ratio: env::var("MAX_BET_RATIO")
                    .map(|ratio| ratio.parse().unwrap_or(0.2))
                    .unwrap_or(0.2),
                manipulation_detection_window: env::var("MANIPULATION_DETECTION_WINDOW")
                    .map(|window| window.parse().unwrap_or(300))
                    .unwrap_or(300),
                blacklist_threshold: env::var("BLACKLIST_THRESHOLD")
                    .map(|threshold| threshold.parse().unwrap_or(5))
                    .unwrap_or(5),
            },
        })
    }

    pub fn validate(&self) -> Result<(), String> {
        // Validate configuration parameters
        if self.market.min_bet_amount <= 0.0 {
            return Err("Minimum bet amount must be positive".to_string());
        }

        if self.market.max_bet_amount <= self.market.min_bet_amount {
            return Err("Maximum bet amount must be greater than minimum bet amount".to_string());
        }

        if self.market_safety_config.max_bet_ratio <= 0.0 || self.market_safety_config.max_bet_ratio > 1.0 {
            return Err("Maximum bet ratio must be between 0 and 1".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_configuration_loading() {
        // Simulate environment setup
        std::env::set_var("LOG_LEVEL", "debug");
        std::env::set_var("BLOCKCHAIN_NETWORK", "bsc");

        let config = SystemConfiguration::load().expect("Failed to load configuration");

        // Validate loaded configuration
        assert!(matches!(config.security.log_level, LogLevel::Debug));
        assert!(matches!(config.blockchain.network, BlockchainNetwork::BinanceSmartChain));
    }

    #[test]
    fn test_configuration_validation() {
        let config = SystemConfiguration::load().expect("Failed to load configuration");

        // Perform validation
        assert!(config.validate().is_ok());
    }
}