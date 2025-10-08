const express = require('express');
const MarketController = require('../controllers/market-controller');
const { asyncHandler } = require('../../middleware/async-handler');
const { validateMarket } = require('../../middleware/validation');

const router = express.Router();

router.get('/probabilities/:marketId',
    validateMarket,
    asyncHandler(MarketController.getProbabilities)
);

router.get('/price/:marketId/:optionId',
    validateMarket,
    asyncHandler(MarketController.getMarketPrice)
);

router.get('/risk/:marketId',
    validateMarket,
    asyncHandler(MarketController.getMarketRisk)
);

module.exports = router;