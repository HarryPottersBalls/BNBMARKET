const winston = require('winston');
const { format } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

function createLogger(component) {
  const transports = [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${component}] ${level}: ${message} `;
          const metaStr = Object.keys(metadata).length 
            ? JSON.stringify(metadata) 
            : '';
          return msg + metaStr;
        })
      )
    }),
    
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),

    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d'
    })
  ];

  const logger = winston.createLogger({
    level: 'info',
    format: format.combine(
      format.errors({ stack: true }),
      format.metadata()
    ),
    defaultMeta: { component },
    transports
  });

  logger.critical = (message, meta = {}) => {
    logger.error({
      message,
      ...meta,
      severity: 'CRITICAL'
    });
  };

  return logger;
}

module.exports = { createLogger };
