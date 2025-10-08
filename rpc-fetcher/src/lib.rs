use std::collections::HashMap;
use std::time::Duration;

use ethers::{
    prelude::*,
    providers::{Http, Provider, RetryClient},
    types::{Block, Transaction, TransactionReceipt}
};
use serde::{Deserialize, Serialize};
use tokio::time;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RPCFetcherError {
    #[error("Provider connection error")]
    ProviderError(#[from] ProviderError),

    #[error("Serialization error")]
    SerdeError(#[from] serde_json::Error),

    #[error("HTTP request error")]
    HttpError(#[from] reqwest::Error),
}

#[derive(Debug, Clone)]
pub struct BNBChainRPCFetcher {
    provider: Provider<RetryClient<Http>>,
    endpoints: Vec<&'static str>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenPriceInfo {
    pub address: Address,
    pub symbol: String,
    pub decimals: u8,
    pub price_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlockchainMetrics {
    pub latest_block: u64,
    pub network_hashrate: u128,
    pub gas_price: U256,
}

impl BNBChainRPCFetcher {
    // Public BNB Chain RPC Endpoints
    const DEFAULT_ENDPOINTS: &'static [&'static str] = &[
        "https://bsc-dataseed.binance.org/",
        "https://bsc-dataseed1.defibit.io/",
        "https://bsc-dataseed1.ninicoin.io/",
        "https://bsc-dataseed2.defibit.io/",
        "https://bsc-dataseed3.defibit.io/",
        "https://bsc-dataseed4.defibit.io/",
    ];

    pub fn new() -> Result<Self, RPCFetcherError> {
        // Retry mechanism for RPC calls
        let provider = Provider::<RetryClient<Http>>::new_client(
            Self::DEFAULT_ENDPOINTS[0],
            // Retry configuration
            RetryClientConfig::default()
                .with_retries(3)
                .with_timeout(Duration::from_secs(10))
        )?;

        Ok(Self {
            provider,
            endpoints: Self::DEFAULT_ENDPOINTS,
        })
    }

    /// Fetch latest block information
    pub async fn get_latest_block(&self) -> Result<Block<Transaction>, RPCFetcherError> {
        let block = self.provider.get_block_with_txs(BlockNumber::Latest).await?
            .ok_or(RPCFetcherError::ProviderError(ProviderError::JsonRpcClientError))?;

        Ok(block)
    }

    /// Fetch blockchain metrics
    pub async fn get_blockchain_metrics(&self) -> Result<BlockchainMetrics, RPCFetcherError> {
        let latest_block = self.get_latest_block().await?;
        let gas_price = self.provider.get_gas_price().await?;

        Ok(BlockchainMetrics {
            latest_block: latest_block.number.unwrap_or_default().as_u64(),
            network_hashrate: 0, // BNB Chain doesn't expose hashrate directly
            gas_price,
        })
    }

    /// Fetch token price from PancakeSwap Router
    pub async fn fetch_token_price(
        &self,
        token_address: Address,
        base_token: Address
    ) -> Result<f64, RPCFetcherError> {
        // PancakeSwap V2 Router address
        let router_address: Address = "0x10ED43C718714eb63d5aA57B78B54704E256024E".parse().unwrap();

        // Placeholder for actual price fetching logic
        // In a real implementation, you'd call the router's `getAmountsOut` method
        Ok(0.0)
    }

    /// Fetch transaction details
    pub async fn get_transaction_details(
        &self,
        tx_hash: H256
    ) -> Result<(Transaction, Option<TransactionReceipt>), RPCFetcherError> {
        let transaction = self.provider.get_transaction(tx_hash).await?
            .ok_or(RPCFetcherError::ProviderError(ProviderError::JsonRpcClientError))?;

        let receipt = self.provider.get_transaction_receipt(tx_hash).await?;

        Ok((transaction, receipt))
    }

    /// Periodic metrics update stream
    pub async fn metrics_stream(
        &self,
        interval: Duration
    ) -> impl futures::Stream<Item = Result<BlockchainMetrics, RPCFetcherError>> {
        let stream = tokio_stream::wrappers::IntervalStream::new(tokio::time::interval(interval))
            .map(|_| self.get_blockchain_metrics());

        stream
    }
}

// Convenient trait for multi-provider fallback
trait RPCProvider {
    fn get_priority(&self) -> u8;
    fn get_endpoint(&self) -> &str;
}

/// Future Expansion: Multi-Provider Strategy
struct RPCProviderStrategy {
    providers: Vec<Box<dyn RPCProvider>>,
}

impl RPCProviderStrategy {
    fn select_best_provider(&self) -> Option<&dyn RPCProvider> {
        self.providers
            .iter()
            .max_by_key(|p| p.get_priority())
            .map(|p| p.as_ref())
    }
}