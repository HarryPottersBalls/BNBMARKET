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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    // Logging and Monitoring
    pub log_level: LogLevel,
    pub security_event_retention_days: u32,

    // Authentication
    pub max_login_attempts: u8,
    pub session_timeout_minutes: u64,

    // Risk Management
    pub max_transaction_amount: f64,
    pub daily_transaction_limit: f64,
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

        // Default configuration with environment variable overrides
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
                max_transaction_amount: env::var("MAX_TRANSACTION_AMOUNT")
                    .map(|amount| amount.parse().unwrap_or(10_000.0))
                    .unwrap_or(10_000.0),
                daily_transaction_limit: env::var("DAILY_TRANSACTION_LIMIT")
                    .map(|limit| limit.parse().unwrap_or(50_000.0))
                    .unwrap_or(50_000.0),
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
        })
    }

    // Validate configuration
    pub fn validate(&self) -> Result<(), String> {
        // Perform configuration validation
        if self.market.min_bet_amount <= 0.0 {
            return Err("Minimum bet amount must be positive".to_string());
        }

        if self.market.max_bet_amount <= self.market.min_bet_amount {
            return Err("Maximum bet amount must be greater than minimum bet amount".to_string());
        }

        if self.security.max_login_attempts == 0 {
            return Err("Max login attempts must be greater than zero".to_string());
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