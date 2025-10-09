use tokio;
use tracing::{info, error};
use tracing_subscriber;

mod market_engine;
mod config;
mod security;
mod performance;
mod monitoring;

use market_engine::MarketEngine;
use config::SystemConfiguration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Load system configuration
    let config = match SystemConfiguration::load() {
        Ok(cfg) => {
            info!("System configuration loaded successfully");
            cfg
        },
        Err(e) => {
            error!("Failed to load configuration: {:?}", e);
            return Err("Configuration load failed".into());
        }
    };

    // Validate configuration
    if let Err(validation_error) = config.validate() {
        error!("Configuration validation failed: {}", validation_error);
        return Err(validation_error.into());
    }

    // Initialize market engine
    let market_engine = MarketEngine::new();

    // Periodic system health check
    tokio::spawn(async move {
        loop {
            match market_engine.system_health_check().await {
                Ok(health_report) => {
                    info!("System Health Check: {:?}", health_report);

                    // Log any critical security events
                    for event in health_report.recent_security_events {
                        if matches!(event.severity, SecurityEventSeverity::Critical) {
                            error!("CRITICAL SECURITY EVENT: {:?}", event);
                        }
                    }
                },
                Err(e) => {
                    error!("System health check failed: {:?}", e);
                }
            }

            // Run health check every 5 minutes
            tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
        }
    });

    // Start blockchain event listener
    start_blockchain_event_listener(&market_engine).await?;

    Ok(())
}

async fn start_blockchain_event_listener(market_engine: &MarketEngine) -> Result<(), Box<dyn std::error::Error>> {
    // Simulate blockchain event listening
    // In a real implementation, this would use web3 or ethers to listen to blockchain events
    tokio::spawn(async move {
        loop {
            // Simulate receiving blockchain transactions
            let simulated_transaction = generate_simulated_transaction();

            // Process transaction through market engine
            if let Err(e) = market_engine.process_market_transaction(simulated_transaction).await {
                error!("Transaction processing error: {:?}", e);
            }

            // Wait before next simulated transaction
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    });

    Ok(())
}

// Helper function to generate simulated transactions for testing
fn generate_simulated_transaction() -> MarketTransaction {
    use ethers::types::{Address, U256};
    use rand::Rng;

    MarketTransaction {
        id: uuid::Uuid::new_v4().to_string(),
        user: generate_random_address(),
        market_id: "simulated_market".to_string(),
        option_id: rand::thread_rng().gen_range(0..3),
        amount: U256::from(rand::thread_rng().gen_range(1..1000)),
        timestamp: chrono::Utc::now(),
    }
}

// Generate a random Ethereum address
fn generate_random_address() -> Address {
    let mut rng = rand::thread_rng();
    let mut addr_bytes = [0u8; 20];
    rng.fill(&mut addr_bytes);
    Address::from(addr_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_market_engine_initialization() {
        // Simulate main application startup
        let market_engine = MarketEngine::new();

        // Test system health check
        let health_report = market_engine.system_health_check().await;

        // Basic assertions
        assert!(health_report.performance_metrics.categories.is_empty());
        assert_eq!(health_report.vulnerability_status.total_vulnerabilities, 0);
    }
}