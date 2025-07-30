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
  getPaymentHistory: jest.fn(),
  processRefund: jest.fn(),
  handleWebhookEvent: jest.fn()
}));

// Mock models
jest.mock('../../../src/models', () => ({
  AuditLog: {
    create: jest.fn()
  }
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn()
    }
  }));
});

// Mock error response utilities
jest.mock('../../../src/utils/error-response', () => ({
  asyncHandler: (fn) => fn,
  successResponse: jest.fn((res, data, message) => {
    res.status(200);
    res.json(data);
    return res;
  }),
  validationError: jest.fn((errors) => {
    const error = new Error('Validation failed');
    error.statusCode = 400;
    error.details = errors;
    return error;
  }),
  createError: jest.fn((type, message) => {
    const error = new Error(message);
    if (type === 'VALIDATION_ERROR') {
      error.statusCode = 400;
    } else {
      error.statusCode = 500;
    }
    return error;
  })
}));

// Import controller after mocks are set up
const {
  processPayment,
  getPaymentHistory,
  refundPayment,
  handleStripeWebhook
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

      // Mock audit log creation
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

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

      // Execute controller and expect it to throw
      await expect(processPayment(req, res)).rejects.toThrow('Validation failed');

      // Verify service was not called
      expect(paymentService.createPaymentIntent).not.toHaveBeenCalled();
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

      // Execute controller and expect it to throw
      await expect(processPayment(req, res)).rejects.toThrow('Payment service error');
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
        query: { limit: '10', offset: '0' }
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
      expect(res.json).toHaveBeenCalledWith(mockPayments);
    });

    test('should handle service errors', async () => {
      // Mock service error
      paymentService.getPaymentHistory.mockRejectedValueOnce(new Error('Service error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(getPaymentHistory(req, res)).rejects.toThrow('Service error');
    });

    test('should use default pagination values', async () => {
      // Mock payment history
      const mockPayments = [];
      paymentService.getPaymentHistory.mockResolvedValueOnce(mockPayments);

      // Create request without query params
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        query: {}
      });
      const res = createMockResponse();

      // Execute controller
      await getPaymentHistory(req, res);

      // Verify service was called with default values
      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith('test-user-id', {
        limit: 20,
        offset: 0
      });
    });
  });

  describe('refundPayment', () => {
    test('should refund payment successfully', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock refund result
      const mockRefund = {
        refund_id: 'refund-id',
        payment_id: 'payment-id',
        amount: 5000,
        status: 'processed'
      };
      paymentService.processRefund.mockResolvedValueOnce(mockRefund);

      // Mock audit log creation
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: { 
          payment_id: 'payment-id',
          amount: 5000,
          reason: 'Customer request' 
        }
      });
      const res = createMockResponse();

      // Execute controller
      await refundPayment(req, res);

      // Verify service was called
      expect(paymentService.processRefund).toHaveBeenCalledWith('payment-id', 5000, 'Customer request');

      // Verify audit log was created
      expect(AuditLog.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        action: 'payment_refunded',
        entity_type: 'payment',
        entity_id: 'payment-id',
        metadata: JSON.stringify({
          refund_id: 'refund-id',
          amount: 5000,
          reason: 'Customer request'
        })
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockRefund);
    });

    test('should handle validation errors', async () => {
      // Mock validation failure
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { param: 'payment_id', msg: 'Payment ID is required' }
        ]
      });

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {}
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(refundPayment(req, res)).rejects.toThrow('Validation failed');

      // Verify service was not called
      expect(paymentService.processRefund).not.toHaveBeenCalled();
    });

    test('should handle refund errors', async () => {
      // Mock validation
      validationResult.mockReturnValue({ isEmpty: () => true });

      // Mock service error
      paymentService.processRefund.mockRejectedValueOnce(new Error('Refund failed'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: { 
          payment_id: 'payment-id',
          amount: 5000,
          reason: 'Customer request' 
        }
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(refundPayment(req, res)).rejects.toThrow('Refund failed');
    });
  });

  describe('handleStripeWebhook', () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    });

    test('should handle webhook with valid signature', async () => {
      const stripe = require('stripe');
      const mockEvent = {
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } }
      };

      // Mock Stripe webhook construction
      const mockStripeInstance = {
        webhooks: {
          constructEvent: jest.fn().mockReturnValue(mockEvent)
        }
      };
      stripe.mockReturnValue(mockStripeInstance);

      // Mock webhook event handling
      paymentService.handleWebhookEvent.mockResolvedValueOnce();

      // Create request
      const req = createMockRequest({
        headers: { 'stripe-signature': 'test-signature' },
        body: 'raw-body'
      });
      const res = createMockResponse();

      // Execute controller
      await handleStripeWebhook(req, res);

      // Verify Stripe webhook construction
      expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        'raw-body',
        'test-signature',
        'whsec_test'
      );

      // Verify webhook event handling
      expect(paymentService.handleWebhookEvent).toHaveBeenCalledWith(mockEvent);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    test('should handle webhook without signature verification', async () => {
      // Remove webhook secret to skip signature verification
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const mockEvent = {
        id: 'evt_test',
        type: 'payment_intent.succeeded'
      };

      // Mock webhook event handling
      paymentService.handleWebhookEvent.mockResolvedValueOnce();

      // Create request
      const req = createMockRequest({
        body: mockEvent
      });
      const res = createMockResponse();

      // Execute controller
      await handleStripeWebhook(req, res);

      // Verify webhook event handling (should use req.body directly)
      expect(paymentService.handleWebhookEvent).toHaveBeenCalledWith(mockEvent);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    test('should handle signature verification failure', async () => {
      const stripe = require('stripe');
      const mockStripeInstance = {
        webhooks: {
          constructEvent: jest.fn().mockImplementation(() => {
            throw new Error('Invalid signature');
          })
        }
      };
      stripe.mockReturnValue(mockStripeInstance);

      // Create request
      const req = createMockRequest({
        headers: { 'stripe-signature': 'invalid-signature' },
        body: 'raw-body'
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(handleStripeWebhook(req, res)).rejects.toThrow('Webhook Error: Invalid signature');

      // Verify webhook event handling was not called
      expect(paymentService.handleWebhookEvent).not.toHaveBeenCalled();
    });

    test('should handle webhook processing errors', async () => {
      const stripe = require('stripe');
      const mockEvent = {
        id: 'evt_test',
        type: 'payment_intent.succeeded'
      };

      const mockStripeInstance = {
        webhooks: {
          constructEvent: jest.fn().mockReturnValue(mockEvent)
        }
      };
      stripe.mockReturnValue(mockStripeInstance);

      // Mock webhook event handling error
      paymentService.handleWebhookEvent.mockRejectedValueOnce(new Error('Processing failed'));

      // Create request
      const req = createMockRequest({
        headers: { 'stripe-signature': 'test-signature' },
        body: 'raw-body'
      });
      const res = createMockResponse();

      // Execute controller and expect it to throw
      await expect(handleStripeWebhook(req, res)).rejects.toThrow('Processing failed');
    });
  });
});