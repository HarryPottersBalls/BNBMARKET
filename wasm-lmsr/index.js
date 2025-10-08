const wasmInit = require('./pkg/wasm_lmsr');

class LMSREngine {
    constructor(liquidityParam = 10, numOutcomes = 2) {
        this.wasmModule = null;
        this.liquidityParam = liquidityParam;
        this.numOutcomes = numOutcomes;
    }

    async initialize() {
        if (!this.wasmModule) {
            this.wasmModule = await wasmInit();
            this.engine = new this.wasmModule.LMSREngine(
                this.liquidityParam,
                this.numOutcomes
            );
        }
        return this;
    }

    calculateProbabilities(bets) {
        if (!this.engine) {
            throw new Error('WASM engine not initialized. Call initialize() first.');
        }
        return this.engine.calculate_probabilities(bets);
    }

    calculatePrice(bets, outcomeIndex) {
        if (!this.engine) {
            throw new Error('WASM engine not initialized. Call initialize() first.');
        }
        return this.engine.calculate_price(bets, outcomeIndex);
    }

    assessMarketRisk(bets) {
        if (!this.engine) {
            throw new Error('WASM engine not initialized. Call initialize() first.');
        }
        return this.engine.assess_market_risk(bets);
    }

    // Fallback to JavaScript implementation if WASM fails
    static fallbackCalculation(liquidityParam, bets, numOutcomes) {
        const initialLiquidity = liquidityParam / numOutcomes;
        const outcomeTotals = new Array(numOutcomes).fill(initialLiquidity);

        // Aggregate bet amounts
        bets.forEach(bet => {
            if (bet.option_id < numOutcomes) {
                outcomeTotals[bet.option_id] += bet.amount;
            }
        });

        // Basic probability calculation
        const sumTotals = outcomeTotals.reduce((a, b) => a + b, 0);
        return outcomeTotals.map(total => total / sumTotals);
    }
}

module.exports = LMSREngine;