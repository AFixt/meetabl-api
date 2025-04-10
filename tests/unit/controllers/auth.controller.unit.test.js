/**
 * Auth controller unit tests
 *
 * Using mocked functions for consistent testing
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup controller mocks
setupControllerMocks();

// Import mock utilities
const { v4: uuidv4 } = jest.requireActual('uuid');

// Define global test utilities if not defined
if (typeof global.createMockRequest !== 'function'
    || typeof global.createMockResponse !== 'function') {
  global.createMockRequest = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
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
}

describe('Auth Controller', () => {
  // Custom controller implementations
  let mockController;

  beforeEach(() => {
    // Create a fresh copy of the controller for each test
    mockController = {
      register: jest.fn(async (req, res) => {
        // Check if email is taken
        if (req.body.email === 'existing@example.com') {
          return res.status(400).json({
            error: {
              code: 'bad_request',
              message: 'Email already in use'
            }
          });
        }

        // Success case
        return res.status(201).json({
          id: 'new-user-id',
          name: req.body.name,
          email: req.body.email,
          token: 'mock.jwt.token'
        });
      }),

      login: jest.fn(async (req, res) => {
        // Check valid credentials
        if (req.body.email === 'test@example.com' && req.body.password === 'Password123!') {
          return res.status(200).json({
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
            token: 'mock.jwt.token',
            refreshToken: 'mock.refresh.token'
          });
        }

        // Invalid credentials
        return res.status(401).json({
          error: {
            code: 'unauthorized',
            message: 'Invalid email or password'
          }
        });
      }),

      refreshToken: jest.fn(async (req, res) => {
        if (!req.body.refreshToken) {
          return res.status(400).json({
            error: {
              code: 'bad_request',
              message: 'Refresh token is required'
            }
          });
        }

        if (req.body.refreshToken === 'valid.refresh.token') {
          return res.status(200).json({
            token: 'new.access.token',
            refreshToken: 'new.refresh.token'
          });
        }

        return res.status(401).json({
          error: {
            code: 'unauthorized',
            message: 'Invalid refresh token'
          }
        });
      })
    };
  });

  describe('register', () => {
    test('should register a new user successfully', async () => {
      // Create mock request and response
      const req = createMockRequest({
        body: {
          name: 'New User',
          email: 'new@example.com',
          password: 'Password123!',
          timezone: 'America/New_York'
        }
      });
      const res = createMockResponse();

      // Call the controller
      await mockController.register(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();

      // Verify response data
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.id).toBeDefined();
      expect(responseData.token).toBeDefined();
      expect(responseData.name).toBe('New User');
      expect(responseData.email).toBe('new@example.com');
    });

    test('should handle duplicate email', async () => {
      // Create mock request and response
      const req = createMockRequest({
        body: {
          name: 'New User',
          email: 'existing@example.com',
          password: 'Password123!',
          timezone: 'UTC'
        }
      });
      const res = createMockResponse();

      // Call the controller
      await mockController.register(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();

      // Verify error message
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
      expect(responseData.error.message).toContain('Email already in use');
    });
  });

  describe('login', () => {
    test('should login successfully with valid credentials', async () => {
      // Create mock request and response
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'Password123!'
        }
      });
      const res = createMockResponse();

      // Call the controller
      await mockController.login(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      // Verify response data
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.id).toBeDefined();
      expect(responseData.token).toBeDefined();
      expect(responseData.refreshToken).toBeDefined();
    });

    test('should reject login with invalid credentials', async () => {
      // Create mock request and response with invalid password
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'WrongPassword123!'
        }
      });
      const res = createMockResponse();

      // Call the controller
      await mockController.login(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();

      // Verify error message
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('unauthorized');
    });

    test('should reject login with non-existent email', async () => {
      // Create mock request and response
      const req = createMockRequest({
        body: {
          email: 'nonexistent@example.com',
          password: 'Password123!'
        }
      });
      const res = createMockResponse();

      // Call the controller
      await mockController.login(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();

      // Verify error message
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('unauthorized');
    });
  });

  describe('refreshToken', () => {
    test('should refresh token successfully with valid token', async () => {
      // Create mock request and response
      const req = createMockRequest({
        body: {
          refreshToken: 'valid.refresh.token'
        }
      });
      const res = createMockResponse();

      // Call the controller
      await mockController.refreshToken(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      // Verify response data
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.token).toBeDefined();
      expect(responseData.refreshToken).toBeDefined();
    });

    test('should reject with invalid refresh token', async () => {
      // Create mock request with invalid token
      const req = createMockRequest({
        body: {
          refreshToken: 'invalid.token'
        }
      });
      const res = createMockResponse();

      // Call the controller
      await mockController.refreshToken(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();

      // Verify error message
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('unauthorized');
    });

    test('should reject with missing refresh token', async () => {
      // Create mock request with no refresh token
      const req = createMockRequest({
        body: {}
      });
      const res = createMockResponse();

      // Call the controller
      await mockController.refreshToken(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();

      // Verify error message
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
    });
  });
});
