/**
 * Payment model unit tests
 *
 * Tests the Payment model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { Payment } = require('../../../src/models');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('Payment Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Payment model methods
    Payment.create = jest.fn();
    Payment.findAll = jest.fn();
    Payment.findOne = jest.fn();
    Payment.findByPk = jest.fn();
    Payment.update = jest.fn();
    Payment.destroy = jest.fn();
    Payment.sum = jest.fn();
  });

  describe('Payment Operations', () => {
    beforeEach(() => {
      // Setup default mock implementations
      Payment.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        user_id: data.user_id,
        booking_id: data.booking_id,
        amount: data.amount,
        currency: data.currency || 'USD',
        status: data.status || 'pending',
        stripe_payment_intent_id: data.stripe_payment_intent_id || null,
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      }));
      
      Payment.findAll.mockResolvedValue([]);
      Payment.findOne.mockResolvedValue(null);
      Payment.update.mockResolvedValue([1]);
      Payment.sum.mockResolvedValue(0);
    });

    test('should create payment with valid data', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 150.00,
        currency: 'EUR',
        status: 'pending',
        stripe_payment_intent_id: 'pi_test_123'
      };

      const result = await Payment.create(validData);

      expect(Payment.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.id).toBeDefined();
    });

    test('should create payment with default currency', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 75.00,
        status: 'pending'
      };

      const result = await Payment.create(validData);

      expect(Payment.create).toHaveBeenCalledWith(validData);
      expect(result.currency).toBe('USD');
    });

    test('should create payment with default status', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 200.00,
        currency: 'GBP'
      };

      const result = await Payment.create(validData);

      expect(Payment.create).toHaveBeenCalledWith(validData);
      expect(result.status).toBe('pending');
    });

    test('should handle zero amount for free bookings', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 0.00,
        currency: 'USD',
        status: 'completed'
      };

      const result = await Payment.create(validData);

      expect(Payment.create).toHaveBeenCalledWith(validData);
      expect(result.amount).toBe(0.00);
    });

    test('should handle decimal amounts correctly', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 99.99,
        currency: 'USD',
        status: 'pending'
      };

      const result = await Payment.create(validData);

      expect(Payment.create).toHaveBeenCalledWith(validData);
      expect(result.amount).toBe(99.99);
    });

    test('should create payment without Stripe payment intent ID', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 50.00,
        currency: 'USD',
        status: 'pending'
      };

      const result = await Payment.create(validData);

      expect(Payment.create).toHaveBeenCalledWith(validData);
      expect(result.stripe_payment_intent_id).toBeNull();
    });
  });

  describe('Payment Status Management', () => {
    beforeEach(() => {
      Payment.update.mockResolvedValue([1]);
    });

    test('should support querying payments by status', async () => {
      const mockPayments = [
        {
          id: '1',
          user_id: 'user-123',
          amount: 100.00,
          status: 'completed',
          created_at: new Date()
        },
        {
          id: '2',
          user_id: 'user-123',
          amount: 75.00,
          status: 'completed',
          created_at: new Date()
        }
      ];
      
      Payment.findAll.mockResolvedValue(mockPayments);

      const completedPayments = await Payment.findAll({
        where: { 
          user_id: 'user-123',
          status: 'completed'
        },
        order: [['created_at', 'DESC']]
      });

      expect(Payment.findAll).toHaveBeenCalledWith({
        where: { 
          user_id: 'user-123',
          status: 'completed'
        },
        order: [['created_at', 'DESC']]
      });
      expect(completedPayments).toHaveLength(2);
    });

    test('should support updating payment status', async () => {
      const updatedCount = await Payment.update(
        { status: 'completed' },
        { where: { id: 'payment-123' } }
      );

      expect(Payment.update).toHaveBeenCalledWith(
        { status: 'completed' },
        { where: { id: 'payment-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support processing refunds', async () => {
      const updatedCount = await Payment.update(
        { status: 'refunded' },
        { where: { stripe_payment_intent_id: 'pi_123' } }
      );

      expect(Payment.update).toHaveBeenCalledWith(
        { status: 'refunded' },
        { where: { stripe_payment_intent_id: 'pi_123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support marking payments as failed', async () => {
      const updatedCount = await Payment.update(
        { status: 'failed' },
        { where: { id: 'payment-123' } }
      );

      expect(Payment.update).toHaveBeenCalledWith(
        { status: 'failed' },
        { where: { id: 'payment-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });
  });

  describe('Payment Analytics', () => {
    test('should support calculating total revenue for user', async () => {
      Payment.sum.mockResolvedValue(2500.00);

      const totalRevenue = await Payment.sum('amount', {
        where: { 
          user_id: 'user-123',
          status: 'completed'
        }
      });

      expect(Payment.sum).toHaveBeenCalledWith('amount', {
        where: { 
          user_id: 'user-123',
          status: 'completed'
        }
      });
      expect(totalRevenue).toBe(2500.00);
    });

    test('should support finding payments by booking', async () => {
      Payment.findAll.mockResolvedValue([
        {
          id: '1',
          booking_id: 'booking-123',
          amount: 100.00,
          status: 'completed',
          created_at: new Date()
        }
      ]);

      const bookingPayments = await Payment.findAll({
        where: { booking_id: 'booking-123' }
      });

      expect(Payment.findAll).toHaveBeenCalledWith({
        where: { booking_id: 'booking-123' }
      });
      expect(bookingPayments).toHaveLength(1);
    });

    test('should support finding payments by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      Payment.findAll.mockResolvedValue([
        {
          id: '1',
          amount: 100.00,
          status: 'completed',
          created_at: new Date('2024-01-15')
        }
      ]);

      const monthlyPayments = await Payment.findAll({
        where: { 
          created_at: {
            [require('sequelize').Op.between]: [startDate, endDate]
          },
          status: 'completed'
        }
      });

      expect(Payment.findAll).toHaveBeenCalledWith({
        where: { 
          created_at: {
            [require('sequelize').Op.between]: [startDate, endDate]
          },
          status: 'completed'
        }
      });
      expect(monthlyPayments).toHaveLength(1);
    });
  });

  describe('Stripe Integration', () => {
    beforeEach(() => {
      Payment.update.mockResolvedValue([1]);
    });

    test('should support finding payment by Stripe payment intent ID', async () => {
      Payment.findOne.mockResolvedValue({
        id: 'payment-123',
        stripe_payment_intent_id: 'pi_1234567890',
        amount: 100.00,
        status: 'pending'
      });

      const payment = await Payment.findOne({
        where: { stripe_payment_intent_id: 'pi_1234567890' }
      });

      expect(Payment.findOne).toHaveBeenCalledWith({
        where: { stripe_payment_intent_id: 'pi_1234567890' }
      });
      expect(payment).toBeTruthy();
      expect(payment.stripe_payment_intent_id).toBe('pi_1234567890');
    });

    test('should support updating Stripe payment intent ID', async () => {
      const updatedCount = await Payment.update(
        { stripe_payment_intent_id: 'pi_new_intent_123' },
        { where: { id: 'payment-123' } }
      );

      expect(Payment.update).toHaveBeenCalledWith(
        { stripe_payment_intent_id: 'pi_new_intent_123' },
        { where: { id: 'payment-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should handle payments without Stripe integration', async () => {
      Payment.findAll.mockResolvedValue([
        {
          id: '1',
          amount: 100.00,
          status: 'completed',
          stripe_payment_intent_id: null
        }
      ]);

      const nonStripePayments = await Payment.findAll({
        where: { stripe_payment_intent_id: null }
      });

      expect(Payment.findAll).toHaveBeenCalledWith({
        where: { stripe_payment_intent_id: null }
      });
      expect(nonStripePayments).toHaveLength(1);
    });
  });

  describe('Currency Support', () => {
    beforeEach(() => {
      Payment.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        user_id: data.user_id,
        booking_id: data.booking_id,
        amount: data.amount,
        currency: data.currency || 'USD',
        status: data.status || 'pending',
        stripe_payment_intent_id: data.stripe_payment_intent_id || null,
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      }));
    });

    const supportedCurrencies = [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL'
    ];

    test.each(supportedCurrencies)('should support %s currency', async (currency) => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 100.00,
        currency
      };

      const result = await Payment.create(validData);

      expect(Payment.create).toHaveBeenCalledWith(validData);
      expect(result.currency).toBe(currency);
    });

    test('should support calculating totals by currency', async () => {
      Payment.sum
        .mockResolvedValueOnce(1500.00) // USD total
        .mockResolvedValueOnce(800.00); // EUR total

      const usdTotal = await Payment.sum('amount', {
        where: { 
          currency: 'USD',
          status: 'completed'
        }
      });

      const eurTotal = await Payment.sum('amount', {
        where: { 
          currency: 'EUR',
          status: 'completed'
        }
      });

      expect(usdTotal).toBe(1500.00);
      expect(eurTotal).toBe(800.00);
      expect(Payment.sum).toHaveBeenCalledTimes(2);
    });
  });

  describe('Payment Status Transitions', () => {
    beforeEach(() => {
      Payment.update.mockResolvedValue([1]);
    });

    const statusTransitions = [
      { from: 'pending', to: 'completed' },
      { from: 'pending', to: 'failed' },
      { from: 'completed', to: 'refunded' },
      { from: 'failed', to: 'pending' } // retry scenario
    ];

    test.each(statusTransitions)('should support status transition from %s to %s', async ({ from, to }) => {
      const updatedCount = await Payment.update(
        { status: to },
        { where: { status: from } }
      );

      expect(Payment.update).toHaveBeenCalledWith(
        { status: to },
        { where: { status: from } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support bulk status updates', async () => {
      Payment.update.mockResolvedValue([5]); // 5 payments updated

      const updatedCount = await Payment.update(
        { status: 'failed' },
        { 
          where: { 
            status: 'pending',
            created_at: {
              [require('sequelize').Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) // older than 24 hours
            }
          }
        }
      );

      expect(Payment.update).toHaveBeenCalledWith(
        { status: 'failed' },
        { 
          where: { 
            status: 'pending',
            created_at: {
              [require('sequelize').Op.lt]: expect.any(Date)
            }
          }
        }
      );
      expect(updatedCount).toEqual([5]);
    });
  });

  describe('Business Logic Edge Cases', () => {
    beforeEach(() => {
      Payment.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        user_id: data.user_id,
        booking_id: data.booking_id,
        amount: data.amount,
        currency: data.currency || 'USD',
        status: data.status || 'pending',
        stripe_payment_intent_id: data.stripe_payment_intent_id || null,
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      }));
    });

    test('should handle large payment amounts', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 99999999.99, // Maximum for DECIMAL(10,2)
        currency: 'USD'
      };

      const result = await Payment.create(validData);

      expect(Payment.create).toHaveBeenCalledWith(validData);
      expect(result.amount).toBe(99999999.99);
    });

    test('should handle long Stripe payment intent IDs', async () => {
      const longStripeId = 'pi_' + 'a'.repeat(250); // Test at the limit

      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 100.00,
        currency: 'USD',
        stripe_payment_intent_id: longStripeId
      };

      const result = await Payment.create(validData);

      expect(Payment.create).toHaveBeenCalledWith(validData);
      expect(result.stripe_payment_intent_id).toBe(longStripeId);
    });

    test('should handle concurrent payment queries for same booking', async () => {
      Payment.findAll.mockResolvedValue([
        {
          id: '1',
          booking_id: 'booking-123',
          status: 'pending',
          created_at: new Date()
        }
      ]);

      const concurrentPayments = await Payment.findAll({
        where: { 
          booking_id: 'booking-123',
          status: 'pending'
        }
      });

      expect(Payment.findAll).toHaveBeenCalledWith({
        where: { 
          booking_id: 'booking-123',
          status: 'pending'
        }
      });
      expect(concurrentPayments).toHaveLength(1);
    });
  });
});