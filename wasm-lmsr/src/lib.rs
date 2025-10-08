use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calculate_lmsr_probabilities(liquidity_param: f64, num_outcomes: usize, bets: Vec<f64>) -> Vec<f64> {
    // Simple LMSR probability calculation
    let mut outcome_totals = vec![1.0f64; num_outcomes];

    for (i, &amount) in bets.iter().enumerate() {
        if i < num_outcomes {
            outcome_totals[i] += amount;
        }
    }

    let max_total = outcome_totals.iter()
        .copied()
        .max_by(|a, b| a.partial_cmp(b).unwrap())
        .unwrap_or(1.0);

    let scale_factor = max_total / 10.0;

    let exp_values: Vec<f64> = outcome_totals.iter()
        .map(|&total| ((total / scale_factor) as f64).exp())
        .collect();

    let sum_exp: f64 = exp_values.iter().sum();

    exp_values.iter()
        .map(|&exp_val| exp_val / sum_exp)
        .collect()
}

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}