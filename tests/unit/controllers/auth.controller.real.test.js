/**
 * Auth controller tests
 * 
 * Comprehensive tests for the auth controller functionality
 * 
 * @author AccessMeet Team
 */

// Import test setup
require('../test-setup');

// Import mock utilities
const { v4: uuidv4 } = jest.requireActual('uuid');

// Define global test utilities
if (typeof global.createMockRequest !== 'function' ||
    typeof global.createMockResponse !== 'function') {
  global.createMockRequest = (overrides = {}) => {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: { id: 'test-user-id' },
      ...overrides
    };
  };

  global.createMockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  };
}

// Mock dependencies
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockImplementation((token, secret) => {
    if (token === 'valid.refresh.token') {
      return { userId: 'test-user-id', type: 'refresh' };
    } else if (token === 'invalid.token') {
      throw new Error('Invalid token');
    } else if (token === 'expired.token') {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      throw error;
    }
    return { userId: token.split('.')[0] };
  }),
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor(message) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  },
  JsonWebTokenError: class JsonWebTokenError extends Error {
    constructor(message) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  }
}));

jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('mocksalt'),
  hash: jest.fn().mockResolvedValue('mockhash'),
  compare: jest.fn().mockImplementation((password, hash) => {
    // Simple validation checking if password is "correct_password"
    return Promise.resolve(password === 'correct_password');
  })
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../src/models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn()
  },
  UserSettings: {
    create: jest.fn()
  },
  AuditLog: {
    create: jest.fn()
  }
}));

jest.mock('../../../src/config/database', () => ({
  sequelize: {
    transaction: jest.fn().mockImplementation(() => ({
      commit: jest.fn().mockResolvedValue(null),
      rollback: jest.fn().mockResolvedValue(null)
    }))
  }
}));

// Now import the controller after mocking
const { register, login, refreshToken } = require('../../../src/controllers/auth.controller');
const { User, UserSettings, AuditLog } = require('../../../src/models');
const { sequelize } = require('../../../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../../../src/config/logger');

describe('Auth Controller', () => {
  describe('register', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    test('should register a new user successfully', async () => {
      // Mock required methods
      User.findOne.mockResolvedValueOnce(null); // No existing user
      User.create.mockResolvedValueOnce({
        id: 'new-user-id',
        name: 'John Doe',
        email: 'john@example.com',
        timezone: 'UTC'
      });
      UserSettings.create.mockResolvedValueOnce({ id: 'settings-id' });
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-log-id' });
      
      // Mock transaction
      const transaction = {
        commit: jest.fn().mockResolvedValueOnce(true),
        rollback: jest.fn()
      };
      sequelize.transaction.mockResolvedValueOnce(transaction);
      
      // Create request and response
      const req = createMockRequest({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password123!',
          timezone: 'America/New_York'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await register(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 'new-user-id',
        name: 'John Doe',
        email: 'john@example.com',
        token: 'mock.jwt.token'
      }));
      
      // Verify transaction was committed
      expect(transaction.commit).toHaveBeenCalled();
      expect(transaction.rollback).not.toHaveBeenCalled();
      
      // Verify log was created
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('User registered'));
    });
    
    test('should reject registration with existing email', async () => {
      // Mock an existing user
      User.findOne.mockResolvedValueOnce({
        id: 'existing-id',
        email: 'existing@example.com'
      });
      
      // Create request and response
      const req = createMockRequest({
        body: {
          name: 'John Doe',
          email: 'existing@example.com',
          password: 'Password123!'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await register(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'bad_request',
          message: expect.stringContaining('Email already in use')
        })
      }));
    });
    
    test('should handle database errors during registration', async () => {
      // Mock a database error
      User.findOne.mockResolvedValueOnce(null);
      User.create.mockRejectedValueOnce(new Error('Database error'));
      
      // Mock transaction
      const transaction = {
        commit: jest.fn(),
        rollback: jest.fn().mockResolvedValueOnce(true)
      };
      sequelize.transaction.mockResolvedValueOnce(transaction);
      
      // Create request and response
      const req = createMockRequest({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password123!'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await register(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'internal_server_error'
        })
      }));
      
      // Verify transaction was rolled back
      expect(transaction.rollback).toHaveBeenCalled();
      expect(transaction.commit).not.toHaveBeenCalled();
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });
    
    test('should log in user with valid credentials', async () => {
      // Mock user lookup
      User.findOne.mockResolvedValueOnce({
        id: 'user-id',
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: 'hashed_password',
        timezone: 'UTC'
      });
      
      // Mock password validation
      bcrypt.compare.mockResolvedValueOnce(true);
      
      // Mock token generation
      jwt.sign.mockReturnValueOnce('access.token');
      jwt.sign.mockReturnValueOnce('refresh.token');
      
      // Mock audit log
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-log-id' });
      
      // Create request and response
      const req = createMockRequest({
        body: {
          email: 'john@example.com',
          password: 'Password123!'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await login(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 'user-id',
        name: 'John Doe',
        email: 'john@example.com',
        token: expect.any(String),
        refreshToken: expect.any(String)
      }));
      
      // Verify audit log was created
      expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-id',
        action: 'user.login'
      }));
      
      // Verify log was created
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('User logged in'));
    });
    
    test('should reject login with non-existent email', async () => {
      // Mock user not found
      User.findOne.mockResolvedValueOnce(null);
      
      // Create request and response
      const req = createMockRequest({
        body: {
          email: 'nonexistent@example.com',
          password: 'Password123!'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await login(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'unauthorized',
          message: expect.stringContaining('Invalid email or password')
        })
      }));
    });
    
    test('should reject login with invalid password', async () => {
      // Mock user lookup
      User.findOne.mockResolvedValueOnce({
        id: 'user-id',
        email: 'john@example.com',
        password_hash: 'hashed_password'
      });
      
      // Mock password validation to fail
      bcrypt.compare.mockResolvedValueOnce(false);
      
      // Create request and response
      const req = createMockRequest({
        body: {
          email: 'john@example.com',
          password: 'WrongPassword123!'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await login(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'unauthorized',
          message: expect.stringContaining('Invalid email or password')
        })
      }));
    });
    
    test('should handle database errors during login', async () => {
      // Mock database error
      User.findOne.mockRejectedValueOnce(new Error('Database error'));
      
      // Create request and response
      const req = createMockRequest({
        body: {
          email: 'john@example.com',
          password: 'Password123!'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await login(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'internal_server_error'
        })
      }));
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('refreshToken', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });
    
    test('should refresh token with valid refresh token', async () => {
      // Mock JWT verification
      jwt.verify.mockReturnValueOnce({ userId: 'user-id', type: 'refresh' });
      
      // Mock user lookup
      User.findOne.mockResolvedValueOnce({
        id: 'user-id',
        name: 'John Doe',
        email: 'john@example.com'
      });
      
      // Mock token generation
      jwt.sign.mockReturnValueOnce('new.access.token');
      jwt.sign.mockReturnValueOnce('new.refresh.token');
      
      // Mock audit log
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-log-id' });
      
      // Create request and response
      const req = createMockRequest({
        body: {
          refreshToken: 'valid.refresh.token'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await refreshToken(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        token: expect.any(String),
        refreshToken: expect.any(String)
      }));
      
      // Verify audit log was created
      expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-id',
        action: 'user.token_refresh'
      }));
      
      // Verify log was created
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Token refreshed'));
    });
    
    test('should reject request without refresh token', async () => {
      // Create request and response
      const req = createMockRequest({
        body: {}
      });
      const res = createMockResponse();
      
      // Execute the controller
      await refreshToken(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'bad_request',
          message: expect.stringContaining('Refresh token is required')
        })
      }));
    });
    
    test('should reject request with invalid token type', async () => {
      // Mock JWT verification with wrong token type
      jwt.verify.mockReturnValueOnce({ userId: 'user-id', type: 'access' });
      
      // Create request and response
      const req = createMockRequest({
        body: {
          refreshToken: 'invalid.type.token'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await refreshToken(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'unauthorized',
          message: expect.stringContaining('Invalid refresh token')
        })
      }));
    });
    
    test('should reject request when user not found', async () => {
      // Mock JWT verification
      jwt.verify.mockReturnValueOnce({ userId: 'nonexistent-user', type: 'refresh' });
      
      // Mock user not found
      User.findOne.mockResolvedValueOnce(null);
      
      // Create request and response
      const req = createMockRequest({
        body: {
          refreshToken: 'valid.for.nonexistent.user'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await refreshToken(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'unauthorized',
          message: expect.stringContaining('User not found')
        })
      }));
    });
    
    test('should handle expired refresh token', async () => {
      // Mock JWT verification to throw TokenExpiredError
      const error = new jwt.TokenExpiredError('Token expired');
      jwt.verify.mockImplementationOnce(() => {
        throw error;
      });
      
      // Create request and response
      const req = createMockRequest({
        body: {
          refreshToken: 'expired.token'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await refreshToken(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'unauthorized',
          message: expect.stringContaining('Refresh token expired')
        })
      }));
    });
    
    test('should handle invalid JWT token format', async () => {
      // Mock JWT verification to throw JsonWebTokenError
      const error = new jwt.JsonWebTokenError('Invalid token');
      jwt.verify.mockImplementationOnce(() => {
        throw error;
      });
      
      // Create request and response
      const req = createMockRequest({
        body: {
          refreshToken: 'invalid.format.token'
        }
      });
      const res = createMockResponse();
      
      // Execute the controller
      await refreshToken(req, res);
      
      // Verify the response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'unauthorized',
          message: expect.stringContaining('Invalid refresh token')
        })
      }));
    });
  });
});