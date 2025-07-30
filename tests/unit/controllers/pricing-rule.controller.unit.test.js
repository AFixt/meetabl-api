/**
 * Pricing Rule controller unit tests
 *
 * Tests for pricing rule management functionality
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

jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

jest.mock('../../../src/models', () => ({
  PricingRule: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  AuditLog: {
    create: jest.fn()
  }
}));

jest.mock('../../../src/config/database', () => ({
  sequelize: {
    transaction: jest.fn()
  },
  Op: {
    ne: Symbol('ne')
  }
}));

// Import controller after mocks are set up
const {
  getPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule
} = require('../../../src/controllers/pricing-rule.controller');

const { validationResult } = require('express-validator');
const { PricingRule, AuditLog } = require('../../../src/models');
const { sequelize, Op } = require('../../../src/config/database');

// Ensure test utilities are available
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
    return res;
  };
}

describe('Pricing Rule Controller', () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock transaction
    mockTransaction = {
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue()
    };
    sequelize.transaction.mockResolvedValue(mockTransaction);
  });

  describe('getPricingRules', () => {
    test('should get all pricing rules for user', async () => {
      // Mock pricing rules
      const mockRules = [
        { id: 'rule-1', name: 'Basic', price_per_slot: 5000, is_active: true },
        { id: 'rule-2', name: 'Premium', price_per_slot: 10000, is_active: false }
      ];
      PricingRule.findAll.mockResolvedValueOnce(mockRules);

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        query: {}
      });
      const res = global.createMockResponse();

      // Execute controller
      await getPricingRules(req, res);

      // Verify query
      expect(PricingRule.findAll).toHaveBeenCalledWith({
        where: { user_id: 'test-user-id' },
        order: [['created_at', 'DESC']]
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rules retrieved successfully',
        data: mockRules
      });
    });

    test('should filter by is_active when provided', async () => {
      // Mock pricing rules
      const mockRules = [
        { id: 'rule-1', name: 'Basic', price_per_slot: 5000, is_active: true }
      ];
      PricingRule.findAll.mockResolvedValueOnce(mockRules);

      // Create request with is_active filter
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        query: { is_active: 'true' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await getPricingRules(req, res);

      // Verify query includes is_active filter
      expect(PricingRule.findAll).toHaveBeenCalledWith({
        where: { 
          user_id: 'test-user-id',
          is_active: true
        },
        order: [['created_at', 'DESC']]
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rules retrieved successfully',
        data: mockRules
      });
    });

    test('should handle database errors', async () => {
      // Mock database error
      PricingRule.findAll.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        query: {}
      });
      const res = global.createMockResponse();

      // Execute controller
      await getPricingRules(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve pricing rules',
        message: 'Database error'
      });
    });
  });

  describe('createPricingRule', () => {
    test('should create pricing rule successfully', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock pricing rule creation
      const mockRule = {
        id: 'rule-id',
        user_id: 'test-user-id',
        name: 'Basic Plan',
        description: 'Basic pricing plan',
        price_per_slot: 5000,
        currency: 'USD',
        is_active: true
      };
      PricingRule.update.mockResolvedValueOnce([1]); // Deactivate other rules
      PricingRule.create.mockResolvedValueOnce(mockRule);
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          name: 'Basic Plan',
          description: 'Basic pricing plan',
          price_per_slot: 5000,
          currency: 'USD',
          is_active: true
        }
      });
      const res = global.createMockResponse();

      // Execute controller
      await createPricingRule(req, res);

      // Verify other rules were deactivated
      expect(PricingRule.update).toHaveBeenCalledWith(
        { is_active: false },
        { 
          where: { user_id: 'test-user-id' },
          transaction: mockTransaction
        }
      );

      // Verify pricing rule creation
      expect(PricingRule.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        name: 'Basic Plan',
        description: 'Basic pricing plan',
        price_per_slot: 5000,
        currency: 'USD',
        is_active: true
      }, { transaction: mockTransaction });

      // Verify audit log
      expect(AuditLog.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        action: 'pricing_rule_created',
        entity_type: 'pricing_rule',
        entity_id: 'rule-id',
        metadata: JSON.stringify({
          name: 'Basic Plan',
          price_per_slot: 5000,
          currency: 'USD'
        })
      }, { transaction: mockTransaction });

      // Verify transaction commit
      expect(mockTransaction.commit).toHaveBeenCalled();

      // Verify response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rule created successfully',
        data: mockRule
      });
    });

    test('should handle validation errors', async () => {
      // Mock validation failure
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { param: 'name', msg: 'Name is required' },
          { param: 'price_per_slot', msg: 'Price must be a positive number' }
        ]
      });

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        body: {}
      });
      const res = global.createMockResponse();

      // Execute controller
      await createPricingRule(req, res);

      // Verify validation error response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: [
          { param: 'name', msg: 'Name is required' },
          { param: 'price_per_slot', msg: 'Price must be a positive number' }
        ]
      });

      // Verify no database operations
      expect(PricingRule.create).not.toHaveBeenCalled();
    });

    test('should handle database errors and rollback', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock database error
      PricingRule.create.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          name: 'Basic Plan',
          price_per_slot: 5000,
          is_active: false
        }
      });
      const res = global.createMockResponse();

      // Execute controller
      await createPricingRule(req, res);

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to create pricing rule',
        message: 'Database error'
      });
    });

    test('should use default currency when not provided', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock pricing rule creation
      const mockRule = {
        id: 'rule-id',
        user_id: 'test-user-id',
        name: 'Basic Plan',
        price_per_slot: 5000,
        currency: 'USD',
        is_active: false
      };
      PricingRule.create.mockResolvedValueOnce(mockRule);
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

      // Create request without currency
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          name: 'Basic Plan',
          price_per_slot: 5000,
          is_active: false
        }
      });
      const res = global.createMockResponse();

      // Execute controller
      await createPricingRule(req, res);

      // Verify pricing rule creation with default currency
      expect(PricingRule.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        name: 'Basic Plan',
        price_per_slot: 5000,
        currency: 'USD',
        is_active: false
      }, { transaction: mockTransaction });
    });
  });

  describe('updatePricingRule', () => {
    test('should update pricing rule successfully', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock pricing rule
      const mockRule = {
        id: 'rule-id',
        user_id: 'test-user-id',
        name: 'Basic Plan',
        is_active: false,
        update: jest.fn().mockResolvedValue()
      };
      PricingRule.findOne.mockResolvedValueOnce(mockRule);
      PricingRule.update.mockResolvedValueOnce([1]); // Deactivate other rules
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'rule-id' },
        body: {
          name: 'Updated Plan',
          price_per_slot: 7500,
          is_active: true
        }
      });
      const res = global.createMockResponse();

      // Execute controller
      await updatePricingRule(req, res);

      // Verify pricing rule lookup
      expect(PricingRule.findOne).toHaveBeenCalledWith({
        where: { id: 'rule-id', user_id: 'test-user-id' },
        transaction: mockTransaction
      });

      // Verify other rules were deactivated
      expect(PricingRule.update).toHaveBeenCalledWith(
        { is_active: false },
        { 
          where: { 
            user_id: 'test-user-id',
            id: { [Op.ne]: 'rule-id' }
          },
          transaction: mockTransaction
        }
      );

      // Verify pricing rule update
      expect(mockRule.update).toHaveBeenCalledWith({
        name: 'Updated Plan',
        price_per_slot: 7500,
        is_active: true
      }, { transaction: mockTransaction });

      // Verify audit log
      expect(AuditLog.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        action: 'pricing_rule_updated',
        entity_type: 'pricing_rule',
        entity_id: 'rule-id',
        metadata: JSON.stringify({
          name: 'Updated Plan',
          price_per_slot: 7500,
          is_active: true
        })
      }, { transaction: mockTransaction });

      // Verify transaction commit
      expect(mockTransaction.commit).toHaveBeenCalled();

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rule updated successfully',
        data: mockRule
      });
    });

    test('should handle pricing rule not found', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock pricing rule not found
      PricingRule.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' },
        body: { name: 'Updated Plan' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await updatePricingRule(req, res);

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Pricing rule not found'
      });
    });

    test('should handle validation errors', async () => {
      // Mock validation failure
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { param: 'price_per_slot', msg: 'Price must be a positive number' }
        ]
      });

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'rule-id' },
        body: { price_per_slot: -100 }
      });
      const res = global.createMockResponse();

      // Execute controller
      await updatePricingRule(req, res);

      // Verify validation error response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: [
          { param: 'price_per_slot', msg: 'Price must be a positive number' }
        ]
      });
    });

    test('should handle database errors and rollback', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock database error
      PricingRule.findOne.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'rule-id' },
        body: { name: 'Updated Plan' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await updatePricingRule(req, res);

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to update pricing rule',
        message: 'Database error'
      });
    });
  });

  describe('deletePricingRule', () => {
    test('should delete pricing rule successfully', async () => {
      // Mock pricing rule
      const mockRule = {
        id: 'rule-id',
        user_id: 'test-user-id',
        name: 'Basic Plan',
        is_active: false,
        destroy: jest.fn().mockResolvedValue()
      };
      PricingRule.findOne.mockResolvedValueOnce(mockRule);
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'rule-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await deletePricingRule(req, res);

      // Verify pricing rule lookup
      expect(PricingRule.findOne).toHaveBeenCalledWith({
        where: { id: 'rule-id', user_id: 'test-user-id' },
        transaction: mockTransaction
      });

      // Verify pricing rule deletion
      expect(mockRule.destroy).toHaveBeenCalledWith({ transaction: mockTransaction });

      // Verify audit log
      expect(AuditLog.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        action: 'pricing_rule_deleted',
        entity_type: 'pricing_rule',
        entity_id: 'rule-id',
        metadata: JSON.stringify({
          name: 'Basic Plan'
        })
      }, { transaction: mockTransaction });

      // Verify transaction commit
      expect(mockTransaction.commit).toHaveBeenCalled();

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rule deleted successfully'
      });
    });

    test('should prevent deletion of only active pricing rule', async () => {
      // Mock active pricing rule
      const mockRule = {
        id: 'rule-id',
        user_id: 'test-user-id',
        name: 'Basic Plan',
        is_active: true
      };
      PricingRule.findOne.mockResolvedValueOnce(mockRule);
      PricingRule.count.mockResolvedValueOnce(1); // Only one active rule

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'rule-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await deletePricingRule(req, res);

      // Verify active rule count check
      expect(PricingRule.count).toHaveBeenCalledWith({
        where: { 
          user_id: 'test-user-id',
          is_active: true
        },
        transaction: mockTransaction
      });

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot delete the only active pricing rule'
      });
    });

    test('should delete active pricing rule when others exist', async () => {
      // Mock active pricing rule
      const mockRule = {
        id: 'rule-id',
        user_id: 'test-user-id',
        name: 'Basic Plan',
        is_active: true,
        destroy: jest.fn().mockResolvedValue()
      };
      PricingRule.findOne.mockResolvedValueOnce(mockRule);
      PricingRule.count.mockResolvedValueOnce(2); // Multiple active rules
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'rule-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await deletePricingRule(req, res);

      // Verify pricing rule deletion
      expect(mockRule.destroy).toHaveBeenCalledWith({ transaction: mockTransaction });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rule deleted successfully'
      });
    });

    test('should handle pricing rule not found', async () => {
      // Mock pricing rule not found
      PricingRule.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await deletePricingRule(req, res);

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Pricing rule not found'
      });
    });

    test('should handle database errors and rollback', async () => {
      // Mock database error
      PricingRule.findOne.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'rule-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await deletePricingRule(req, res);

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to delete pricing rule',
        message: 'Database error'
      });
    });
  });
});