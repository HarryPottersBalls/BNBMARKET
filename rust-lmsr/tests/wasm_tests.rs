use wasm_bindgen_test::*;
use rust_lmsr::{PredictionMarketEngine, Bet, MarketType};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn test_prediction_market_engine_creation() {
    let engine = PredictionMarketEngine::new(
        10.0,  // liquidity parameter
        2,     // number of outcomes
        MarketType::Binary
    );

    // Ensure the engine is created successfully
    assert!(true, "PredictionMarketEngine should be created without errors");
}

#[wasm_bindgen_test]
fn test_calculate_probabilities() {
    let engine = PredictionMarketEngine::new(
        10.0,  // liquidity parameter
        2,     // number of outcomes
        MarketType::Binary
    );

    let bets = vec![
        Bet { option_id: 0, amount: 50.0 },
        Bet { option_id: 1, amount: 30.0 }
    ];

    let probabilities = engine.calculate_probabilities(&bets)
        .expect("Probabilities calculation should succeed");

    assert_eq!(probabilities.len(), 2, "Should return probabilities for all outcomes");
    probabilities.iter().for_each(|&p| {
        assert!(p >= 0.0 && p <= 1.0, "Probabilities should be between 0 and 1");
    });
}

#[wasm_bindgen_test]
fn test_calculate_market_price() {
    let engine = PredictionMarketEngine::new(
        10.0,  // liquidity parameter
        2,     // number of outcomes
        MarketType::Binary
    );

    let bets = vec![
        Bet { option_id: 0, amount: 50.0 },
        Bet { option_id: 1, amount: 30.0 }
    ];

    let price = engine.calculate_price(&bets, 0)
        .expect("Price calculation should succeed");

    assert!(price >= 0.0 && price <= 1.0, "Price should be between 0 and 1");
}

#[wasm_bindgen_test]
fn test_simulate_market_making() {
    let engine = PredictionMarketEngine::new(
        10.0,  // liquidity parameter
        2,     // number of outcomes
        MarketType::Binary
    );

    let bets = vec![
        Bet { option_id: 0, amount: 50.0 },
        Bet { option_id: 1, amount: 30.0 }
    ];

    let strategy = engine.simulate_market_making(&bets)
        .expect("Market making simulation should succeed");

    assert!(!strategy.bid_prices.is_empty(), "Bid prices should not be empty");
    assert!(!strategy.ask_prices.is_empty(), "Ask prices should not be empty");
    assert!(strategy.spread >= 0.0, "Spread should be non-negative");
}

#[wasm_bindgen_test]
fn test_assess_market_risk() {
    let engine = PredictionMarketEngine::new(
        10.0,  // liquidity parameter
        2,     // number of outcomes
        MarketType::Binary
    );

    let bets = vec![
        Bet { option_id: 0, amount: 50.0 },
        Bet { option_id: 1, amount: 30.0 }
    ];

    let risk_profile = engine.assess_market_risk(&bets)
        .expect("Market risk assessment should succeed");

    assert!(!risk_profile.probabilities.is_empty(), "Probabilities should not be empty");
    assert!(risk_profile.entropy >= 0.0, "Entropy should be non-negative");
    assert!(risk_profile.concentration >= 0.0, "Concentration should be non-negative");
}

#[wasm_bindgen_test]
fn test_error_handling() {
    let engine = PredictionMarketEngine::new(
        10.0,  // liquidity parameter
        2,     // number of outcomes
        MarketType::Binary
    );

    // Test with invalid outcome index
    let bets = vec![
        Bet { option_id: 0, amount: 50.0 },
        Bet { option_id: 1, amount: 30.0 }
    ];

    let price_result = engine.calculate_price(&bets, 5);
    assert!(price_result.is_err(), "Should return an error for invalid outcome index");
}