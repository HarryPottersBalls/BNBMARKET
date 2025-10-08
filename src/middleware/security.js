const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

function securityMiddleware(app) {
    // Helmet for securing HTTP headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"]
            }
        },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    }));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many requests, please try again later'
    });
    app.use(limiter);

    // Prevent MongoDB Injection
    app.use(mongoSanitize());

    // Prevent XSS attacks
    app.use(xss());

    // Custom security headers
    app.use((req, res, next) => {
        res.setHeader('X-Prediction-Market-Version', process.env.npm_package_version);
        res.setHeader('X-Security-Mode', process.env.NODE_ENV);
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
    });
}

module.exports = securityMiddleware;