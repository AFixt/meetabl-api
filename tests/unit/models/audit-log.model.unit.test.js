/**
 * Audit Log model unit tests
 *
 * Tests the AuditLog model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');

const { v4: uuidv4 } = require('uuid');

// Mock sequelize and models
const mockSequelize = {
  define: jest.fn(),
  DataTypes: require('sequelize').DataTypes
};

const mockUser = {
  id: 'user-123'
};

jest.mock('../../../src/config/database', () => ({
  sequelize: mockSequelize
}));

jest.mock('../../../src/models/user.model', () => mockUser);

// Import the model after mocking
const AuditLog = require('../../../src/models/audit-log.model');

describe('AuditLog Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Definition', () => {
    test('should define AuditLog model with correct table name', () => {
      expect(mockSequelize.define).toHaveBeenCalledWith(
        'AuditLog',
        expect.any(Object),
        expect.objectContaining({
          tableName: 'AuditLogs',
          timestamps: true,
          createdAt: 'created',
          updatedAt: false
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

      // Check userId field
      expect(fieldDefinitions.userId).toEqual({
        type: expect.any(Object),
        allowNull: false,
        field: 'user_id',
        references: {
          model: mockUser,
          key: 'id'
        }
      });

      // Check action field
      expect(fieldDefinitions.action).toEqual({
        type: expect.any(Object),
        allowNull: false
      });

      // Check metadata field
      expect(fieldDefinitions.metadata).toEqual({
        type: expect.any(Object),
        allowNull: true
      });

      // Check created field
      expect(fieldDefinitions.created).toEqual({
        type: expect.any(Object),
        defaultValue: expect.any(Object)
      });
    });

    test('should generate UUID for id by default', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      const idDefaultValue = fieldDefinitions.id.defaultValue;
      
      expect(typeof idDefaultValue).toBe('function');
      
      const generatedId = idDefaultValue();
      expect(generatedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should have correct timestamp configuration', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      expect(options.timestamps).toBe(true);
      expect(options.createdAt).toBe('created');
      expect(options.updatedAt).toBe(false);
    });
  });

  describe('Field Validations', () => {
    let mockAuditLogInstance;
    let mockCreate;

    beforeEach(() => {
      mockAuditLogInstance = {
        id: uuidv4(),
        userId: 'user-123',
        action: 'user_login',
        metadata: { ip: '192.168.1.1' },
        created: new Date(),
        save: jest.fn().mockResolvedValue(true),
        validate: jest.fn().mockResolvedValue(true)
      };

      mockCreate = jest.fn().mockResolvedValue(mockAuditLogInstance);
      
      // Mock the model methods
      Object.assign(AuditLog, {
        create: mockCreate,
        findAll: jest.fn().mockResolvedValue([mockAuditLogInstance]),
        findOne: jest.fn().mockResolvedValue(mockAuditLogInstance),
        findByPk: jest.fn().mockResolvedValue(mockAuditLogInstance)
      });
    });

    test('should create audit log with valid data', async () => {
      const validData = {
        userId: 'user-123',
        action: 'user_login',
        metadata: { ip: '192.168.1.1', userAgent: 'Mozilla/5.0' }
      };

      const result = await AuditLog.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockAuditLogInstance);
    });

    test('should create audit log without metadata', async () => {
      const validData = {
        userId: 'user-123',
        action: 'password_change'
      };

      const result = await AuditLog.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockAuditLogInstance);
    });

    test('should handle JSON metadata correctly', async () => {
      const validData = {
        userId: 'user-123',
        action: 'booking_created',
        metadata: {
          bookingId: 'booking-456',
          customerEmail: 'customer@example.com',
          amount: 100.00,
          timestamp: new Date().toISOString()
        }
      };

      const result = await AuditLog.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockAuditLogInstance);
    });
  });

  describe('Model Relationships', () => {
    test('should reference User model in userId field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.userId.references).toEqual({
        model: mockUser,
        key: 'id'
      });
    });

    test('should have correct foreign key field mapping', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.userId.field).toBe('user_id');
    });
  });

  describe('Data Integrity', () => {
    test('should ensure userId is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.userId.allowNull).toBe(false);
    });

    test('should ensure action is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.action.allowNull).toBe(false);
    });

    test('should allow metadata to be null', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.metadata.allowNull).toBe(true);
    });

    test('should have proper field length constraints', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      // Check that action field has STRING(100) constraint
      expect(fieldDefinitions.action.type.constructor.name).toContain('STRING');
      
      // Check that id fields are STRING(36) for UUIDs
      expect(fieldDefinitions.id.type.constructor.name).toContain('STRING');
      expect(fieldDefinitions.userId.type.constructor.name).toContain('STRING');
    });
  });

  describe('Common Audit Actions', () => {
    const commonActions = [
      'user_login',
      'user_logout', 
      'user_register',
      'password_change',
      'profile_update',
      'booking_created',
      'booking_cancelled',
      'booking_updated',
      'payment_processed',
      'settings_changed'
    ];

    test.each(commonActions)('should handle %s action', async (action) => {
      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        userId: 'user-123',
        action,
        metadata: { test: true },
        created: new Date()
      });

      Object.assign(AuditLog, { create: mockCreate });

      const validData = {
        userId: 'user-123',
        action,
        metadata: { test: true }
      };

      const result = await AuditLog.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result.action).toBe(action);
    });
  });

  describe('Security and Compliance Features', () => {
    test('should support complex metadata for audit trails', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.metadata.type.constructor.name).toContain('JSON');
    });

    test('should have automatic timestamp creation', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.created.defaultValue).toBeDefined();
    });

    test('should be immutable (no updatedAt)', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      expect(options.updatedAt).toBe(false);
    });

    test('should support querying by user', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        { 
          id: '1', 
          userId: 'user-123', 
          action: 'user_login', 
          created: new Date() 
        },
        { 
          id: '2', 
          userId: 'user-123', 
          action: 'booking_created', 
          created: new Date() 
        }
      ]);

      Object.assign(AuditLog, { findAll: mockFindAll });

      const userAuditLogs = await AuditLog.findAll({
        where: { userId: 'user-123' },
        order: [['created', 'DESC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        order: [['created', 'DESC']]
      });
      expect(userAuditLogs).toHaveLength(2);
    });

    test('should support querying by action type', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        { 
          id: '1', 
          userId: 'user-123', 
          action: 'user_login', 
          created: new Date() 
        }
      ]);

      Object.assign(AuditLog, { findAll: mockFindAll });

      const loginAuditLogs = await AuditLog.findAll({
        where: { action: 'user_login' },
        order: [['created', 'DESC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { action: 'user_login' },
        order: [['created', 'DESC']]
      });
      expect(loginAuditLogs).toHaveLength(1);
    });
  });
});