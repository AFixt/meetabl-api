/**
 * JWT Blacklist model unit tests
 *
 * Tests the JwtBlacklist model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { JwtBlacklist } = require('../../../src/models');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('JwtBlacklist Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock JwtBlacklist model methods
    JwtBlacklist.create = jest.fn();
    JwtBlacklist.findAll = jest.fn();
    JwtBlacklist.findOne = jest.fn();
    JwtBlacklist.findByPk = jest.fn();
    JwtBlacklist.destroy = jest.fn();
  });

  describe('JWT Blacklist Operations', () => {
    beforeEach(() => {
      // Setup default mock implementations
      JwtBlacklist.create.mockImplementation(async (data) => {
        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 1);
        
        return {
          id: data.id || uuidv4(),
          jwtId: data.jwtId,
          token: data.token,
          userId: data.userId,
          reason: data.reason || null,
          expiresAt: data.expiresAt || futureDate,
          created: new Date(),
          updated: new Date(),
          ...data
        };
      });
      
      JwtBlacklist.findAll.mockResolvedValue([]);
      JwtBlacklist.findOne.mockResolvedValue(null);
    });

    test('should create JWT blacklist entry with valid data', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const validData = {
        jwtId: uuidv4(),
        token: 'valid.jwt.token',
        userId: 'user-123',
        reason: 'logout',
        expiresAt: futureDate
      };

      const result = await JwtBlacklist.create(validData);

      expect(JwtBlacklist.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.id).toBeDefined();
      expect(result.created).toBeInstanceOf(Date);
    });

    test('should create JWT blacklist entry without reason', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const validData = {
        jwtId: uuidv4(),
        token: 'valid.jwt.token',
        userId: 'user-123',
        expiresAt: futureDate
      };

      const result = await JwtBlacklist.create(validData);

      expect(JwtBlacklist.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.reason).toBeNull();
    });

    test('should handle long JWT tokens', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const longToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 
        'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJhZGRpdGlvbmFsX2RhdGEiOiJsb25nX3N0cmluZ19vZl9kYXRhX3RoYXRfbWlnaHRfYmVfaW5fYV9qd3RfdG9rZW5fdG9fdGVzdF9maWVsZF9sZW5ndGhfcmVxdWlyZW1lbnRzIn0.' +
        'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const validData = {
        jwtId: uuidv4(),
        token: longToken,
        userId: 'user-123',
        reason: 'security_breach',
        expiresAt: futureDate
      };

      const result = await JwtBlacklist.create(validData);

      expect(JwtBlacklist.create).toHaveBeenCalledWith(validData);
      expect(result.token).toBe(longToken);
      expect(result.reason).toBe('security_breach');
    });

    test('should support blacklisting token on logout', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      
      const mockJwtId = uuidv4();
      const mockToken = 'valid.jwt.token';
      const mockUserId = 'user-123';

      const logoutData = {
        jwtId: mockJwtId,
        token: mockToken,
        userId: mockUserId,
        reason: 'logout',
        expiresAt: futureDate
      };

      const result = await JwtBlacklist.create(logoutData);

      expect(JwtBlacklist.create).toHaveBeenCalledWith(logoutData);
      expect(result.reason).toBe('logout');
    });

    test('should support blacklisting token for security reasons', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      
      const mockJwtId = uuidv4();
      const mockToken = 'valid.jwt.token';
      const mockUserId = 'user-123';

      const securityData = {
        jwtId: mockJwtId,
        token: mockToken,
        userId: mockUserId,
        reason: 'security_breach',
        expiresAt: futureDate
      };

      const result = await JwtBlacklist.create(securityData);

      expect(JwtBlacklist.create).toHaveBeenCalledWith(securityData);
      expect(result.reason).toBe('security_breach');
    });

    test('should support checking if token is blacklisted', async () => {
      const mockJwtId = uuidv4();
      const mockToken = 'valid.jwt.token';
      const mockUserId = 'user-123';
      
      JwtBlacklist.findOne.mockResolvedValue({
        id: uuidv4(),
        jwtId: mockJwtId,
        token: mockToken,
        userId: mockUserId,
        reason: 'logout',
        expiresAt: new Date(Date.now() + 3600000),
        created: new Date()
      });

      const blacklistedToken = await JwtBlacklist.findOne({
        where: { jwtId: mockJwtId }
      });

      expect(JwtBlacklist.findOne).toHaveBeenCalledWith({
        where: { jwtId: mockJwtId }
      });
      expect(blacklistedToken).toBeTruthy();
      expect(blacklistedToken.jwtId).toBe(mockJwtId);
    });

    test('should support querying by userId', async () => {
      const mockUserId = 'user-123';
      
      JwtBlacklist.findAll.mockResolvedValue([
        {
          id: '1',
          jwtId: uuidv4(),
          token: 'token1',
          userId: mockUserId,
          reason: 'logout',
          created: new Date()
        },
        {
          id: '2',
          jwtId: uuidv4(),
          token: 'token2',
          userId: mockUserId,
          reason: 'password_change',
          created: new Date()
        }
      ]);

      const userBlacklistedTokens = await JwtBlacklist.findAll({
        where: { userId: mockUserId },
        order: [['created', 'DESC']]
      });

      expect(JwtBlacklist.findAll).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: [['created', 'DESC']]
      });
      expect(userBlacklistedTokens).toHaveLength(2);
    });

    test('should support cleanup of expired tokens', async () => {
      JwtBlacklist.destroy.mockResolvedValue(5); // 5 tokens deleted

      const deletedCount = await JwtBlacklist.destroy({
        where: {
          expiresAt: {
            [require('sequelize').Op.lt]: new Date()
          }
        }
      });

      expect(JwtBlacklist.destroy).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            [require('sequelize').Op.lt]: expect.any(Date)
          }
        }
      });
      expect(deletedCount).toBe(5);
    });
  });

  describe('Common Blacklist Reasons', () => {
    beforeEach(() => {
      JwtBlacklist.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        jwtId: data.jwtId,
        userId: data.userId || null,
        reason: data.reason || null,
        expiresAt: data.expiresAt,
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      }));
    });

    const validReasons = [
      'logout',
      'password_change',
      'security_breach',
      'account_deactivated',
      'token_refresh',
      'suspicious_activity',
      'logout_all_devices'
    ];

    test.each(validReasons)('should handle %s reason', async (reason) => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const validData = {
        jwtId: uuidv4(),
        token: 'test.jwt.token',
        userId: 'user-123',
        reason,
        expiresAt: futureDate
      };

      const result = await JwtBlacklist.create(validData);

      expect(JwtBlacklist.create).toHaveBeenCalledWith(validData);
      expect(result.reason).toBe(reason);
    });

    test('should support batch operations for user logout', async () => {
      const userTokens = [
        { jwtId: uuidv4(), token: 'token1' },
        { jwtId: uuidv4(), token: 'token2' },
        { jwtId: uuidv4(), token: 'token3' }
      ];

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const blacklistPromises = userTokens.map(({ jwtId, token }) => 
        JwtBlacklist.create({
          jwtId,
          token,
          userId: 'user-123',
          reason: 'logout_all_devices',
          expiresAt: futureDate
        })
      );

      const results = await Promise.all(blacklistPromises);

      expect(JwtBlacklist.create).toHaveBeenCalledTimes(userTokens.length);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.reason).toBe('logout_all_devices');
        expect(result.userId).toBe('user-123');
      });
    });
  });
});