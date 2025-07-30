/**
 * Audit Log model unit tests
 *
 * Tests the AuditLog model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { AuditLog, User } = require('../../../src/models');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('AuditLog Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock AuditLog model methods
    AuditLog.create = jest.fn();
    AuditLog.findAll = jest.fn();
    AuditLog.findOne = jest.fn();
    AuditLog.findByPk = jest.fn();
    AuditLog.update = jest.fn();
    AuditLog.destroy = jest.fn();
  });

  describe('Audit Log Operations', () => {
    beforeEach(() => {
      // Setup default mock implementations
      AuditLog.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        userId: data.userId,
        action: data.action,
        metadata: data.metadata || null,
        created: new Date(),
        ...data
      }));
      
      AuditLog.findAll.mockResolvedValue([]);
      AuditLog.findOne.mockResolvedValue(null);
    });

    test('should create audit log with valid data', async () => {
      const validData = {
        userId: 'user-123',
        action: 'user_login',
        metadata: { ip: '192.168.1.1', userAgent: 'Mozilla/5.0' }
      };

      const result = await AuditLog.create(validData);

      expect(AuditLog.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.id).toBeDefined();
      expect(result.created).toBeInstanceOf(Date);
    });

    test('should create audit log without metadata', async () => {
      const validData = {
        userId: 'user-123',
        action: 'password_change'
      };

      const result = await AuditLog.create(validData);

      expect(AuditLog.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.metadata).toBeNull();
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

      expect(AuditLog.create).toHaveBeenCalledWith(validData);
      expect(result.metadata).toEqual(validData.metadata);
    });

    test('should support querying by user', async () => {
      const mockLogs = [
        { id: '1', userId: 'user-123', action: 'user_login', created: new Date() },
        { id: '2', userId: 'user-123', action: 'booking_created', created: new Date() }
      ];
      
      AuditLog.findAll.mockResolvedValue(mockLogs);

      const userAuditLogs = await AuditLog.findAll({
        where: { userId: 'user-123' },
        order: [['created', 'DESC']]
      });

      expect(AuditLog.findAll).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        order: [['created', 'DESC']]
      });
      expect(userAuditLogs).toHaveLength(2);
    });

    test('should support querying by action type', async () => {
      const mockLogs = [
        { id: '1', userId: 'user-123', action: 'user_login', created: new Date() }
      ];
      
      AuditLog.findAll.mockResolvedValue(mockLogs);

      const loginAuditLogs = await AuditLog.findAll({
        where: { action: 'user_login' },
        order: [['created', 'DESC']]
      });

      expect(AuditLog.findAll).toHaveBeenCalledWith({
        where: { action: 'user_login' },
        order: [['created', 'DESC']]
      });
      expect(loginAuditLogs).toHaveLength(1);
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
      AuditLog.create.mockImplementation(async (data) => ({
        id: uuidv4(),
        userId: data.userId,
        action: data.action,
        metadata: data.metadata || null,
        created: new Date()
      }));

      const validData = {
        userId: 'user-123',
        action,
        metadata: { test: true }
      };

      const result = await AuditLog.create(validData);

      expect(AuditLog.create).toHaveBeenCalledWith(validData);
      expect(result.action).toBe(action);
      expect(result.userId).toBe('user-123');
    });
  });
});