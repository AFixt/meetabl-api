/**
 * Standardized Error Response Utility
 * 
 * Provides consistent error response formatting across the API
 */

const logger = require('../config/logger');

/**
 * Standard error response structure
 */
class ApiError extends Error {
  constructor(message, statusCode = 500, errorCode = null, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Distinguish from programming errors
  }
}

/**
 * Common error types with predefined status codes and messages
 */
const ErrorTypes = {
  VALIDATION_ERROR: {
    statusCode: 400,
    errorCode: 'VALIDATION_ERROR',
    message: 'Validation failed'
  },
  AUTHENTICATION_ERROR: {
    statusCode: 401,
    errorCode: 'AUTHENTICATION_ERROR',
    message: 'Authentication required'
  },
  AUTHORIZATION_ERROR: {
    statusCode: 403,
    errorCode: 'AUTHORIZATION_ERROR',
    message: 'Access denied'
  },
  NOT_FOUND: {
    statusCode: 404,
    errorCode: 'NOT_FOUND',
    message: 'Resource not found'
  },
  CONFLICT: {
    statusCode: 409,
    errorCode: 'CONFLICT',
    message: 'Resource conflict'
  },
  RATE_LIMIT: {
    statusCode: 429,
    errorCode: 'RATE_LIMIT',
    message: 'Rate limit exceeded'
  },
  INTERNAL_ERROR: {
    statusCode: 500,
    errorCode: 'INTERNAL_ERROR',
    message: 'Internal server error'
  },
  DATABASE_ERROR: {
    statusCode: 500,
    errorCode: 'DATABASE_ERROR',
    message: 'Database operation failed'
  },
  EXTERNAL_SERVICE_ERROR: {
    statusCode: 502,
    errorCode: 'EXTERNAL_SERVICE_ERROR',
    message: 'External service unavailable'
  }
};

/**
 * Create standardized error responses
 */
const createError = (type, customMessage = null, details = null) => {
  const errorType = ErrorTypes[type];
  if (!errorType) {
    throw new Error(`Unknown error type: ${type}`);
  }
  
  return new ApiError(
    customMessage || errorType.message,
    errorType.statusCode,
    errorType.errorCode,
    details
  );
};

/**
 * Format error response for API
 */
const formatErrorResponse = (error, req = null) => {
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Base response structure
  const response = {
    success: false,
    message: error.message || 'An error occurred',
    errorCode: error.errorCode || 'UNKNOWN_ERROR',
    errorId,
    timestamp: error.timestamp || new Date().toISOString(),
    path: req?.path || null
  };

  // Add validation details if available
  if (error.details && Array.isArray(error.details)) {
    response.errors = error.details;
  } else if (error.details) {
    response.details = error.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  // Log error for monitoring
  logger.error('API Error', {
    errorId,
    errorCode: error.errorCode,
    message: error.message,
    statusCode: error.statusCode,
    path: req?.path,
    method: req?.method,
    userId: req?.user?.id,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    stack: error.stack
  });

  return response;
};

/**
 * Express error handling middleware
 */
const errorHandler = (error, req, res, next) => {
  // Handle different error types
  let apiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error.name === 'ValidationError') {
    // Mongoose/Sequelize validation errors
    const details = Object.values(error.errors || {}).map(err => ({
      field: err.path || err.field,
      message: err.message,
      value: err.value
    }));
    apiError = createError('VALIDATION_ERROR', 'Validation failed', details);
  } else if (error.name === 'CastError') {
    // Database cast errors (invalid ID format, etc.)
    apiError = createError('VALIDATION_ERROR', 'Invalid data format');
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    // Database unique constraint violations
    const field = error.errors?.[0]?.path || 'field';
    apiError = createError('CONFLICT', `${field} already exists`);
  } else if (error.name === 'SequelizeForeignKeyConstraintError') {
    // Foreign key constraint violations
    apiError = createError('VALIDATION_ERROR', 'Invalid reference');
  } else if (error.name === 'SequelizeConnectionError') {
    // Database connection errors
    apiError = createError('DATABASE_ERROR', 'Database connection failed');
  } else if (error.name === 'JsonWebTokenError') {
    // JWT errors
    apiError = createError('AUTHENTICATION_ERROR', 'Invalid token');
  } else if (error.name === 'TokenExpiredError') {
    // JWT expiration
    apiError = createError('AUTHENTICATION_ERROR', 'Token expired');
  } else if (error.status || error.statusCode) {
    // Express errors with status codes
    apiError = new ApiError(
      error.message,
      error.status || error.statusCode,
      error.code || error.errorCode,
      error.details
    );
  } else {
    // Unknown errors
    apiError = createError('INTERNAL_ERROR', 
      process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    );
  }

  // Format and send response
  const errorResponse = formatErrorResponse(apiError, req);
  res.status(apiError.statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error helper
 */
const validationError = (errors) => {
  const details = Array.isArray(errors) ? errors : [errors];
  return createError('VALIDATION_ERROR', 'Validation failed', details);
};

/**
 * Not found error helper
 */
const notFoundError = (resource = 'Resource') => {
  return createError('NOT_FOUND', `${resource} not found`);
};

/**
 * Unauthorized error helper
 */
const unauthorizedError = (message = 'Authentication required') => {
  return createError('AUTHENTICATION_ERROR', message);
};

/**
 * Forbidden error helper
 */
const forbiddenError = (message = 'Access denied') => {
  return createError('AUTHORIZATION_ERROR', message);
};

/**
 * Conflict error helper
 */
const conflictError = (message = 'Resource conflict') => {
  return createError('CONFLICT', message);
};

/**
 * Success response helper
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Paginated response helper
 */
const paginatedResponse = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1
    },
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  ApiError,
  ErrorTypes,
  createError,
  formatErrorResponse,
  errorHandler,
  asyncHandler,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  conflictError,
  successResponse,
  paginatedResponse
};