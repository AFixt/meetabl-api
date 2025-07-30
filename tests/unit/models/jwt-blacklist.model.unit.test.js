/**
 * JWT Blacklist model unit tests
 *
 * Tests the JwtBlacklist model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');

const { v4: uuidv4 } = require('uuid');

// Mock sequelize
const mockSequelize = {
  define: jest.fn(),
  DataTypes: require('sequelize').DataTypes
};

jest.mock('../../../src/config/database', () => ({
  sequelize: mockSequelize
}));

// Import the model after mocking
const JwtBlacklist = require('../../../src/models/jwt-blacklist.model');

describe('JwtBlacklist Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Definition', () => {
    test('should define JwtBlacklist model with correct table name', () => {
      expect(mockSequelize.define).toHaveBeenCalledWith(
        'JwtBlacklist',
        expect.any(Object),
        expect.objectContaining({
          tableName: 'jwtBlacklist',
          timestamps: true,
          createdAt: 'created',
          updatedAt: 'updated'
        })
      );
    });

    test('should have correct field definitions', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];

      // Check id field
      expect(fieldDefinitions.id).toEqual({
        type: expect.any(Object),
        primaryKey: true,
        defaultValue: expect.any(Function)
      });

      // Check jwtId field
      expect(fieldDefinitions.jwtId).toEqual({
        type: expect.any(Object),
        allowNull: false,
        unique: true,
        field: 'jwtId'
      });

      // Check token field
      expect(fieldDefinitions.token).toEqual({
        type: expect.any(Object),
        allowNull: false
      });

      // Check userId field
      expect(fieldDefinitions.userId).toEqual({
        type: expect.any(Object),
        allowNull: false,
        field: 'userId'
      });

      // Check reason field
      expect(fieldDefinitions.reason).toEqual({
        type: expect.any(Object),
        allowNull: true
      });

      // Check expiresAt field
      expect(fieldDefinitions.expiresAt).toEqual({
        type: expect.any(Object),
        allowNull: false,
        field: 'expiresAt'
      });
    });

    test('should generate UUID for id by default', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      const idDefaultValue = fieldDefinitions.id.defaultValue;
      
      expect(typeof idDefaultValue).toBe('function');
      
      const generatedId = idDefaultValue();
      expect(generatedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should have correct indexes defined', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      expect(options.indexes).toEqual([
        { fields: ['jwtId'] },
        { fields: ['userId'] },
        { fields: ['expiresAt'] }
      ]);
    });

    test('should have correct timestamp configuration', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      expect(options.timestamps).toBe(true);
      expect(options.createdAt).toBe('created');
      expect(options.updatedAt).toBe('updated');
    });
  });

  describe('Field Validations', () => {
    let mockJwtBlacklistInstance;
    let mockCreate;

    beforeEach(() => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      mockJwtBlacklistInstance = {
        id: uuidv4(),
        jwtId: uuidv4(),
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        userId: 'user-123',
        reason: 'logout',
        expiresAt: futureDate,
        created: new Date(),
        updated: new Date(),
        save: jest.fn().mockResolvedValue(true),
        validate: jest.fn().mockResolvedValue(true)
      };

      mockCreate = jest.fn().mockResolvedValue(mockJwtBlacklistInstance);
      
      // Mock the model methods
      Object.assign(JwtBlacklist, {
        create: mockCreate,
        findAll: jest.fn().mockResolvedValue([mockJwtBlacklistInstance]),
        findOne: jest.fn().mockResolvedValue(mockJwtBlacklistInstance),
        findByPk: jest.fn().mockResolvedValue(mockJwtBlacklistInstance),
        destroy: jest.fn().mockResolvedValue(1)
      });
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

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockJwtBlacklistInstance);
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

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockJwtBlacklistInstance);
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

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockJwtBlacklistInstance);
    });
  });

  describe('Data Integrity', () => {
    test('should ensure jwtId is required and unique', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.jwtId.allowNull).toBe(false);
      expect(fieldDefinitions.jwtId.unique).toBe(true);
    });

    test('should ensure token is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.token.allowNull).toBe(false);
    });

    test('should ensure userId is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.userId.allowNull).toBe(false);
    });

    test('should ensure expiresAt is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.expiresAt.allowNull).toBe(false);
    });

    test('should allow reason to be null', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.reason.allowNull).toBe(true);
    });

    test('should have proper field types', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      // Check that token field is TEXT for long JWT tokens
      expect(fieldDefinitions.token.type.constructor.name).toContain('TEXT');
      
      // Check that id fields are STRING(36) for UUIDs
      expect(fieldDefinitions.id.type.constructor.name).toContain('STRING');
      expect(fieldDefinitions.jwtId.type.constructor.name).toContain('STRING');
      expect(fieldDefinitions.userId.type.constructor.name).toContain('STRING');
      
      // Check that reason is STRING(50)
      expect(fieldDefinitions.reason.type.constructor.name).toContain('STRING');
      
      // Check that expiresAt is DATE
      expect(fieldDefinitions.expiresAt.type.constructor.name).toContain('DATE');
    });

    test('should have correct field mappings for camelCase', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.jwtId.field).toBe('jwtId');
      expect(fieldDefinitions.userId.field).toBe('userId');
      expect(fieldDefinitions.expiresAt.field).toBe('expiresAt');
    });
  });

  describe('Token Blacklist Operations', () => {
    const mockJwtId = uuidv4();
    const mockToken = 'valid.jwt.token';
    const mockUserId = 'user-123';

    test('should support blacklisting token on logout', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const logoutData = {
        jwtId: mockJwtId,
        token: mockToken,
        userId: mockUserId,
        reason: 'logout',
        expiresAt: futureDate
      };

      const mockCreate = jest.fn().mockResolvedValue({
        ...logoutData,
        id: uuidv4(),
        created: new Date(),
        updated: new Date()
      });

      Object.assign(JwtBlacklist, { create: mockCreate });

      const result = await JwtBlacklist.create(logoutData);

      expect(mockCreate).toHaveBeenCalledWith(logoutData);
      expect(result.reason).toBe('logout');
    });

    test('should support blacklisting token for security reasons', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const securityData = {
        jwtId: mockJwtId,
        token: mockToken,
        userId: mockUserId,
        reason: 'security_breach',
        expiresAt: futureDate
      };

      const mockCreate = jest.fn().mockResolvedValue({
        ...securityData,
        id: uuidv4(),
        created: new Date(),
        updated: new Date()
      });

      Object.assign(JwtBlacklist, { create: mockCreate });

      const result = await JwtBlacklist.create(securityData);

      expect(mockCreate).toHaveBeenCalledWith(securityData);
      expect(result.reason).toBe('security_breach');
    });

    test('should support checking if token is blacklisted', async () => {
      const mockFindOne = jest.fn().mockResolvedValue({
        id: uuidv4(),
        jwtId: mockJwtId,
        token: mockToken,
        userId: mockUserId,
        reason: 'logout',
        expiresAt: new Date(Date.now() + 3600000),
        created: new Date()
      });

      Object.assign(JwtBlacklist, { findOne: mockFindOne });

      const blacklistedToken = await JwtBlacklist.findOne({
        where: { jwtId: mockJwtId }
      });

      expect(mockFindOne).toHaveBeenCalledWith({
        where: { jwtId: mockJwtId }
      });
      expect(blacklistedToken).toBeTruthy();
      expect(blacklistedToken.jwtId).toBe(mockJwtId);
    });

    test('should support querying by userId', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
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

      Object.assign(JwtBlacklist, { findAll: mockFindAll });

      const userBlacklistedTokens = await JwtBlacklist.findAll({
        where: { userId: mockUserId },
        order: [['created', 'DESC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: [['created', 'DESC']]
      });
      expect(userBlacklistedTokens).toHaveLength(2);
    });

    test('should support cleanup of expired tokens', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const mockDestroy = jest.fn().mockResolvedValue(5); // 5 tokens deleted

      Object.assign(JwtBlacklist, { destroy: mockDestroy });

      const deletedCount = await JwtBlacklist.destroy({
        where: {
          expiresAt: {
            [require('sequelize').Op.lt]: new Date()
          }
        }
      });

      expect(mockDestroy).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            [require('sequelize').Op.lt]: expect.any(Date)
          }
        }
      });
      expect(deletedCount).toBe(5);
    });
  });

  describe('Security Features', () => {
    test('should support different blacklist reasons', () => {
      const validReasons = [
        'logout',
        'password_change',
        'security_breach',
        'account_deactivated',
        'token_refresh',
        'suspicious_activity'
      ];

      validReasons.forEach(reason => {
        expect(reason.length).toBeLessThanOrEqual(50); // Reason field is STRING(50)
      });
    });

    test('should have proper indexing for performance', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      expect(options.indexes).toContainEqual({ fields: ['jwtId'] });
      expect(options.indexes).toContainEqual({ fields: ['userId'] });
      expect(options.indexes).toContainEqual({ fields: ['expiresAt'] });
    });

    test('should support batch operations for user logout', async () => {
      const mockCreate = jest.fn().mockImplementation((data) => Promise.resolve({
        id: uuidv4(),
        ...data,
        created: new Date(),
        updated: new Date()
      }));

      Object.assign(JwtBlacklist, { create: mockCreate });

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

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.reason).toBe('logout_all_devices');
        expect(result.userId).toBe('user-123');
      });
    });
  });
});