/**
 * Error handling middleware unit tests
 *
 * Tests for error response formatting, error handling, and response utilities
 *
 * @author meetabl Team
 */

// Mock logger
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
  auditLog: jest.fn(),
  business: jest.fn(),
  security: jest.fn(),
  performance: jest.fn()
};

jest.mock('../../../src/config/logger', () => mockLogger);

// Import the error handling utilities
const {
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
} = require('../../../src/utils/error-response');

describe('Error Handling Middleware', () => {
  let req, res, next;
  let originalEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save original environment
    originalEnv = process.env.NODE_ENV;
    
    // Setup mock request, response, and next function
    req = {
      path: '/api/test',
      method: 'GET',
      ip: '192.168.1.1',
      get: jest.fn(),
      user: {
        id: 'user-123',
        email: 'test@example.com'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();

    // Setup default header responses
    req.get.mockImplementation((header) => {
      const headers = {
        'User-Agent': 'Jest Test Runner',
        'Content-Type': 'application/json'
      };
      return headers[header];
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  describe('ApiError class', () => {
    test('should create ApiError with default values', () => {
      const error = new ApiError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.errorCode).toBeNull();
      expect(error.details).toBeNull();
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
    });

    test('should create ApiError with custom values', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new ApiError('Validation failed', 400, 'VALIDATION_ERROR', details);
      
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });
  });

  describe('ErrorTypes', () => {
    test('should have all expected error types', () => {
      expect(ErrorTypes).toHaveProperty('VALIDATION_ERROR');
      expect(ErrorTypes).toHaveProperty('AUTHENTICATION_ERROR');
      expect(ErrorTypes).toHaveProperty('AUTHORIZATION_ERROR');
      expect(ErrorTypes).toHaveProperty('NOT_FOUND');
      expect(ErrorTypes).toHaveProperty('CONFLICT');
      expect(ErrorTypes).toHaveProperty('RATE_LIMIT');
      expect(ErrorTypes).toHaveProperty('INTERNAL_ERROR');
      expect(ErrorTypes).toHaveProperty('DATABASE_ERROR');
      expect(ErrorTypes).toHaveProperty('EXTERNAL_SERVICE_ERROR');
    });

    test('should have correct status codes', () => {
      expect(ErrorTypes.VALIDATION_ERROR.statusCode).toBe(400);
      expect(ErrorTypes.AUTHENTICATION_ERROR.statusCode).toBe(401);
      expect(ErrorTypes.AUTHORIZATION_ERROR.statusCode).toBe(403);
      expect(ErrorTypes.NOT_FOUND.statusCode).toBe(404);
      expect(ErrorTypes.CONFLICT.statusCode).toBe(409);
      expect(ErrorTypes.RATE_LIMIT.statusCode).toBe(429);
      expect(ErrorTypes.INTERNAL_ERROR.statusCode).toBe(500);
      expect(ErrorTypes.DATABASE_ERROR.statusCode).toBe(500);
      expect(ErrorTypes.EXTERNAL_SERVICE_ERROR.statusCode).toBe(502);
    });
  });

  describe('createError', () => {
    test('should create error from error type', () => {
      const error = createError('VALIDATION_ERROR');
      
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
    });

    test('should create error with custom message', () => {
      const error = createError('NOT_FOUND', 'User not found');
      
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
    });

    test('should create error with details', () => {
      const details = [{ field: 'email', message: 'Required' }];
      const error = createError('VALIDATION_ERROR', 'Validation failed', details);
      
      expect(error.details).toEqual(details);
    });

    test('should throw error for unknown error type', () => {
      expect(() => createError('UNKNOWN_TYPE')).toThrow('Unknown error type: UNKNOWN_TYPE');
    });
  });

  describe('formatErrorResponse', () => {
    test('should format basic error response', () => {
      const error = new ApiError('Test error', 400, 'TEST_ERROR');
      const response = formatErrorResponse(error, req);
      
      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('message', 'Test error');
      expect(response).toHaveProperty('errorCode', 'TEST_ERROR');
      expect(response).toHaveProperty('errorId');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('path', '/api/test');
      expect(response.errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
    });

    test('should include validation errors in response', () => {
      const details = [
        { field: 'email', message: 'Required' },
        { field: 'password', message: 'Too short' }
      ];
      const error = new ApiError('Validation failed', 400, 'VALIDATION_ERROR', details);
      const response = formatErrorResponse(error, req);
      
      expect(response).toHaveProperty('errors', details);
    });

    test('should include details object in response', () => {
      const details = { reason: 'insufficient permissions' };
      const error = new ApiError('Access denied', 403, 'AUTHORIZATION_ERROR', details);
      const response = formatErrorResponse(error, req);
      
      expect(response).toHaveProperty('details', details);
    });

    test('should include stack trace in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      const response = formatErrorResponse(error, req);
      
      expect(response).toHaveProperty('stack');
      expect(response.stack).toContain('Test error');
    });

    test('should not include stack trace in production mode', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');
      const response = formatErrorResponse(error, req);
      
      expect(response).not.toHaveProperty('stack');
    });

    test('should log error with request context', () => {
      const error = new ApiError('Test error', 400, 'TEST_ERROR');
      formatErrorResponse(error, req);
      
      expect(mockLogger.error).toHaveBeenCalledWith('API Error', expect.objectContaining({
        errorCode: 'TEST_ERROR',
        message: 'Test error',
        statusCode: 400,
        path: '/api/test',
        method: 'GET',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'Jest Test Runner'
      }));
    });

    test('should handle missing request object', () => {
      const error = new ApiError('Test error', 400, 'TEST_ERROR');
      const response = formatErrorResponse(error, null);
      
      expect(response).toHaveProperty('path', null);
      expect(mockLogger.error).toHaveBeenCalledWith('API Error', expect.objectContaining({
        path: undefined,
        method: undefined,
        userId: undefined,
        ip: undefined
      }));
    });
  });

  describe('errorHandler middleware', () => {
    test('should handle ApiError instances', () => {
      const error = new ApiError('Test error', 400, 'TEST_ERROR');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Test error',
        errorCode: 'TEST_ERROR'
      }));
    });

    test('should handle ValidationError', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.errors = {
        email: { path: 'email', message: 'Required', value: null },
        password: { path: 'password', message: 'Too short', value: '123' }
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        errorCode: 'VALIDATION_ERROR',
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'email', message: 'Required' }),
          expect.objectContaining({ field: 'password', message: 'Too short' })
        ])
      }));
    });

    test('should handle CastError', () => {
      const error = new Error('Cast to ObjectId failed');
      error.name = 'CastError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid data format'
      }));
    });

    test('should handle SequelizeUniqueConstraintError', () => {
      const error = new Error('Unique constraint violation');
      error.name = 'SequelizeUniqueConstraintError';
      error.errors = [{ path: 'email' }];
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        errorCode: 'CONFLICT',
        message: 'email already exists'
      }));
    });

    test('should handle SequelizeForeignKeyConstraintError', () => {
      const error = new Error('Foreign key constraint violation');
      error.name = 'SequelizeForeignKeyConstraintError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid reference'
      }));
    });

    test('should handle SequelizeConnectionError', () => {
      const error = new Error('Connection failed');
      error.name = 'SequelizeConnectionError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        errorCode: 'DATABASE_ERROR',
        message: 'Database connection failed'
      }));
    });

    test('should handle JsonWebTokenError', () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        errorCode: 'AUTHENTICATION_ERROR',
        message: 'Invalid token'
      }));
    });

    test('should handle TokenExpiredError', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        errorCode: 'AUTHENTICATION_ERROR',
        message: 'Token expired'
      }));
    });

    test('should handle Express errors with status codes', () => {
      const error = new Error('Express error');
      error.status = 422;
      error.statusCode = 422;
      error.code = 'UNPROCESSABLE_ENTITY';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Express error',
        errorCode: 'UNPROCESSABLE_ENTITY'
      }));
    });

    test('should handle unknown errors in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Unknown error');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        errorCode: 'INTERNAL_ERROR',
        message: 'Unknown error'
      }));
    });

    test('should handle unknown errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Sensitive error details');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        errorCode: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }));
    });
  });

  describe('asyncHandler', () => {
    test('should handle async function that resolves', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(mockFn);
      
      await wrappedFn(req, res, next);
      
      expect(mockFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle async function that rejects', async () => {
      const error = new Error('Async error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(mockFn);
      
      await wrappedFn(req, res, next);
      
      expect(mockFn).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });

    test('should wrap function properly', () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(mockFn);
      
      expect(typeof wrappedFn).toBe('function');
      expect(wrappedFn.length).toBe(3); // Should accept req, res, next
    });
  });

  describe('Error helper functions', () => {
    describe('validationError', () => {
      test('should create validation error with array of errors', () => {
        const errors = [
          { field: 'email', message: 'Required' },
          { field: 'password', message: 'Too short' }
        ];
        const error = validationError(errors);
        
        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(400);
        expect(error.errorCode).toBe('VALIDATION_ERROR');
        expect(error.details).toEqual(errors);
      });

      test('should create validation error with single error', () => {
        const errorDetail = { field: 'email', message: 'Required' };
        const error = validationError(errorDetail);
        
        expect(error.details).toEqual([errorDetail]);
      });
    });

    describe('notFoundError', () => {
      test('should create not found error with default message', () => {
        const error = notFoundError();
        
        expect(error.statusCode).toBe(404);
        expect(error.errorCode).toBe('NOT_FOUND');
        expect(error.message).toBe('Resource not found');
      });

      test('should create not found error with custom resource', () => {
        const error = notFoundError('User');
        
        expect(error.message).toBe('User not found');
      });
    });

    describe('unauthorizedError', () => {
      test('should create unauthorized error with default message', () => {
        const error = unauthorizedError();
        
        expect(error.statusCode).toBe(401);
        expect(error.errorCode).toBe('AUTHENTICATION_ERROR');
        expect(error.message).toBe('Authentication required');
      });

      test('should create unauthorized error with custom message', () => {
        const error = unauthorizedError('Invalid credentials');
        
        expect(error.message).toBe('Invalid credentials');
      });
    });

    describe('forbiddenError', () => {
      test('should create forbidden error with default message', () => {
        const error = forbiddenError();
        
        expect(error.statusCode).toBe(403);
        expect(error.errorCode).toBe('AUTHORIZATION_ERROR');
        expect(error.message).toBe('Access denied');
      });

      test('should create forbidden error with custom message', () => {
        const error = forbiddenError('Insufficient permissions');
        
        expect(error.message).toBe('Insufficient permissions');
      });
    });

    describe('conflictError', () => {
      test('should create conflict error with default message', () => {
        const error = conflictError();
        
        expect(error.statusCode).toBe(409);
        expect(error.errorCode).toBe('CONFLICT');
        expect(error.message).toBe('Resource conflict');
      });

      test('should create conflict error with custom message', () => {
        const error = conflictError('Email already exists');
        
        expect(error.message).toBe('Email already exists');
      });
    });
  });

  describe('Response helper functions', () => {
    describe('successResponse', () => {
      test('should create success response with default values', () => {
        successResponse(res);
        
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: 'Success',
          timestamp: expect.any(String)
        }));
      });

      test('should create success response with data', () => {
        const data = { id: 1, name: 'Test' };
        successResponse(res, data, 'Resource created', 201);
        
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: 'Resource created',
          data,
          timestamp: expect.any(String)
        }));
      });

      test('should create success response without data when data is null', () => {
        successResponse(res, null, 'Operation completed');
        
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: 'Operation completed',
          timestamp: expect.any(String)
        }));
        
        const call = res.json.mock.calls[0][0];
        expect(call).not.toHaveProperty('data');
      });
    });

    describe('paginatedResponse', () => {
      test('should create paginated response', () => {
        const data = [{ id: 1 }, { id: 2 }];
        const pagination = { page: 1, limit: 10, total: 25 };
        
        paginatedResponse(res, data, pagination, 'Users retrieved');
        
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: 'Users retrieved',
          data,
          pagination: {
            page: 1,
            limit: 10,
            total: 25,
            pages: 3,
            hasNext: true,
            hasPrev: false
          },
          timestamp: expect.any(String)
        }));
      });

      test('should calculate pagination correctly for last page', () => {
        const data = [{ id: 21 }, { id: 22 }];
        const pagination = { page: 3, limit: 10, total: 22 };
        
        paginatedResponse(res, data, pagination);
        
        const call = res.json.mock.calls[0][0];
        expect(call.pagination).toEqual({
          page: 3,
          limit: 10,
          total: 22,
          pages: 3,
          hasNext: false,
          hasPrev: true
        });
      });

      test('should handle single page correctly', () => {
        const data = [{ id: 1 }];
        const pagination = { page: 1, limit: 10, total: 1 };
        
        paginatedResponse(res, data, pagination);
        
        const call = res.json.mock.calls[0][0];
        expect(call.pagination).toEqual({
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
          hasNext: false,
          hasPrev: false
        });
      });
    });
  });
});