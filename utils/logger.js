const winston = require('winston');
const path = require('path');
const crypto = require('crypto');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

class ExtendedLogger {
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: logFormat,
      defaultMeta: { service: 'bnbmarket-backend' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...metadata }) => {
              let msg = `${timestamp} ${level}: ${message}`;
              if (Object.keys(metadata).length > 0) {
                msg += ` ${JSON.stringify(metadata)}`;
              }
              return msg;
            })
          )
        }),
        new winston.transports.File({
          filename: path.join(__dirname, '..', 'logs', 'server.log'),
          level: 'info',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: path.join(__dirname, '..', 'logs', 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(__dirname, '..', 'logs', 'exceptions.log')
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(__dirname, '..', 'logs', 'rejections.log')
        })
      ]
    });

    // Additional console logging for non-production
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  // Enhanced logging methods with context
  log(level, message, context = {}) {
    const logContext = {
      ...context,
      requestId: context.requestId || crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    this.logger.log(level, message, logContext);
  }

  info(message, context = {}) {
    this.log('info', message, context);
  }

  warn(message, context = {}) {
    this.log('warn', message, context);
  }

  error(message, context = {}) {
    this.log('error', message, {
      ...context,
      stack: context.stack || new Error().stack
    });
  }

  debug(message, context = {}) {
    this.log('debug', message, context);
  }

  // Performance tracking method
  trackPerformance(operationName) {
    const start = process.hrtime();
    return {
      end: () => {
        const [seconds, nanoseconds] = process.hrtime(start);
        const durationMs = (seconds * 1000) + (nanoseconds / 1_000_000);

        this.info(`Performance: ${operationName}`, {
          duration: `${durationMs.toFixed(2)}ms`
        });

        return durationMs;
      }
    };
  }

  // Middleware for request logging
  requestLogger() {
    return (req, res, next) => {
      const requestId = crypto.randomUUID();
      req.requestId = requestId;

      // Log incoming request
      this.info('Incoming Request', {
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Capture original end function
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        // Log completed request
        this.logger.info('Request Completed', {
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode
        });

        // Call original end
        originalEnd.call(this, chunk, encoding);
      }.bind(this);

      next();
    };
  }
}

module.exports = new ExtendedLogger();
