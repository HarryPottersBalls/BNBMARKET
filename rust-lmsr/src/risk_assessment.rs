use crate::{Bet, MarketConfig, MarketError, MarketRiskProfile};
use rust_decimal::Decimal;
use rust_decimal::prelude::*;

pub struct RiskAssessmentEngine {
    config: MarketConfig,
}

impl RiskAssessmentEngine {
    pub fn new(config: MarketConfig) -> Self {
        RiskAssessmentEngine { config }
    }

    pub fn assess_risk(&self, bets: &[Bet]) -> Result<MarketRiskProfile, MarketError> {
        // Probability calculation
        let probabilities = self.calculate_market_probabilities(bets)?;

        // Entropy calculation
        let entropy = self.calculate_entropy(&probabilities);

        // Market concentration
        let concentration = self.calculate_concentration(&probabilities);

        // Volatility estimation
        let expected_volatility = self.estimate_volatility(&probabilities);

        // Liquidity risk assessment
        let liquidity_risk = self.assess_liquidity_risk(bets);

        Ok(MarketRiskProfile {
            probabilities: probabilities.iter().map(|p| p.to_f64().unwrap_or(0.0)).collect(),
            entropy: entropy.to_f64().unwrap_or(0.0),
            concentration: concentration.to_f64().unwrap_or(0.0),
            expected_volatility: expected_volatility.to_f64().unwrap_or(0.0),
            liquidity_risk: liquidity_risk.to_f64().unwrap_or(0.0),
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

    fn calculate_entropy(&self, probabilities: &[Decimal]) -> Decimal {
        -probabilities.iter()
            .map(|&p| if p > Decimal::ZERO { p * p.ln() } else { Decimal::ZERO })
            .sum::<Decimal>()
    }

    fn calculate_concentration(&self, probabilities: &[Decimal]) -> Decimal {
        probabilities.iter()
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .cloned()
            .unwrap_or(Decimal::ZERO)
    }

    fn estimate_volatility(&self, probabilities: &[Decimal]) -> Decimal {
        // Variance of probabilities as a volatility proxy
        let mean_prob = probabilities.iter().sum::<Decimal>() / Decimal::from(probabilities.len());

        probabilities.iter()
            .map(|&p| (p - mean_prob).powi(2))
            .sum::<Decimal>() / Decimal::from(probabilities.len())
    }

    fn assess_liquidity_risk(&self, bets: &[Bet]) -> Decimal {
        // Liquidity risk based on bet concentration and total volume
        let total_volume: Decimal = bets.iter()
            .map(|bet| Decimal::from_f64(bet.amount).unwrap_or(Decimal::ZERO))
            .sum();

        let max_bet = bets.iter()
            .map(|bet| Decimal::from_f64(bet.amount).unwrap_or(Decimal::ZERO))
            .max()
            .unwrap_or(Decimal::ZERO);

        // Higher ratio indicates higher liquidity risk
        if total_volume > Decimal::ZERO {
            max_bet / total_volume
        } else {
            Decimal::ONE // Maximum risk if no volume
        }
    }
}