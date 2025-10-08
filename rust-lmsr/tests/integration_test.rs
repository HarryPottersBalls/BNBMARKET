use bnbmarket_lmsr::{
    PredictionMarketEngine,
    Bet,
    MarketType
};
use rust_decimal::Decimal;

#[test]
fn test_comprehensive_market_engine() {
    let engine = PredictionMarketEngine::new(
        Decimal::new(10, 0),  // Liquidity parameter
        3,                    // Number of outcomes
        MarketType::Categorical
    );

    let bets = vec![
        Bet { option_id: 0, amount: Decimal::new(50, 0) },
        Bet { option_id: 1, amount: Decimal::new(30, 0) },
    ];

    // Probability Calculations
    let probabilities = engine.calculate_probabilities(&bets)
        .expect("Probability calculation should succeed");
    assert_eq!(probabilities.len(), 3);
    assert!(probabilities.iter().all(|&p| p >= Decimal::ZERO && p <= Decimal::ONE));

    // Price Calculation
    let price_0 = engine.calculate_price(&bets, 0)
        .expect("Price calculation should succeed");
    assert!(price_0 > Decimal::ZERO);

    // Market Making Strategy
    let market_strategy = engine.simulate_market_making(&bets)
        .expect("Market making simulation should succeed");
    assert_eq!(market_strategy.bid_prices.len(), 3);
    assert_eq!(market_strategy.ask_prices.len(), 3);

    // Risk Assessment
    let market_risk = engine.assess_market_risk(&bets)
        .expect("Risk assessment should succeed");
    assert!(market_risk.entropy > Decimal::ZERO);
    assert!(market_risk.concentration > Decimal::ZERO);
    assert!(market_risk.liquidity_risk > Decimal::ZERO);
}