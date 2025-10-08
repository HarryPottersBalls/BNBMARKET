const logger = require('../../utils/logger');
const {
    calculateProbabilities,
    calculateMarketPrice,
    assessMarketRisk
} = require('../../domains/market/services/market-service');
const { NotFoundError, BadRequestError } = require('../../shared/utils/error-handler');

class MarketController {
    static async getProbabilities(req, res) {
        try {
            const { marketId } = req.params;
            const bets = await fetchMarketBets(marketId);

            const probabilities = await calculateProbabilities(bets);

            res.json({
                probabilities,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Market Probabilities Error', { error });
            throw new BadRequestError('Failed to calculate market probabilities');
        }
    }

    static async getMarketPrice(req, res) {
        try {
            const { marketId, optionId } = req.params;
            const bets = await fetchMarketBets(marketId);

            const price = await calculateMarketPrice(bets, optionId);

            res.json({
                price,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Market Price Error', { error });
            throw new BadRequestError('Failed to calculate market price');
        }
    }

    static async getMarketRisk(req, res) {
        try {
            const { marketId } = req.params;
            const bets = await fetchMarketBets(marketId);

            const riskProfile = await assessMarketRisk(bets);

            res.json({
                riskProfile,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Market Risk Error', { error });
            throw new BadRequestError('Failed to assess market risk');
        }
    }
}

module.exports = MarketController;