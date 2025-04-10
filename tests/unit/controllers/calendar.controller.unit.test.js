/**
 * Calendar controller unit tests
 *
 * Using the improved test setup for consistent mocking
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup controller mocks
setupControllerMocks();

// Import controller after mocks are set up
const {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getMicrosoftAuthUrl,
  handleMicrosoftCallback,
  disconnectCalendar,
  getCalendarStatus
} = require('../../../src/controllers/calendar.controller');

describe('Calendar Controller', () => {
  // Shared test data
  const userId = 'test-user-id';
  
  describe('getGoogleAuthUrl', () => {
    test('should generate Google authorization URL', async () => {
      // Create mock request and response
      const req = createMockRequest({ user: { id: userId } });
      const res = createMockResponse();
      
      // Call controller
      await getGoogleAuthUrl(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Verify response data
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.authUrl).toBeDefined();
      expect(responseData.authUrl).toContain('https://accounts.google.com/o/oauth2/auth');
    });
    
    test('should handle errors', async () => {
      // Create mock request and response
      const req = createMockRequest({ user: { id: userId } });
      const res = createMockResponse();
      
      // Mock the google.auth.OAuth2 implementation to throw an error
      const { google } = require('googleapis');
      const originalImpl = google.auth.OAuth2;
      google.auth.OAuth2 = jest.fn().mockImplementation(() => {
        throw new Error('Google API error');
      });
      
      // Call controller
      await getGoogleAuthUrl(req, res);
      
      // Restore original implementation
      google.auth.OAuth2 = originalImpl;
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
      
      // Verify error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('internal_server_error');
    });
  });
  
  describe('handleGoogleCallback', () => {
    test('should process successful Google OAuth callback', async () => {
      // Mock query parameters
      const code = 'google-auth-code';
      
      // Create mock request and response
      const req = createMockRequest({
        query: { code, state: userId }
      });
      const res = createMockResponse();
      
      // Mock User.findOne
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        calendar_provider: 'none',
        save: jest.fn().mockResolvedValue(true)
      };
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce(mockUser);
      
      // Mock CalendarToken operations
      const { CalendarToken } = require('../../../src/models');
      CalendarToken.findOne.mockResolvedValueOnce(null); // No existing token
      CalendarToken.create.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'google',
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token'
      });
      
      // Mock AuditLog
      const { AuditLog } = require('../../../src/models');
      AuditLog.create.mockResolvedValueOnce({
        id: 'audit-log-id'
      });
      
      // Mock sequelize transaction
      const { sequelize } = require('../../../src/config/database');
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(true),
        rollback: jest.fn().mockResolvedValue(true)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);
      
      // Call controller
      await handleGoogleCallback(req, res);
      
      // Check response (should be a redirect)
      expect(res.redirect).toHaveBeenCalled();
      
      // Verify transaction was committed
      expect(mockTransaction.commit).toHaveBeenCalled();
      
      // Verify token was created
      expect(CalendarToken.create).toHaveBeenCalled();
    });
    
    test('should handle missing code parameter', async () => {
      // Create mock request and response with missing code
      const req = createMockRequest({
        query: { state: userId }
      });
      const res = createMockResponse();
      
      // Call controller
      await handleGoogleCallback(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });
    
    test('should handle missing state parameter', async () => {
      // Create mock request and response with missing state
      const req = createMockRequest({
        query: { code: 'google-auth-code' }
      });
      const res = createMockResponse();
      
      // Call controller
      await handleGoogleCallback(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });
    
    test('should handle user not found', async () => {
      // Mock query parameters
      const code = 'google-auth-code';
      
      // Create mock request and response
      const req = createMockRequest({
        query: { code, state: 'unknown-user-id' }
      });
      const res = createMockResponse();
      
      // Mock User.findOne to return null
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce(null);
      
      // Mock sequelize transaction
      const { sequelize } = require('../../../src/config/database');
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(true),
        rollback: jest.fn().mockResolvedValue(true)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);
      
      // Call controller
      await handleGoogleCallback(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
    });
  });
  
  describe('getMicrosoftAuthUrl', () => {
    test('should generate Microsoft authorization URL', async () => {
      // Create mock request and response
      const req = createMockRequest({ user: { id: userId } });
      const res = createMockResponse();
      
      // Call controller
      await getMicrosoftAuthUrl(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Verify response data
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.authUrl).toBeDefined();
    });
  });
  
  describe('handleMicrosoftCallback', () => {
    test('should process successful Microsoft OAuth callback', async () => {
      // Mock query parameters
      const code = 'microsoft-auth-code';
      
      // Create mock request and response
      const req = createMockRequest({
        query: { code, state: userId }
      });
      const res = createMockResponse();
      
      // Mock User.findOne
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        calendar_provider: 'none',
        save: jest.fn().mockResolvedValue(true)
      };
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce(mockUser);
      
      // Mock request for token
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'microsoft-access-token',
          refresh_token: 'microsoft-refresh-token',
          expires_in: 3600
        })
      });
      
      // Mock CalendarToken operations
      const { CalendarToken } = require('../../../src/models');
      CalendarToken.findOne.mockResolvedValueOnce(null); // No existing token
      CalendarToken.create.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'microsoft',
        access_token: 'microsoft-access-token',
        refresh_token: 'microsoft-refresh-token'
      });
      
      // Mock AuditLog
      const { AuditLog } = require('../../../src/models');
      AuditLog.create.mockResolvedValueOnce({
        id: 'audit-log-id'
      });
      
      // Mock sequelize transaction
      const { sequelize } = require('../../../src/config/database');
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(true),
        rollback: jest.fn().mockResolvedValue(true)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);
      
      // Call controller
      await handleMicrosoftCallback(req, res);
      
      // Check response (should be a redirect)
      expect(res.redirect).toHaveBeenCalled();
      
      // Verify transaction was committed
      expect(mockTransaction.commit).toHaveBeenCalled();
      
      // Verify token was created
      expect(CalendarToken.create).toHaveBeenCalled();
    });
  });
  
  describe('disconnectCalendar', () => {
    test('should disconnect calendar integration', async () => {
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        params: { provider: 'google' }
      });
      const res = createMockResponse();
      
      // Mock User.findOne
      const mockUser = {
        id: userId,
        calendar_provider: 'google',
        save: jest.fn().mockResolvedValue(true)
      };
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce(mockUser);
      
      // Mock CalendarToken operations
      const mockToken = {
        destroy: jest.fn().mockResolvedValue(true)
      };
      const { CalendarToken } = require('../../../src/models');
      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      
      // Mock AuditLog
      const { AuditLog } = require('../../../src/models');
      AuditLog.create.mockResolvedValueOnce({
        id: 'audit-log-id'
      });
      
      // Mock sequelize transaction
      const { sequelize } = require('../../../src/config/database');
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(true),
        rollback: jest.fn().mockResolvedValue(true)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);
      
      // Call controller
      await disconnectCalendar(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Verify token was deleted
      expect(mockToken.destroy).toHaveBeenCalled();
    });
    
    test('should handle non-existent connection', async () => {
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        params: { provider: 'google' }
      });
      const res = createMockResponse();
      
      // Mock User.findOne
      const mockUser = {
        id: userId,
        calendar_provider: 'none',
        save: jest.fn().mockResolvedValue(true)
      };
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce(mockUser);
      
      // Mock CalendarToken.findOne to return null
      const { CalendarToken } = require('../../../src/models');
      CalendarToken.findOne.mockResolvedValueOnce(null);
      
      // Mock sequelize transaction
      const { sequelize } = require('../../../src/config/database');
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(true),
        rollback: jest.fn().mockResolvedValue(true)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);
      
      // Call controller
      await disconnectCalendar(req, res);
      
      // Check response (status 200 because we're saying it was successfully removed, even though it didn't exist)
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });
  });
  
  describe('getCalendarStatus', () => {
    test('should get calendar connection status', async () => {
      // Create mock request and response
      const req = createMockRequest({ user: { id: userId } });
      const res = createMockResponse();
      
      // Mock User.findOne
      const mockUser = {
        id: userId,
        calendar_provider: 'google'
      };
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce(mockUser);
      
      // Mock CalendarToken.findAll
      const mockTokens = [
        {
          provider: 'google',
          created_at: new Date(),
          expires_at: new Date(Date.now() + 3600000)
        }
      ];
      const { CalendarToken } = require('../../../src/models');
      CalendarToken.findAll.mockResolvedValueOnce(mockTokens);
      
      // Call controller
      await getCalendarStatus(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });
    
    test('should handle no connections', async () => {
      // Create mock request and response
      const req = createMockRequest({ user: { id: userId } });
      const res = createMockResponse();
      
      // Mock User.findOne
      const mockUser = {
        id: userId,
        calendar_provider: 'none'
      };
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce(mockUser);
      
      // Mock CalendarToken.findAll to return empty array
      const { CalendarToken } = require('../../../src/models');
      CalendarToken.findAll.mockResolvedValueOnce([]);
      
      // Call controller
      await getCalendarStatus(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });
  });
});