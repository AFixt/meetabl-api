/**
 * Authentication middleware tests
 *
 * Using the improved test setup for consistent mocking
 *
 * @author meetabl Team
 */

// Mock dependencies before imports
jest.mock('../../../src/config/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));
jest.mock('../../../src/models', () => ({
  User: {
    findOne: jest.fn()
  },
  JwtBlacklist: {
    findOne: jest.fn()
  }
}));

// Load the test setup - this will mock jsonwebtoken
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');
setupControllerMocks();

// Set JWT_SECRET for tests
process.env.JWT_SECRET = 'test-secret';

// Import middleware after mocks are set up
const { authenticateJWT } = require('../../../src/middlewares/auth');
const jwt = require('jsonwebtoken');

// Ensure createMockRequest, createMockResponse, createMockNext are available
if (typeof global.createMockRequest !== 'function'
    || typeof global.createMockResponse !== 'function'
    || typeof global.createMockNext !== 'function') {
  // Define them if they're not available in the global scope
  global.createMockRequest = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    user: { id: 'test-user-id' },
    ...overrides
  });

  global.createMockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  };

  global.createMockNext = () => jest.fn();
}

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test('should authenticate valid JWT token', async () => {
    // The jwt mock from test-helper will return { userId: 'test-user-id' } for any non-'expired' or 'invalid' token

    const models = require('../../../src/models');
    models.User.findOne.mockResolvedValue({
      id: 'test-user-id',
      name: 'Test User',
      status: 'active'
    });
    
    // JwtBlacklist might not be mocked by setupControllerMocks
    if (models.JwtBlacklist && models.JwtBlacklist.findOne) {
      models.JwtBlacklist.findOne.mockResolvedValue(null);
    }

    // Create mock request, response and next
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer valid-token'
      }
    });
    const res = createMockResponse();
    const next = createMockNext();

    // Call middleware
    await authenticateJWT(req, res, next);

    // Verify next was called (successful authentication)
    expect(next).toHaveBeenCalled();

    // Verify user was attached to request
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('test-user-id');
  });

  test('should reject missing token', async () => {
    // Create mock request with no auth header
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    // Call middleware
    await authenticateJWT(req, res, next);

    // Verify next was not called
    expect(next).not.toHaveBeenCalled();

    // Verify error response
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'unauthorized',
        message: 'Authentication failed'
      }
    });
  });

  test('should reject invalid token format', async () => {
    // Create mock request with invalid auth format
    const req = createMockRequest({
      headers: {
        authorization: 'InvalidFormat'
      }
    });
    const res = createMockResponse();
    const next = createMockNext();

    // Call middleware
    await authenticateJWT(req, res, next);

    // Verify next was not called
    expect(next).not.toHaveBeenCalled();

    // Verify error response
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'unauthorized',
        message: 'Authentication failed'
      }
    });
  });

  test('should reject invalid token', async () => {
    // Mock jwt.verify to throw an error
    jwt.verify.mockImplementationOnce(() => {
      throw new jwt.JsonWebTokenError('invalid signature');
    });

    // Create mock request with invalid token
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer invalid-token'
      }
    });
    const res = createMockResponse();
    const next = createMockNext();

    // Call middleware
    await authenticateJWT(req, res, next);

    // Verify next was not called
    expect(next).not.toHaveBeenCalled();

    // Verify error response
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
  });

  test('should reject expired token', async () => {
    // Mock jwt.verify to throw an expired token error
    jwt.verify.mockImplementationOnce(() => {
      throw new jwt.TokenExpiredError('Token expired');
    });

    // Create mock request with expired token
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer expired-token'
      }
    });
    const res = createMockResponse();
    const next = createMockNext();

    // Call middleware
    await authenticateJWT(req, res, next);

    // Verify next was not called
    expect(next).not.toHaveBeenCalled();

    // Verify error response
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'unauthorized',
        message: 'Authentication failed'
      }
    });
  });

  test('should reject if user not found', async () => {
    // Mock jwt.verify to return a valid token
    jwt.verify.mockReturnValueOnce({ userId: 'test-user-id' });
    
    // Mock User.findOne to return null
    const { User } = require('../../../src/models');
    User.findOne.mockResolvedValueOnce(null);

    // Create mock request
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer valid-token-no-user'
      }
    });
    const res = createMockResponse();
    const next = createMockNext();

    // Call middleware
    await authenticateJWT(req, res, next);

    // Verify next was not called
    expect(next).not.toHaveBeenCalled();

    // Verify error response
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'unauthorized',
        message: 'Authentication failed'
      }
    });
  });
});
