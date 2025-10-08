const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create a logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'bnbmarket-backend' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          return `${timestamp} ${level}: ${message}${stack ? `\n${stack}` : ''}`;
        })
      )
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File transport for combined logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add request logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();

  // Log the request
  logger.info(`Incoming Request`, {
    method: req.method,
    path: req.path,
    body: req.body && JSON.stringify(req.body),
    query: req.query,
    ip: req.ip
  });

  // Capture the original end function
  const originalEnd = res.end;

  // Override the end function to log response
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;

    logger.info(`Request Completed`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });

    // Call the original end function
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

// Performance tracking utility
function trackPerformance(operationName) {
  const start = process.hrtime();

  return {
    end: () => {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = (seconds * 1000) + (nanoseconds / 1_000_000);

      logger.info(`Performance: ${operationName}`, {
        duration: `${duration.toFixed(2)}ms`
      });

      return duration;
    }
  };
}

module.exports = {
  logger,
  requestLogger,
  trackPerformance
};