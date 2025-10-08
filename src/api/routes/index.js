const express = require('express');
const marketRoutes = require('./market-routes');
const userRoutes = require('./user-routes');
const adminRoutes = require('./admin-routes');

function setupRoutes(app) {
    const router = express.Router();

    // Mount routes with prefixes
    router.use('/markets', marketRoutes);
    router.use('/users', userRoutes);
    router.use('/admin', adminRoutes);

    // Add router to app
    app.use('/api', router);

    // 404 handler
    app.use((req, res, next) => {
        const error = new Error(`Not Found - ${req.originalUrl}`);
        error.status = 404;
        next(error);
    });
}

module.exports = setupRoutes;