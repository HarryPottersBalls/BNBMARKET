const crypto = require('crypto');

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational; // Operational errors are trusted errors that we can send to the client
    this.timestamp = new Date().toISOString();
    this.errorId = crypto.randomUUID(); // Unique error identifier

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      errorId: this.errorId,
      status: this.status,
      message: this.message,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV !== 'production' && { stack: this.stack })
    };
  }

  // Advanced error categorization
  static categorize(error) {
    const errorTypes = {
      'BadRequestError': 'validation',
      'UnauthorizedError': 'authentication',
      'ForbiddenError': 'authorization',
      'NotFoundError': 'not_found',
      'ConflictError': 'conflict'
    };

    return errorTypes[error.constructor.name] || 'unknown';
  }

  // Log error with context
  log(logger = console) {
    const context = {
      errorId: this.errorId,
      errorType: this.constructor.name,
      category: AppError.categorize(this),
      statusCode: this.statusCode
    };

    logger.error(this.message, context);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = {}) {
    super(message, 400);
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = {}) {
    super(message, 401);
    this.details = details;
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = {}) {
    super(message, 403);
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not Found', details = {}) {
    super(message, 404);
    this.details = details;
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', details = {}) {
    super(message, 409);
    this.details = details;
  }
}

// Domain-specific custom errors
class ValidationError extends BadRequestError {
  constructor(validationErrors) {
    super('Validation Failed', { validationErrors });
  }
}

class DatabaseError extends AppError {
  constructor(message, details = {}) {
    super(message, 500);
    this.details = details;
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  DatabaseError
};
