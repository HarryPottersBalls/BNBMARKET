use crate::{Bet, MarketConfig, MarketError, MarketMakingStrategy};
use rust_decimal::Decimal;
use rust_decimal::prelude::*;

pub struct MarketMakerEngine {
    config: MarketConfig,
}

impl MarketMakerEngine {
    pub fn new(config: MarketConfig) -> Self {
        MarketMakerEngine { config }
    }

    pub fn simulate_strategy(&self, bets: &[Bet]) -> Result<MarketMakingStrategy, MarketError> {
        // Calculate current market probabilities
        let probabilities = self.calculate_market_probabilities(bets)?;

        // Compute bid and ask prices
        let bid_prices = self.calculate_bid_prices(&probabilities);
        let ask_prices = self.calculate_ask_prices(&probabilities);

        // Calculate spread
        let spread = self.calculate_spread(&bid_prices, &ask_prices);

        // Recommend liquidity based on market conditions
        let recommended_liquidity = self.calculate_recommended_liquidity(&probabilities);

        Ok(MarketMakingStrategy {
            bid_prices: bid_prices.iter().map(|p| p.to_f64().unwrap_or(0.0)).collect(),
            ask_prices: ask_prices.iter().map(|p| p.to_f64().unwrap_or(0.0)).collect(),
            spread: spread.to_f64().unwrap_or(0.0),
            recommended_liquidity: recommended_liquidity.to_f64().unwrap_or(0.0),
        })
    }

    fn calculate_market_probabilities(&self, bets: &[Bet]) -> Result<Vec<Decimal>, MarketError> {
        let liquidity_param = Decimal::from_f64(self.config.liquidity_param)
            .ok_or_else(|| MarketError::InvalidLiquidity("Invalid liquidity parameter".to_string()))?;
        let initial_liquidity = liquidity_param / Decimal::from(self.config.num_outcomes);

        let mut outcome_totals = vec![initial_liquidity; self.config.num_outcomes];
        for bet in bets {
            if bet.option_id >= self.config.num_outcomes {
                return Err(MarketError::InvalidOutcomeIndex(bet.option_id));
            }
            let bet_amount = Decimal::from_f64(bet.amount).unwrap_or(Decimal::ZERO);
            outcome_totals[bet.option_id] += bet_amount;
        }

        let total_volume: Decimal = outcome_totals.iter().sum();

        outcome_totals.iter()
            .map(|&amount| Ok(amount / total_volume))
            .collect()
    }

    fn calculate_bid_prices(&self, probabilities: &[Decimal]) -> Vec<Decimal> {
        probabilities.iter()
            .map(|&prob| prob * Decimal::new(95, 2)) // Slightly lower than market price
            .collect()
    }

    fn calculate_ask_prices(&self, probabilities: &[Decimal]) -> Vec<Decimal> {
        probabilities.iter()
            .map(|&prob| prob * Decimal::new(105, 2)) // Slightly higher than market price
            .collect()
    }

    fn calculate_spread(&self, bid_prices: &[Decimal], ask_prices: &[Decimal]) -> Decimal {
        bid_prices.iter()
            .zip(ask_prices.iter())
            .map(|(bid, ask)| ask - bid)
            .sum::<Decimal>() / Decimal::from(bid_prices.len())
    }

    fn calculate_recommended_liquidity(&self, probabilities: &[Decimal]) -> Decimal {
        // More concentrated probabilities suggest lower liquidity recommendation
        let entropy = -probabilities.iter()
            .map(|&p| if p > Decimal::ZERO { p * p.ln() } else { Decimal::ZERO })
            .sum::<Decimal>();

        // Higher entropy (more uncertainty) leads to higher liquidity recommendation
        let liquidity_param = Decimal::from_f64(self.config.liquidity_param).unwrap_or(Decimal::from(10));
        liquidity_param * (Decimal::ONE + entropy)
    }
}