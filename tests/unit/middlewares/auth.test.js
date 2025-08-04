/**
 * Auth middleware tests
 *
 * @author meetabl Team
 */

// Set JWT_SECRET before imports
process.env.JWT_SECRET = 'test-secret';

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));

const { authenticateJWT } = require('../../../src/middlewares/auth');
// Mock models and JWT
jest.mock('../../../src/models', () => ({
  User: {
    findOne: jest.fn().mockImplementation(({ where }) => {
      // For the valid user test
      if (where && where.id === 'test-user-id') {
        return Promise.resolve({ id: 'test-user-id', name: 'Test User', status: 'active' });
      }
      // For the non-existent user test
      return Promise.resolve(null);
    })
  },
  JwtBlacklist: {
    findOne: jest.fn().mockResolvedValue(null)
  }
}));

jest.mock('jsonwebtoken', () => {
  // Create error classes that JWT uses
  class TokenExpiredError extends Error {
    constructor(message) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  }

  class JsonWebTokenError extends Error {
    constructor(message) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  }

  return {
    verify: jest.fn().mockImplementation((token) => {
      if (token === 'valid-token') {
        return { userId: 'test-user-id' };
      }
      if (token.includes('invalid_signature')) {
        throw new JsonWebTokenError('invalid signature');
      }
      return { userId: token.split('.')[0] };
    }),
    TokenExpiredError,
    JsonWebTokenError
  };
});
const { mockRequest, mockResponse } = require('../../fixtures/mocks');

describe('Auth Middleware', () => {
  let user;
  let token;

  // No need for database setup with fully mocked tests
  beforeEach(() => {
    user = { id: 'test-user-id', name: 'Test User' };
    token = 'valid-token';
  });

  test('should authenticate valid JWT token', async () => {
    const req = mockRequest({
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const res = mockResponse();
    const next = jest.fn();

    await authenticateJWT(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(user.id);
  });

  test('should reject missing token', async () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    await authenticateJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.error).toBeDefined();
    expect(responseData.error.code).toBe('unauthorized');
  });

  test('should reject invalid token format', async () => {
    const req = mockRequest({
      headers: {
        authorization: 'InvalidFormat'
      }
    });
    const res = mockResponse();
    const next = jest.fn();

    await authenticateJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
  });

  test('should reject invalid token', async () => {
    // Create invalid token
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE1MTYyMzkwMjJ9.invalid_signature';

    const req = mockRequest({
      headers: {
        authorization: `Bearer ${invalidToken}`
      }
    });
    const res = mockResponse();
    const next = jest.fn();

    await authenticateJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
  });

  test('should reject if user not found', async () => {
    // Non-existent user token
    const nonExistentToken = 'non-existent-id.jwt.token';

    const req = mockRequest({
      headers: {
        authorization: `Bearer ${nonExistentToken}`
      }
    });
    const res = mockResponse();
    const next = jest.fn();

    await authenticateJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
  });
});
