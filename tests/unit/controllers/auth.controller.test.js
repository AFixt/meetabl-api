/**
 * Auth controller tests
 * 
 * @author AccessMeet Team
 */

// Mock models and database
jest.mock('../../../src/models', () => {
  const { User, UserSettings, AuditLog } = require('../../fixtures/db');
  return { User, UserSettings, AuditLog };
});

// Mock config
jest.mock('../../../src/config/database', () => ({
  sequelize: {
    transaction: jest.fn().mockImplementation(() => ({
      commit: jest.fn().mockResolvedValue(null),
      rollback: jest.fn().mockResolvedValue(null)
    }))
  }
}));

const { register, login, refreshToken } = require('../../../src/controllers/auth.controller');
const { mockRequest, mockResponse, generateAuthToken } = require('../../fixtures/mocks');
const { createTestUser, setupTestDatabase, clearDatabase } = require('../../fixtures/db');
const jwt = require('jsonwebtoken');

describe('Auth Controller', () => {
  // Setup and teardown
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('should register a new user successfully', async () => {
      const req = mockRequest({
        body: {
          name: 'New User',
          email: 'newuser@example.com',
          password: 'Password123!',
          timezone: 'America/New_York'
        }
      });
      const res = mockResponse();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.id).toBeDefined();
      expect(responseData.name).toBe('New User');
      expect(responseData.email).toBe('newuser@example.com');
      expect(responseData.token).toBeDefined();
    });
  });

  describe('login', () => {
    test('should login user successfully with correct credentials', async () => {
      // Create test user
      const user = await createTestUser();
      
      const req = mockRequest({
        body: {
          email: user.email,
          password: user.rawPassword
        }
      });
      const res = mockResponse();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.id).toBeDefined();
      expect(responseData.email).toBeDefined();
      expect(responseData.token).toBeDefined();
      expect(responseData.refreshToken).toBeDefined();
    });
  });

  describe('refreshToken', () => {
    test('should refresh token successfully with valid refresh token', async () => {
      // Create test user
      const user = await createTestUser();
      
      // Generate refresh token
      const oldRefreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      const req = mockRequest({
        body: {
          refreshToken: oldRefreshToken
        }
      });
      const res = mockResponse();

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.token).toBeDefined();
      expect(responseData.refreshToken).toBeDefined();
    });

    test('should return error with invalid refresh token', async () => {
      const req = mockRequest({
        body: {
          refreshToken: 'invalid-token'
        }
      });
      const res = mockResponse();

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('unauthorized');
    });
  });
});