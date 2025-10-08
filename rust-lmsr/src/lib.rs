use rust_decimal::Decimal;
use rust_decimal::prelude::*;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use wasm_bindgen::prelude::*;

mod market_maker;
mod risk_assessment;
mod probability_engine;

pub use market_maker::MarketMakerEngine;
pub use risk_assessment::RiskAssessmentEngine;
pub use probability_engine::ProbabilityEngine;

// Error type for market operations
#[derive(Error, Debug)]
pub enum MarketError {
    #[error("Invalid outcome index: {0}")]
    InvalidOutcomeIndex(usize),
    #[error("Invalid liquidity parameter: {0}")]
    InvalidLiquidity(String),
    #[error("Calculation error: {0}")]
    CalculationError(String),
    #[error("Insufficient data: {0}")]
    InsufficientData(String),
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bet {
    #[wasm_bindgen(getter)]
    pub option_id: usize,
    #[wasm_bindgen(getter)]
    pub amount: f64,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum MarketType {
    Binary,
    Categorical,
    Scalar,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketConfig {
    #[wasm_bindgen(getter)]
    pub liquidity_param: f64,
    #[wasm_bindgen(getter)]
    pub num_outcomes: usize,
    #[wasm_bindgen(getter)]
    pub market_type: MarketType,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketMakingStrategy {
    bid_prices: Vec<f64>,
    ask_prices: Vec<f64>,
    spread: f64,
    recommended_liquidity: f64,
}

#[wasm_bindgen]
impl MarketMakingStrategy {
    #[wasm_bindgen(getter)]
    pub fn bid_prices(&self) -> Vec<f64> {
        self.bid_prices.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn ask_prices(&self) -> Vec<f64> {
        self.ask_prices.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn spread(&self) -> f64 {
        self.spread
    }

    #[wasm_bindgen(getter)]
    pub fn recommended_liquidity(&self) -> f64 {
        self.recommended_liquidity
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketRiskProfile {
    probabilities: Vec<f64>,
    entropy: f64,
    concentration: f64,
    expected_volatility: f64,
    liquidity_risk: f64,
}

#[wasm_bindgen]
impl MarketRiskProfile {
    #[wasm_bindgen(getter)]
    pub fn probabilities(&self) -> Vec<f64> {
        self.probabilities.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn entropy(&self) -> f64 {
        self.entropy
    }

    #[wasm_bindgen(getter)]
    pub fn concentration(&self) -> f64 {
        self.concentration
    }

    #[wasm_bindgen(getter)]
    pub fn expected_volatility(&self) -> f64 {
        self.expected_volatility
    }

    #[wasm_bindgen(getter)]
    pub fn liquidity_risk(&self) -> f64 {
        self.liquidity_risk
    }
}

#[wasm_bindgen]
pub struct PredictionMarketEngine {
    config: MarketConfig,
    probability_engine: ProbabilityEngine,
    market_maker: MarketMakerEngine,
    risk_assessment: RiskAssessmentEngine,
}

#[wasm_bindgen]
impl PredictionMarketEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(
        liquidity_param: f64,
        num_outcomes: usize,
        market_type: MarketType
    ) -> Self {
        let config = MarketConfig {
            liquidity_param,
            num_outcomes,
            market_type,
        };

        PredictionMarketEngine {
            config: config.clone(),
            probability_engine: ProbabilityEngine::new(config.clone()),
            market_maker: MarketMakerEngine::new(config.clone()),
            risk_assessment: RiskAssessmentEngine::new(config),
        }
    }

    #[wasm_bindgen(js_name = calculateProbabilities)]
    pub fn calculate_probabilities(&self, bets: Vec<JsValue>) -> Result<Vec<f64>, JsValue> {
        let bets: Vec<Bet> = bets.into_iter()
            .map(|bet_js| serde_wasm_bindgen::from_value(bet_js))
            .collect::<Result<Vec<Bet>, _>>()
            .map_err(|e| JsValue::from_str(&format!("Failed to parse bets: {:?}", e)))?;

        self.probability_engine.calculate_probabilities(&bets)
            .map(|probs| probs.iter().map(|p| p.to_f64().unwrap_or(0.0)).collect())
            .map_err(|e| JsValue::from_str(&format!("Probability calculation error: {:?}", e)))
    }

    #[wasm_bindgen(js_name = simulateMarketMaking)]
    pub fn simulate_market_making(&self, bets: Vec<JsValue>) -> Result<JsValue, JsValue> {
        let bets: Vec<Bet> = bets.into_iter()
            .map(|bet_js| serde_wasm_bindgen::from_value(bet_js))
            .collect::<Result<Vec<Bet>, _>>()
            .map_err(|e| JsValue::from_str(&format!("Failed to parse bets: {:?}", e)))?;

        let result = self.market_maker.simulate_strategy(&bets)
            .map_err(|e| JsValue::from_str(&format!("Market making error: {:?}", e)))?;

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {:?}", e)))
    }

    #[wasm_bindgen(js_name = assessMarketRisk)]
    pub fn assess_market_risk(&self, bets: Vec<JsValue>) -> Result<JsValue, JsValue> {
        let bets: Vec<Bet> = bets.into_iter()
            .map(|bet_js| serde_wasm_bindgen::from_value(bet_js))
            .collect::<Result<Vec<Bet>, _>>()
            .map_err(|e| JsValue::from_str(&format!("Failed to parse bets: {:?}", e)))?;

        let result = self.risk_assessment.assess_risk(&bets)
            .map_err(|e| JsValue::from_str(&format!("Risk assessment error: {:?}", e)))?;

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {:?}", e)))
    }

    #[wasm_bindgen(js_name = calculatePrice)]
    pub fn calculate_price(&self, bets: Vec<JsValue>, outcome_index: usize) -> Result<f64, JsValue> {
        let bets: Vec<Bet> = bets.into_iter()
            .map(|bet_js| serde_wasm_bindgen::from_value(bet_js))
            .collect::<Result<Vec<Bet>, _>>()
            .map_err(|e| JsValue::from_str(&format!("Failed to parse bets: {:?}", e)))?;

        self.probability_engine.calculate_price(&bets, outcome_index)
            .map(|price| price.to_f64().unwrap_or(0.0))
            .map_err(|e| JsValue::from_str(&format!("Price calculation error: {:?}", e)))
    }
}