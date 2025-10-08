require('dotenv-flow').config();
const { Pool } = require('pg');
const logger = require('./utils/logger');
const { calculateLMSRProbabilities, calculateLMSRPrice, parseJSONBField } = require('./utils/lmsr-calculations'); // Import LMSR functions and parseJSONBField
const Decimal = require('decimal.js'); // Import decimal.js for precise calculations

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') ? {
    rejectUnauthorized: false,
    sslmode: 'require'
  } : false,
});

async function checkAndFillLimitOrders(marketId, client) {
  try {
    logger.info(`Checking limit orders for market ${marketId}...`);

    // 1. Get market details
    const marketResult = await client.query(
      'SELECT id, options, metadata FROM markets WHERE id = $1 AND status = \'active\'',
      [marketId]
    );
    if (marketResult.rows.length === 0) {
      logger.warn(`Market ${marketId} not found or inactive for limit order check.`);
      return;
    }
    const market = marketResult.rows[0];
    const options = parseJSONBField(market.options, 'options');
    const numOutcomes = options.length;

    // 2. Get all pending limit buy orders for this market
    const pendingOrdersResult = await client.query(
      'SELECT * FROM limit_orders WHERE market_id = $1 AND status = \'pending\' AND order_type = \'buy\' ORDER BY price_limit DESC',
      [marketId]
    );
    const pendingOrders = pendingOrdersResult.rows;

    if (pendingOrders.length === 0) {
      logger.info(`No pending limit buy orders for market ${marketId}.`);
      return;
    }

    // 3. Get all current bets for the market (needed for LMSR calculation)
    const currentBetsResult = await client.query(
      'SELECT option_id, amount FROM bets WHERE market_id = $1 AND status = \'confirmed\'',
      [marketId]
    );
    const currentBets = currentBetsResult.rows;

    for (const order of pendingOrders) {
      // Calculate current LMSR price for the option this limit order is for
      const currentLmsrPrice = new Decimal(calculateLMSRPrice(market, currentBets, order.option_id, numOutcomes));
      const orderPriceLimit = new Decimal(order.price_limit);

      // If current LMSR price is at or below the limit order's price_limit
      if (currentLmsrPrice.lessThanOrEqualTo(orderPriceLimit)) {
        logger.info(`Attempting to fill limit order ${order.id} for market ${marketId}. Current price: ${currentLmsrPrice.toString()}, Limit: ${orderPriceLimit.toString()}`);

        // Simulate filling the order as a bet
        // This is a simplified execution. In a real system, this would involve
        // creating a new bet record, updating market totals, and potentially
        // handling partial fills or remaining order amounts.
        const simulatedBetAmount = new Decimal(order.amount); // For simplicity, assume full fill
        const platformFeeFromSimulatedBet = simulatedBetAmount.times(0.01);
        const netSimulatedBetAmount = simulatedBetAmount.minus(platformFeeFromSimulatedBet);

        // Allocate a portion of the platform fee to LP providers
        const lpFeeAllocationPercentage = new Decimal(process.env.LP_FEE_ALLOCATION_PERCENTAGE || '0.5'); // Default 50%
        const lpFeeAllocation = platformFeeFromSimulatedBet.times(lpFeeAllocationPercentage);
        const platformFeeRetained = platformFeeFromSimulatedBet.minus(lpFeeAllocation);

        // Insert a new bet for the filled limit order
        await client.query(`
          INSERT INTO bets (market_id, bettor_address, option_id, amount, execution_odds, transaction_signature, status, platform_fee_taken)
          VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7)
        `, [
          marketId,
          order.user_address,
          order.option_id,
          netSimulatedBetAmount.toString(),
          currentLmsrPrice.toString(), // The price at which it was filled
          `LIMIT_ORDER_FILL_${order.id}_${Date.now()}`,
          platformFeeFromSimulatedBet.toString() // Store total fee here
        ]);

        // Update market totals (similar to POST /api/bets)
        await client.query(`
          UPDATE markets 
          SET 
            total_volume = total_volume + $1,
            total_bets = total_bets + 1,
            platform_fees_collected = platform_fees_collected + $2,
            total_lp_fees_accrued = total_lp_fees_accrued + $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [netSimulatedBetAmount.toString(), platformFeeRetained.toString(), lpFeeAllocation.toString(), marketId]);

        // Update the limit order status
        await client.query(`
          UPDATE limit_orders
          SET status = 'filled',
              filled_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [order.id]);

        // Update cached outcome totals in market metadata (re-fetch current bets)
        const updatedCurrentBetsResult = await client.query(
          'SELECT option_id, amount FROM bets WHERE market_id = $1 AND status = \'confirmed\'',
          [marketId]
        );
        const updatedCurrentBets = updatedCurrentBetsResult.rows;
        const newOutcomeTotals = Array(numOutcomes).fill(0);
        updatedCurrentBets.forEach(b => {
          if (b.option_id < numOutcomes) {
            newOutcomeTotals[b.option_id] += parseFloat(b.amount || 0);
          }
        });
        await client.query(`
          UPDATE markets
          SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{cachedOutcomeTotals}', $1::jsonb)
          WHERE id = $2
        `, [JSON.stringify(newOutcomeTotals), marketId]);

        logger.info(`Limit order ${order.id} filled successfully for market ${marketId}.`);
      }
    }
  } catch (error) {
    logger.error(`Error checking and filling limit orders for market ${marketId}:`, error);
  } finally {
    // Do NOT release client here, it's managed by the caller transaction
  }
}

module.exports = { checkAndFillLimitOrders };
