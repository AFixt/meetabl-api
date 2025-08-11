/**
 * Payment service unit tests
 *
 * Tests for payment processing business logic
 *
 * @author meetabl Team
 */

// Import test setup
require('../test-setup');

// Mock Stripe before importing
const mockStripeInstance = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn()
  },
  refunds: {
    create: jest.fn()
  }
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

// Mock dependencies
jest.mock('../../../src/models', () => ({
  Payment: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn()
  },
  Booking: {
    findByPk: jest.fn()
  },
  User: {
    findByPk: jest.fn()
  },
  Invoice: {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn()
  },
  PricingRule: {
    findOne: jest.fn()
  }
}));

jest.mock('../../../src/config/database', () => ({
  sequelize: {
    transaction: jest.fn()
  }
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

// Import service after mocks
const Stripe = require('stripe');
const paymentService = require('../../../src/services/payment.service');
const { Payment, Booking, User, Invoice, PricingRule } = require('../../../src/models');
const { sequelize } = require('../../../src/config/database');

describe('Payment Service', () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock transaction
    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn()
    };
    sequelize.transaction.mockResolvedValue(mockTransaction);
  });

  describe('createPaymentIntent', () => {
    test('should create payment intent successfully', async () => {
      // Mock booking lookup
      const mockBooking = {
        id: 'booking-id',
        user_id: 'host-user-id',
        start_time: new Date('2024-01-15T10:00:00Z'),
        end_time: new Date('2024-01-15T11:00:00Z'), // 1 hour
        User: { id: 'host-user-id', name: 'Host User' }
      };
      Booking.findByPk.mockResolvedValueOnce(mockBooking);

      // Mock pricing rule lookup
      const mockPricingRule = {
        user_id: 'host-user-id',
        price_per_slot: 50.00,
        currency: 'USD',
        is_active: true
      };
      PricingRule.findOne.mockResolvedValueOnce(mockPricingRule);

      // Mock payment creation
      const mockPayment = {
        id: 'payment-id',
        user_id: 'customer-user-id',
        booking_id: 'booking-id',
        amount: 50.00,
        currency: 'USD',
        status: 'pending',
        update: jest.fn()
      };
      Payment.create.mockResolvedValueOnce(mockPayment);

      // Mock Stripe payment intent creation
      const mockPaymentIntent = {
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
        amount: 5000, // $50 in cents
        currency: 'usd'
      };
      mockStripeInstance.paymentIntents.create.mockResolvedValueOnce(mockPaymentIntent);

      // Execute service
      const result = await paymentService.createPaymentIntent('booking-id', 'customer-user-id');

      // Verify booking lookup
      expect(Booking.findByPk).toHaveBeenCalledWith('booking-id', {
        include: [User],
        transaction: mockTransaction
      });

      // Verify pricing rule lookup
      expect(PricingRule.findOne).toHaveBeenCalledWith({
        where: {
          user_id: 'host-user-id',
          is_active: true
        },
        transaction: mockTransaction
      });

      // Verify payment creation
      expect(Payment.create).toHaveBeenCalledWith({
        user_id: 'customer-user-id',
        booking_id: 'booking-id',
        amount: 50.00,
        currency: 'USD',
        status: 'pending'
      }, { transaction: mockTransaction });

      // Verify Stripe payment intent creation
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        metadata: {
          payment_id: 'payment-id',
          booking_id: 'booking-id',
          user_id: 'customer-user-id'
        },
        automatic_payment_methods: {
          enabled: true
        }
      });

      // Verify payment update with Stripe ID
      expect(mockPayment.update).toHaveBeenCalledWith({
        stripe_payment_intent_id: 'pi_test_123'
      }, { transaction: mockTransaction });

      // Verify transaction commit
      expect(mockTransaction.commit).toHaveBeenCalled();

      // Verify result
      expect(result).toEqual({
        payment_id: 'payment-id',
        client_secret: 'pi_test_123_secret',
        amount: 50.00,
        currency: 'USD'
      });
    });

    test('should throw error for non-existent booking', async () => {
      // Mock booking not found
      Booking.findByPk.mockResolvedValueOnce(null);

      // Execute service and expect error
      await expect(paymentService.createPaymentIntent('non-existent-booking', 'customer-user-id'))
        .rejects.toThrow('Booking not found');

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    test('should throw error for no active pricing rule', async () => {
      // Mock booking lookup
      const mockBooking = {
        id: 'booking-id',
        user_id: 'host-user-id'
      };
      Booking.findByPk.mockResolvedValueOnce(mockBooking);

      // Mock pricing rule not found
      PricingRule.findOne.mockResolvedValueOnce(null);

      // Execute service and expect error
      await expect(paymentService.createPaymentIntent('booking-id', 'customer-user-id'))
        .rejects.toThrow('No active pricing rule found for this host');

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    test('should handle Stripe errors', async () => {
      // Mock successful lookups
      Booking.findByPk.mockResolvedValueOnce({
        id: 'booking-id',
        user_id: 'host-user-id',
        start_time: new Date('2024-01-15T10:00:00Z'),
        end_time: new Date('2024-01-15T11:00:00Z')
      });
      PricingRule.findOne.mockResolvedValueOnce({
        price_per_slot: 50.00,
        currency: 'USD'
      });
      Payment.create.mockResolvedValueOnce({
        id: 'payment-id'
      });

      // Mock Stripe error
      mockStripeInstance.paymentIntents.create.mockRejectedValueOnce(new Error('Stripe error'));

      // Execute service and expect error
      await expect(paymentService.createPaymentIntent('booking-id', 'customer-user-id'))
        .rejects.toThrow('Stripe error');

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('confirmPayment', () => {
    test('should confirm payment successfully', async () => {
      // Mock Stripe payment intent retrieval
      const mockPaymentIntent = {
        id: 'pi_test_123',
        status: 'succeeded'
      };
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValueOnce(mockPaymentIntent);

      // Mock payment lookup
      const mockPayment = {
        id: 'payment-id',
        stripe_payment_intent_id: 'pi_test_123',
        status: 'pending',
        update: jest.fn()
      };
      Payment.findOne.mockResolvedValueOnce(mockPayment);

      // Mock invoice creation
      const mockInvoice = {
        id: 'invoice-id',
        payment_id: 'payment-id',
        invoice_number: expect.stringMatching(/^INV-\d+-/),
        status: 'paid'
      };
      Invoice.create.mockResolvedValueOnce(mockInvoice);

      // Execute service
      const result = await paymentService.confirmPayment('pi_test_123');

      // Verify Stripe payment intent retrieval
      expect(mockStripeInstance.paymentIntents.retrieve).toHaveBeenCalledWith('pi_test_123');

      // Verify payment lookup
      expect(Payment.findOne).toHaveBeenCalledWith({
        where: { stripe_payment_intent_id: 'pi_test_123' },
        transaction: mockTransaction
      });

      // Verify payment status update
      expect(mockPayment.update).toHaveBeenCalledWith({
        status: 'completed'
      }, { transaction: mockTransaction });

      // Verify invoice creation
      expect(Invoice.create).toHaveBeenCalledWith({
        payment_id: 'payment-id',
        invoice_number: expect.stringMatching(/^INV-\d+-/),
        status: 'paid'
      }, { transaction: mockTransaction });

      // Verify transaction commit
      expect(mockTransaction.commit).toHaveBeenCalled();

      // Verify result
      expect(result).toEqual({
        payment: mockPayment,
        invoice: mockInvoice
      });
    });

    test('should throw error for unsuccessful payment', async () => {
      // Mock Stripe payment intent with failed status
      const mockPaymentIntent = {
        id: 'pi_test_123',
        status: 'requires_payment_method'
      };
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValueOnce(mockPaymentIntent);

      // Execute service and expect error
      await expect(paymentService.confirmPayment('pi_test_123'))
        .rejects.toThrow('Payment not successful');

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    test('should throw error for non-existent payment record', async () => {
      // Mock successful Stripe retrieval
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_test_123',
        status: 'succeeded'
      });

      // Mock payment not found
      Payment.findOne.mockResolvedValueOnce(null);

      // Execute service and expect error
      await expect(paymentService.confirmPayment('pi_test_123'))
        .rejects.toThrow('Payment record not found');

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('processRefund', () => {
    test('should process full refund successfully', async () => {
      // Mock payment lookup
      const mockPayment = {
        id: 'payment-id',
        stripe_payment_intent_id: 'pi_test_123',
        status: 'completed',
        update: jest.fn()
      };
      Payment.findByPk.mockResolvedValueOnce(mockPayment);

      // Mock Stripe refund creation
      const mockRefund = {
        id: 're_test_123',
        amount: 5000, // $50 in cents
        currency: 'usd',
        status: 'succeeded'
      };
      mockStripeInstance.refunds.create.mockResolvedValueOnce(mockRefund);

      // Mock invoice lookup and update
      const mockInvoice = {
        id: 'invoice-id',
        payment_id: 'payment-id',
        update: jest.fn()
      };
      Invoice.findOne.mockResolvedValueOnce(mockInvoice);

      // Execute service
      const result = await paymentService.processRefund('payment-id');

      // Verify payment lookup
      expect(Payment.findByPk).toHaveBeenCalledWith('payment-id', { transaction: mockTransaction });

      // Verify Stripe refund creation
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        amount: undefined, // Full refund
        reason: 'requested_by_customer'
      });

      // Verify payment status update
      expect(mockPayment.update).toHaveBeenCalledWith({
        status: 'refunded'
      }, { transaction: mockTransaction });

      // Verify invoice status update
      expect(mockInvoice.update).toHaveBeenCalledWith({
        status: 'draft'
      }, { transaction: mockTransaction });

      // Verify transaction commit
      expect(mockTransaction.commit).toHaveBeenCalled();

      // Verify result
      expect(result).toEqual({
        refund_id: 're_test_123',
        amount: 50.00,
        currency: 'usd',
        status: 'succeeded'
      });
    });

    test('should process partial refund successfully', async () => {
      // Mock payment lookup
      const mockPayment = {
        id: 'payment-id',
        stripe_payment_intent_id: 'pi_test_123',
        status: 'completed',
        update: jest.fn()
      };
      Payment.findByPk.mockResolvedValueOnce(mockPayment);

      // Mock Stripe refund creation
      const mockRefund = {
        id: 're_test_123',
        amount: 2500, // $25 in cents
        currency: 'usd',
        status: 'succeeded'
      };
      mockStripeInstance.refunds.create.mockResolvedValueOnce(mockRefund);

      // Mock no invoice
      Invoice.findOne.mockResolvedValueOnce(null);

      // Execute service with partial amount
      const result = await paymentService.processRefund('payment-id', 25.00, 'duplicate');

      // Verify Stripe refund creation with partial amount
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        amount: 2500,
        reason: 'duplicate'
      });

      // Verify result
      expect(result).toEqual({
        refund_id: 're_test_123',
        amount: 25.00,
        currency: 'usd',
        status: 'succeeded'
      });
    });

    test('should throw error for non-existent payment', async () => {
      // Mock payment not found
      Payment.findByPk.mockResolvedValueOnce(null);

      // Execute service and expect error
      await expect(paymentService.processRefund('non-existent-payment'))
        .rejects.toThrow('Payment not found');

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    test('should throw error for non-completed payment', async () => {
      // Mock payment with pending status
      const mockPayment = {
        id: 'payment-id',
        status: 'pending'
      };
      Payment.findByPk.mockResolvedValueOnce(mockPayment);

      // Execute service and expect error
      await expect(paymentService.processRefund('payment-id'))
        .rejects.toThrow('Only completed payments can be refunded');

      // Verify transaction rollback
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('getPaymentHistory', () => {
    test('should get payment history successfully', async () => {
      // Mock payment history data
      const mockPayments = {
        count: 2,
        rows: [
          {
            id: 'payment-1',
            user_id: 'user-id',
            amount: 50.00,
            currency: 'USD',
            status: 'completed',
            Booking: {
              id: 'booking-1',
              User: { id: 'host-id', name: 'Host User' }
            },
            Invoice: {
              id: 'invoice-1',
              invoice_number: 'INV-001'
            }
          },
          {
            id: 'payment-2',
            user_id: 'user-id',
            amount: 30.00,
            currency: 'USD',
            status: 'pending',
            Booking: {
              id: 'booking-2',
              User: { id: 'host-id', name: 'Host User' }
            },
            Invoice: null
          }
        ]
      };
      Payment.findAndCountAll.mockResolvedValueOnce(mockPayments);

      // Execute service
      const result = await paymentService.getPaymentHistory('user-id', { limit: 10, offset: 0 });

      // Verify database query
      expect(Payment.findAndCountAll).toHaveBeenCalledWith({
        where: { user_id: 'user-id' },
        include: [{
          model: Booking,
          include: [User]
        }, {
          model: Invoice
        }],
        order: [['created_at', 'DESC']],
        limit: 10,
        offset: 0
      });

      // Verify result
      expect(result).toEqual({
        total: 2,
        payments: mockPayments.rows,
        limit: 10,
        offset: 0
      });
    });

    test('should handle database errors', async () => {
      // Mock database error
      Payment.findAndCountAll.mockRejectedValueOnce(new Error('Database error'));

      // Execute service and expect error
      await expect(paymentService.getPaymentHistory('user-id')).rejects.toThrow('Database error');
    });
  });

  describe('handleWebhookEvent', () => {
    test('should handle payment_intent.succeeded event', async () => {
      // Mock webhook event
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123'
          }
        }
      };

      // Mock confirmPayment dependencies
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_test_123',
        status: 'succeeded'
      });
      Payment.findOne.mockResolvedValueOnce({
        id: 'payment-id',
        update: jest.fn()
      });
      Invoice.create.mockResolvedValueOnce({});

      // Execute service
      await paymentService.handleWebhookEvent(mockEvent);

      // Verify confirmPayment was called
      expect(mockStripeInstance.paymentIntents.retrieve).toHaveBeenCalledWith('pi_test_123');
    });

    test('should handle payment_intent.payment_failed event', async () => {
      // Mock webhook event
      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_123'
          }
        }
      };

      // Mock payment lookup and update
      const mockPayment = {
        id: 'payment-id',
        update: jest.fn()
      };
      Payment.findOne.mockResolvedValueOnce(mockPayment);

      // Execute service
      await paymentService.handleWebhookEvent(mockEvent);

      // Verify payment lookup
      expect(Payment.findOne).toHaveBeenCalledWith({
        where: { stripe_payment_intent_id: 'pi_test_123' }
      });

      // Verify payment status update
      expect(mockPayment.update).toHaveBeenCalledWith({ status: 'failed' });
    });

    test('should handle unknown event types', async () => {
      // Mock unknown event
      const mockEvent = {
        type: 'unknown.event.type',
        data: {}
      };

      // Execute service (should not throw)
      await expect(paymentService.handleWebhookEvent(mockEvent)).resolves.toBeUndefined();
    });

    test('should handle webhook processing errors', async () => {
      // Mock webhook event that causes error
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123'
          }
        }
      };

      // Mock Stripe error
      mockStripeInstance.paymentIntents.retrieve.mockRejectedValueOnce(new Error('Stripe error'));

      // Execute service and expect error
      await expect(paymentService.handleWebhookEvent(mockEvent)).rejects.toThrow('Stripe error');
    });
  });
});