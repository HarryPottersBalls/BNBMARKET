const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super('Validation Failed', 400, true);
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Unhandled Error:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500
  });

  // Determine response details
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(statusCode).json({
      status,
      message: err.message,
      ...(err.details && { details: err.details })
    });
  }

  // Programming or unknown error: don't leak details
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong on our end'
  });
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  errorHandler
};