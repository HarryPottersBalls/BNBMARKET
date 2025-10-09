use criterion::{black_box, criterion_group, criterion_main, Criterion};
use ethers::types::{U256, Address};
use std::time::Instant;
use rand::Rng;

// Simulate market betting scenarios
fn simulate_market_bets(num_bets: usize) {
    let mut rng = rand::thread_rng();

    for _ in 0..num_bets {
        let bet_amount = U256::from(rng.gen_range(1..10_000));
        let market_volume = U256::from(rng.gen_range(10_000..1_000_000));

        let test_address: Address = "0x742d35Cc6A0de1234567890abcdef1234567890".parse().unwrap();

        let bet = BetRiskProfile {
            bet_amount,
            market_volume,
            timestamp: Utc::now(),
            user_address: test_address,
            market_id: "benchmark_market".to_string(),
        };

        // Measure risk assessment performance
        let start = Instant::now();
        let _ = safety_manager.assess_bet_risk(bet);
        let duration = start.elapsed();

        println!("Risk assessment took: {:?}", duration);
    }
}

fn market_performance_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("Market Betting Performance");
    group.sample_size(100);

    // Different bet volume scenarios
    group.bench_function("100 bets", |b| b.iter(|| simulate_market_bets(black_box(100))));
    group.bench_function("1000 bets", |b| b.iter(|| simulate_market_bets(black_box(1000))));
    group.bench_function("10000 bets", |b| b.iter(|| simulate_market_bets(black_box(10000))));

    group.finish();
}

criterion_group!(benches, market_performance_benchmark);
criterion_main!(benches);