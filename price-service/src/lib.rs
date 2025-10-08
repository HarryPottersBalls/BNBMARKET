use std::collections::HashMap;
use std::pin::Pin;
use std::time::Duration;

use futures::Stream;
use futures::stream;
use tokio::time;
use tokio::sync::mpsc;

use reqwest;
use serde::{Deserialize, Serialize};
use tonic::{Request, Response, Status};

// Price fetching structs
#[derive(Debug, Clone, Serialize, Deserialize)]
struct TokenPrice {
    symbol: String,
    price: f64,
    source: String,
}

#[derive(Default)]
pub struct PriceServiceImpl {
    client: reqwest::Client,
}

impl PriceServiceImpl {
    // Providers for price fetching
    const PRICE_PROVIDERS: &'static [(&'static str, &'static str)] = &[
        ("binance", "https://api.binance.com/api/v3/ticker/price"),
        ("coingecko", "https://api.coingecko.com/api/v3/simple/price"),
    ];

    async fn fetch_prices(&self, tokens: &[String]) -> Result<HashMap<String, TokenPrice>, Box<dyn std::error::Error>> {
        let mut prices = HashMap::new();

        for (source, url) in Self::PRICE_PROVIDERS {
            match self.fetch_provider_prices(url, tokens, source).await {
                Ok(provider_prices) => {
                    prices.extend(provider_prices);
                }
                Err(e) => {
                    eprintln!("Error fetching prices from {}: {}", source, e);
                }
            }
        }

        Ok(prices)
    }

    async fn fetch_provider_prices(
        &self,
        url: &str,
        tokens: &[String],
        source: &str
    ) -> Result<HashMap<String, TokenPrice>, reqwest::Error> {
        let response = self.client.get(url)
            .query(&[("symbols", tokens.join(","))])
            .send()
            .await?
            .json::<HashMap<String, f64>>()
            .await?;

        Ok(response.into_iter().map(|(symbol, price)| {
            (symbol.to_uppercase(), TokenPrice {
                symbol: symbol.to_uppercase(),
                price,
                source: source.to_string(),
            })
        }).collect())
    }
}

// gRPC Service Implementation
#[tonic::async_trait]
impl PriceService for PriceServiceImpl {
    async fn get_current_prices(
        &self,
        request: Request<PriceRequest>
    ) -> Result<Response<PriceResponse>, Status> {
        let tokens = request.into_inner().tokens;

        let prices = self.fetch_prices(&tokens)
            .await
            .map_err(|_| Status::internal("Price fetching failed"))?;

        let response = PriceResponse {
            prices: prices.into_iter()
                .map(|(token, price)| (token, price.into()))
                .collect(),
            timestamp: chrono::Utc::now().timestamp(),
        };

        Ok(Response::new(response))
    }

    // Streaming price updates
    type SubscribePriceUpdatesStream = Pin<Box<dyn Stream<Item = Result<PriceUpdate, Status>> + Send>>;

    async fn subscribe_price_updates(
        &self,
        request: Request<SubscriptionRequest>
    ) -> Result<Response<Self::SubscribePriceUpdatesStream>, Status> {
        let subscription = request.into_inner();
        let (tx, rx) = mpsc::channel(100);

        // Clone tokens for move into async block
        let tokens = subscription.tokens.clone();
        let interval_ms = subscription.update_interval_ms;

        tokio::spawn(async move {
            let mut interval = time::interval(
                Duration::from_millis(interval_ms as u64)
            );

            loop {
                interval.tick().await;

                match self.fetch_prices(&tokens).await {
                    Ok(prices) => {
                        for (token, price_data) in prices {
                            let update = PriceUpdate {
                                token,
                                price: price_data.price,
                                timestamp: chrono::Utc::now().timestamp(),
                            };

                            if tx.send(Ok(update)).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(_) => {
                        // Optional: send error or skip
                    }
                }
            }
        });

        // Convert channel receiver to stream
        let stream = stream::wrappers::ReceiverStream::new(rx);
        Ok(Response::new(Box::pin(stream) as Self::SubscribePriceUpdatesStream))
    }
}

// Conversion for protobuf compatibility
impl From<TokenPrice> for TokenPrice {
    fn from(price: TokenPrice) -> Self {
        TokenPrice {
            price: price.price,
            source: price.source,
        }
    }
}