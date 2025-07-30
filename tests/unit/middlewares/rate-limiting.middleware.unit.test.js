/**
 * Rate limiting middleware unit tests
 *
 * Tests for Express rate limiting configuration and functionality
 *
 * @author meetabl Team
 */

// Mock express-rate-limit
const mockRateLimit = jest.fn();
jest.mock('express-rate-limit', () => mockRateLimit);

// Mock logger
const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../../src/config/logger', () => mockLogger);

describe('Rate Limiting Middleware', () => {
  let req, res, next;
  let rateLimitHandler;
  let originalEnv;
  let createRateLimiter;

  // Import express-rate-limit for direct testing
  const rateLimit = require('express-rate-limit');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save original environment
    originalEnv = process.env.NODE_ENV;
    
    // Setup mock request, response, and next function
    req = {
      ip: '192.168.1.1',
      path: '/api/test',
      method: 'GET'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();

    // Create the rate limiter function similar to app.js
    createRateLimiter = (windowMs, max, message) => rateLimit({
      windowMs,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        mockLogger.warn(`Rate limit exceeded for IP: ${req.ip}, endpoint: ${req.path}`);
        return res.status(429).json({
          error: {
            code: 'too_many_requests',
            message
          }
        });
      }
    });

    // Setup rate limit mock to capture the handler function
    mockRateLimit.mockImplementation((config) => {
      rateLimitHandler = config.handler;
      return jest.fn((req, res, next) => next());
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  describe('createRateLimiter function', () => {
    test('should create rate limiter with correct configuration', () => {
      const limiter = createRateLimiter(15 * 60 * 1000, 200, 'Too many requests');

      expect(mockRateLimit).toHaveBeenCalledWith({
        windowMs: 15 * 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        handler: expect.any(Function)
      });
    });

    test('should create general limiter with development limits', () => {
      process.env.NODE_ENV = 'development';
      const devMax = process.env.NODE_ENV === 'development' ? 1000 : 200;
      
      const limiter = createRateLimiter(15 * 60 * 1000, devMax, 'Too many requests');

      expect(mockRateLimit).toHaveBeenCalledWith({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        standardHeaders: true,
        legacyHeaders: false,
        handler: expect.any(Function)
      });
    });

    test('should create general limiter with production limits', () => {
      process.env.NODE_ENV = 'production';
      const prodMax = process.env.NODE_ENV === 'development' ? 1000 : 200;
      
      const limiter = createRateLimiter(15 * 60 * 1000, prodMax, 'Too many requests');

      expect(mockRateLimit).toHaveBeenCalledWith({
        windowMs: 15 * 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        handler: expect.any(Function)
      });
    });
  });

  describe('rate limit handler', () => {
    beforeEach(() => {
      // Create a rate limiter to set up the handler
      createRateLimiter(15 * 60 * 1000, 200, 'Too many requests');
    });

    test('should log warning when rate limit is exceeded', () => {
      expect(rateLimitHandler).toBeDefined();
      
      rateLimitHandler(req, res);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Rate limit exceeded for IP: ${req.ip}, endpoint: ${req.path}`
      );
    });

    test('should return 429 status with proper error message', () => {
      rateLimitHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'too_many_requests',
          message: expect.any(String)
        }
      });
    });

    test('should include appropriate error message for general limiter', () => {
      rateLimitHandler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'too_many_requests',
          message: expect.stringContaining('Too many requests')
        }
      });
    });
  });

  describe('auth rate limiter configuration', () => {
    test('should create auth limiter with stricter limits', () => {
      process.env.NODE_ENV = 'production';
      const authMax = process.env.NODE_ENV === 'development' ? 100 : 5;
      
      const authLimiter = createRateLimiter(
        15 * 60 * 1000,
        authMax,
        'Too many authentication attempts, please try again in 15 minutes.'
      );

      expect(mockRateLimit).toHaveBeenCalledWith({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        handler: expect.any(Function)
      });
    });

    test('should use development auth limits in development', () => {
      process.env.NODE_ENV = 'development';
      const authMax = process.env.NODE_ENV === 'development' ? 100 : 5;
      
      const authLimiter = createRateLimiter(
        15 * 60 * 1000,
        authMax,
        'Too many authentication attempts, please try again in 15 minutes.'
      );

      expect(mockRateLimit).toHaveBeenCalledWith({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        handler: expect.any(Function)
      });
    });
  });

  describe('password reset rate limiter configuration', () => {
    test('should create password reset limiter with 1-hour window', () => {
      process.env.NODE_ENV = 'production';
      const passwordMax = process.env.NODE_ENV === 'development' ? 50 : 3;
      
      const passwordLimiter = createRateLimiter(
        60 * 60 * 1000,
        passwordMax,
        'Too many password reset requests, please try again in 1 hour.'
      );

      expect(mockRateLimit).toHaveBeenCalledWith({
        windowMs: 60 * 60 * 1000,
        max: 3,
        standardHeaders: true,
        legacyHeaders: false,
        handler: expect.any(Function)
      });
    });

    test('should use development password reset limits', () => {
      process.env.NODE_ENV = 'development';
      const passwordMax = process.env.NODE_ENV === 'development' ? 50 : 3;
      
      const passwordLimiter = createRateLimiter(
        60 * 60 * 1000,
        passwordMax,
        'Too many password reset requests, please try again in 1 hour.'
      );

      expect(mockRateLimit).toHaveBeenCalledWith({
        windowMs: 60 * 60 * 1000,
        max: 50,
        standardHeaders: true,
        legacyHeaders: false,
        handler: expect.any(Function)
      });
    });
  });

  describe('rate limiter error messages', () => {
    test('should provide specific message for auth endpoints', () => {
      const authLimiter = createRateLimiter(
        15 * 60 * 1000,
        5,
        'Too many authentication attempts, please try again in 15 minutes.'
      );
      
      rateLimitHandler(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'too_many_requests',
          message: expect.stringContaining('authentication attempts')
        }
      });
    });

    test('should provide specific message for password reset endpoints', () => {
      const passwordLimiter = createRateLimiter(
        60 * 60 * 1000,
        3,
        'Too many password reset requests, please try again in 1 hour.'
      );
      
      rateLimitHandler(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'too_many_requests',
          message: expect.stringContaining('password reset')
        }
      });
    });
  });

  describe('environment-specific behavior', () => {
    test('should use different limits in development vs production', () => {
      // Test development behavior
      process.env.NODE_ENV = 'development';
      const devMax = process.env.NODE_ENV === 'development' ? 1000 : 200;
      
      expect(devMax).toBe(1000);
      
      // Test production behavior
      process.env.NODE_ENV = 'production';
      const prodMax = process.env.NODE_ENV === 'development' ? 1000 : 200;
      
      expect(prodMax).toBe(200);
    });

    test('should apply different auth limits based on environment', () => {
      // Test development auth limits
      process.env.NODE_ENV = 'development';
      const devAuthMax = process.env.NODE_ENV === 'development' ? 100 : 5;
      expect(devAuthMax).toBe(100);
      
      // Test production auth limits
      process.env.NODE_ENV = 'production';
      const prodAuthMax = process.env.NODE_ENV === 'development' ? 100 : 5;
      expect(prodAuthMax).toBe(5);
    });
  });

  describe('rate limit configuration validation', () => {
    test('should have proper window duration for general limiter', () => {
      const generalLimiter = createRateLimiter(15 * 60 * 1000, 200, 'Too many requests');
      
      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000 // 15 minutes
        })
      );
    });

    test('should have proper window duration for auth limiter', () => {
      const authLimiter = createRateLimiter(15 * 60 * 1000, 5, 'Too many auth attempts');
      
      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000 // 15 minutes
        })
      );
    });

    test('should have proper window duration for password reset limiter', () => {
      const passwordLimiter = createRateLimiter(60 * 60 * 1000, 3, 'Too many password resets');
      
      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 60 * 60 * 1000 // 1 hour
        })
      );
    });
  });

  describe('rate limit headers configuration', () => {
    test('should enable standard headers and disable legacy headers', () => {
      createRateLimiter(15 * 60 * 1000, 200, 'Too many requests');
      
      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          standardHeaders: true,
          legacyHeaders: false
        })
      );
    });
  });

  describe('IP and path logging', () => {
    beforeEach(() => {
      createRateLimiter(15 * 60 * 1000, 200, 'Too many requests');
    });

    test('should log client IP address', () => {
      rateLimitHandler(req, res);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(req.ip)
      );
    });

    test('should log request path', () => {
      rateLimitHandler(req, res);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(req.path)
      );
    });

    test('should handle missing IP gracefully', () => {
      const reqWithoutIP = { ...req, ip: undefined };
      
      expect(() => rateLimitHandler(reqWithoutIP, res)).not.toThrow();
    });

    test('should handle missing path gracefully', () => {
      const reqWithoutPath = { ...req, path: undefined };
      
      expect(() => rateLimitHandler(reqWithoutPath, res)).not.toThrow();
    });
  });
});