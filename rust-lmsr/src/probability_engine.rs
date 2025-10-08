use crate::{Bet, MarketConfig, MarketError, MarketType};
use rust_decimal::Decimal;
use rust_decimal::prelude::*;

pub struct ProbabilityEngine {
    config: MarketConfig,
}

impl ProbabilityEngine {
    pub fn new(config: MarketConfig) -> Self {
        ProbabilityEngine { config }
    }

    pub fn calculate_probabilities(&self, bets: &[Bet]) -> Result<Vec<Decimal>, MarketError> {
        // Validate input
        if bets.iter().any(|b| b.option_id >= self.config.num_outcomes) {
            return Err(MarketError::InvalidOutcomeIndex(
                bets.iter()
                    .find(|b| b.option_id >= self.config.num_outcomes)
                    .map(|b| b.option_id)
                    .unwrap_or(0)
            ));
        }

        // Liquidity calculation
        let liquidity = Decimal::from_f64(self.config.liquidity_param)
            .ok_or_else(|| MarketError::InvalidLiquidity("Invalid liquidity parameter".to_string()))?;
        let initial_liquidity = liquidity / Decimal::from(self.config.num_outcomes);

        // Aggregate outcome totals
        let mut outcome_totals = vec![initial_liquidity; self.config.num_outcomes];
        for bet in bets {
            let bet_amount = Decimal::from_f64(bet.amount).unwrap_or(Decimal::ZERO);
            outcome_totals[bet.option_id] += bet_amount;
        }

        // Exponential scaling
        let max_total = outcome_totals.iter()
            .max_by(|a, b| a.partial_cmp(b).unwrap())
            .cloned()
            .unwrap_or(Decimal::ZERO);

        let scale_factor = max_total / Decimal::new(10, 0);

        // Compute exponentials with scaling
        let exp_values: Vec<Decimal> = outcome_totals.iter()
            .map(|&total| {
                let scaled_total = total / scale_factor;
                // exp() returns Decimal directly, not Result
                scaled_total.exp()
            })
            .collect();

        // Sum of exponentials
        let sum_exp = exp_values.iter()
            .try_fold(Decimal::ZERO, |acc, &x| acc.checked_add(x))
            .ok_or_else(|| MarketError::CalculationError("Numerical overflow in sum".to_string()))?;

        // Final probabilities
        let probabilities = exp_values.iter()
            .map(|&exp_val| {
                exp_val.checked_div(sum_exp)
                    .ok_or_else(|| MarketError::CalculationError("Division by zero in probability calculation".to_string()))
            })
            .collect::<Result<Vec<Decimal>, MarketError>>()?;

        Ok(probabilities)
    }

    pub fn calculate_price(&self, bets: &[Bet], outcome_index: usize) -> Result<Decimal, MarketError> {
        if outcome_index >= self.config.num_outcomes {
            return Err(MarketError::InvalidOutcomeIndex(outcome_index));
        }

        let probabilities = self.calculate_probabilities(bets)?;

        probabilities.get(outcome_index)
            .cloned()
            .ok_or(MarketError::InvalidOutcomeIndex(outcome_index))
    }
}