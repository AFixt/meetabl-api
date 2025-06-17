/**
 * Payment controller unit tests
 *
 * Tests for payment processing functionality
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup controller mocks
setupControllerMocks();

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

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

// Mock payment service
jest.mock('../../../src/services/payment.service', () => ({
  createPaymentIntent: jest.fn(),
  processPayment: jest.fn(),
  getPaymentHistory: jest.fn(),
  refundPayment: jest.fn(),
  createPricingRule: jest.fn(),
  updatePricingRule: jest.fn(),
  deletePricingRule: jest.fn(),
  getPricingRules: jest.fn()
}));

// Mock models
jest.mock('../../../src/models', () => ({
  AuditLog: {
    create: jest.fn()
  },
  Payment: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  PricingRule: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  }
}));

// Import controller after mocks are set up
const {
  processPayment,
  getPaymentHistory,
  refundPayment,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  getPricingRules
} = require('../../../src/controllers/payment.controller');

const { validationResult } = require('express-validator');
const paymentService = require('../../../src/services/payment.service');
const { AuditLog } = require('../../../src/models');

describe('Payment Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processPayment', () => {
    test('should process payment successfully', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock payment service
      const mockPaymentIntent = {
        payment_id: 'payment-id',
        amount: 5000,
        currency: 'USD',
        client_secret: 'secret'
      };
      paymentService.createPaymentIntent.mockResolvedValueOnce(mockPaymentIntent);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: { booking_id: 'booking-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await processPayment(req, res);

      // Verify service was called
      expect(paymentService.createPaymentIntent).toHaveBeenCalledWith('booking-id', 'test-user-id');

      // Verify audit log was created
      expect(AuditLog.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        action: 'payment_initiated',
        entity_type: 'payment',
        entity_id: 'payment-id',
        metadata: JSON.stringify({
          booking_id: 'booking-id',
          amount: 5000,
          currency: 'USD'
        })
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPaymentIntent);
    });

    test('should handle validation errors', async () => {
      // Mock validation failure
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { param: 'booking_id', msg: 'Booking ID is required' }
        ]
      });

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {}
      });
      const res = createMockResponse();

      // Execute controller
      await processPayment(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: [
          { param: 'booking_id', msg: 'Booking ID is required' }
        ]
      });
    });

    test('should handle service errors', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock service error
      paymentService.createPaymentIntent.mockRejectedValueOnce(new Error('Payment service error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: { booking_id: 'booking-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await processPayment(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'internal_server_error',
          message: 'Failed to process payment'
        }
      });
    });
  });

  describe('getPaymentHistory', () => {
    test('should get payment history successfully', async () => {
      // Mock payment history
      const mockPayments = [
        { id: 'payment-1', amount: 5000, status: 'completed' },
        { id: 'payment-2', amount: 3000, status: 'pending' }
      ];
      paymentService.getPaymentHistory.mockResolvedValueOnce(mockPayments);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        query: { limit: 10, offset: 0 }
      });
      const res = createMockResponse();

      // Execute controller
      await getPaymentHistory(req, res);

      // Verify service was called
      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith('test-user-id', {
        limit: 10,
        offset: 0
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Payment history retrieved successfully',
        payments: mockPayments
      });
    });

    test('should handle service errors', async () => {
      // Mock service error
      paymentService.getPaymentHistory.mockRejectedValueOnce(new Error('Service error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await getPaymentHistory(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'internal_server_error',
          message: 'Failed to get payment history'
        }
      });
    });
  });

  describe('refundPayment', () => {
    test('should refund payment successfully', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock refund result
      const mockRefund = {
        id: 'refund-id',
        payment_id: 'payment-id',
        amount: 5000,
        status: 'processed'
      };
      paymentService.refundPayment.mockResolvedValueOnce(mockRefund);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'payment-id' },
        body: { reason: 'Customer request' }
      });
      const res = createMockResponse();

      // Execute controller
      await refundPayment(req, res);

      // Verify service was called
      expect(paymentService.refundPayment).toHaveBeenCalledWith('payment-id', 'test-user-id', {
        reason: 'Customer request'
      });

      // Verify audit log was created
      expect(AuditLog.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        action: 'payment_refunded',
        entity_type: 'payment',
        entity_id: 'payment-id',
        metadata: JSON.stringify({
          refund_id: 'refund-id',
          reason: 'Customer request'
        })
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Payment refunded successfully',
        refund: mockRefund
      });
    });

    test('should handle payment not found', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock payment not found error
      const notFoundError = new Error('Payment not found');
      notFoundError.statusCode = 404;
      paymentService.refundPayment.mockRejectedValueOnce(notFoundError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' },
        body: { reason: 'Customer request' }
      });
      const res = createMockResponse();

      // Execute controller
      await refundPayment(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'not_found',
          message: 'Payment not found or cannot be refunded'
        }
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
        service_name: 'Consultation',
        base_price: 10000,
        currency: 'USD'
      };
      paymentService.createPricingRule.mockResolvedValueOnce(mockRule);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          service_name: 'Consultation',
          base_price: 10000,
          currency: 'USD'
        }
      });
      const res = createMockResponse();

      // Execute controller
      await createPricingRule(req, res);

      // Verify service was called
      expect(paymentService.createPricingRule).toHaveBeenCalledWith('test-user-id', {
        service_name: 'Consultation',
        base_price: 10000,
        currency: 'USD'
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rule created successfully',
        rule: mockRule
      });
    });

    test('should handle validation errors', async () => {
      // Mock validation failure
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { param: 'service_name', msg: 'Service name is required' },
          { param: 'base_price', msg: 'Base price must be a positive number' }
        ]
      });

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {}
      });
      const res = createMockResponse();

      // Execute controller
      await createPricingRule(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: [
          { param: 'service_name', msg: 'Service name is required' },
          { param: 'base_price', msg: 'Base price must be a positive number' }
        ]
      });
    });
  });

  describe('updatePricingRule', () => {
    test('should update pricing rule successfully', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock updated rule
      const mockRule = {
        id: 'rule-id',
        user_id: 'test-user-id',
        service_name: 'Updated Consultation',
        base_price: 15000,
        currency: 'USD'
      };
      paymentService.updatePricingRule.mockResolvedValueOnce(mockRule);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'rule-id' },
        body: {
          service_name: 'Updated Consultation',
          base_price: 15000
        }
      });
      const res = createMockResponse();

      // Execute controller
      await updatePricingRule(req, res);

      // Verify service was called
      expect(paymentService.updatePricingRule).toHaveBeenCalledWith('rule-id', 'test-user-id', {
        service_name: 'Updated Consultation',
        base_price: 15000
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rule updated successfully',
        rule: mockRule
      });
    });

    test('should handle rule not found', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock rule not found error
      const notFoundError = new Error('Pricing rule not found');
      notFoundError.statusCode = 404;
      paymentService.updatePricingRule.mockRejectedValueOnce(notFoundError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' },
        body: { base_price: 15000 }
      });
      const res = createMockResponse();

      // Execute controller
      await updatePricingRule(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'not_found',
          message: 'Pricing rule not found or access denied'
        }
      });
    });
  });

  describe('deletePricingRule', () => {
    test('should delete pricing rule successfully', async () => {
      // Mock successful deletion
      paymentService.deletePricingRule.mockResolvedValueOnce();

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'rule-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await deletePricingRule(req, res);

      // Verify service was called
      expect(paymentService.deletePricingRule).toHaveBeenCalledWith('rule-id', 'test-user-id');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rule deleted successfully'
      });
    });

    test('should handle rule not found', async () => {
      // Mock rule not found error
      const notFoundError = new Error('Pricing rule not found');
      notFoundError.statusCode = 404;
      paymentService.deletePricingRule.mockRejectedValueOnce(notFoundError);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await deletePricingRule(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'not_found',
          message: 'Pricing rule not found or access denied'
        }
      });
    });
  });

  describe('getPricingRules', () => {
    test('should get pricing rules successfully', async () => {
      // Mock pricing rules
      const mockRules = [
        { id: 'rule-1', service_name: 'Consultation', base_price: 10000 },
        { id: 'rule-2', service_name: 'Workshop', base_price: 25000 }
      ];
      paymentService.getPricingRules.mockResolvedValueOnce(mockRules);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await getPricingRules(req, res);

      // Verify service was called
      expect(paymentService.getPricingRules).toHaveBeenCalledWith('test-user-id');

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Pricing rules retrieved successfully',
        rules: mockRules
      });
    });

    test('should handle service errors', async () => {
      // Mock service error
      paymentService.getPricingRules.mockRejectedValueOnce(new Error('Service error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await getPricingRules(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'internal_server_error',
          message: 'Failed to get pricing rules'
        }
      });
    });
  });
});