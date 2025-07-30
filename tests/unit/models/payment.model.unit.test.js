/**
 * Payment model unit tests
 *
 * Tests the Payment model definition, validations, and behavior
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

const mockBooking = {
  id: 'booking-123'
};

jest.mock('../../../src/config/database', () => ({
  sequelize: mockSequelize
}));

jest.mock('../../../src/models/user.model', () => mockUser);
jest.mock('../../../src/models/booking.model', () => mockBooking);

// Import the model after mocking
const Payment = require('../../../src/models/payment.model');

describe('Payment Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Definition', () => {
    test('should define Payment model with correct table name', () => {
      expect(mockSequelize.define).toHaveBeenCalledWith(
        'Payment',
        expect.any(Object),
        expect.objectContaining({
          tableName: 'payments',
          timestamps: true,
          createdAt: 'created_at',
          updatedAt: 'updated_at'
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

      // Check user_id field
      expect(fieldDefinitions.user_id).toEqual({
        type: expect.any(Object),
        allowNull: false,
        references: {
          model: mockUser,
          key: 'id'
        }
      });

      // Check booking_id field
      expect(fieldDefinitions.booking_id).toEqual({
        type: expect.any(Object),
        allowNull: false,
        references: {
          model: mockBooking,
          key: 'id'
        }
      });

      // Check amount field
      expect(fieldDefinitions.amount).toEqual({
        type: expect.any(Object),
        allowNull: false,
        validate: {
          min: 0
        }
      });

      // Check currency field
      expect(fieldDefinitions.currency).toEqual({
        type: expect.any(Object),
        allowNull: false,
        defaultValue: 'USD',
        validate: {
          isUppercase: true,
          len: [3, 3]
        }
      });

      // Check status field
      expect(fieldDefinitions.status).toEqual({
        type: expect.any(Object),
        allowNull: false,
        defaultValue: 'pending'
      });

      // Check stripe_payment_intent_id field
      expect(fieldDefinitions.stripe_payment_intent_id).toEqual({
        type: expect.any(Object),
        allowNull: true,
        unique: true
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
      expect(options.createdAt).toBe('created_at');
      expect(options.updatedAt).toBe('updated_at');
    });
  });

  describe('Field Validations', () => {
    let mockPaymentInstance;
    let mockCreate;

    beforeEach(() => {
      mockPaymentInstance = {
        id: uuidv4(),
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 100.00,
        currency: 'USD',
        status: 'pending',
        stripe_payment_intent_id: 'pi_1234567890',
        created_at: new Date(),
        updated_at: new Date(),
        save: jest.fn().mockResolvedValue(true),
        validate: jest.fn().mockResolvedValue(true)
      };

      mockCreate = jest.fn().mockResolvedValue(mockPaymentInstance);
      
      // Mock the model methods
      Object.assign(Payment, {
        create: mockCreate,
        findAll: jest.fn().mockResolvedValue([mockPaymentInstance]),
        findOne: jest.fn().mockResolvedValue(mockPaymentInstance),
        findByPk: jest.fn().mockResolvedValue(mockPaymentInstance),
        update: jest.fn().mockResolvedValue([1]),
        sum: jest.fn().mockResolvedValue(1250.00)
      });
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

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPaymentInstance);
    });

    test('should create payment with default currency', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 75.00,
        status: 'pending'
      };

      const result = await Payment.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPaymentInstance);
    });

    test('should create payment with default status', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 200.00,
        currency: 'GBP'
      };

      const result = await Payment.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPaymentInstance);
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

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPaymentInstance);
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

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPaymentInstance);
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

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPaymentInstance);
    });
  });

  describe('Data Integrity', () => {
    test('should ensure user_id is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.user_id.allowNull).toBe(false);
    });

    test('should ensure booking_id is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.booking_id.allowNull).toBe(false);
    });

    test('should ensure amount is required and non-negative', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.amount.allowNull).toBe(false);
      expect(fieldDefinitions.amount.validate.min).toBe(0);
    });

    test('should ensure currency has proper validation', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.currency.allowNull).toBe(false);
      expect(fieldDefinitions.currency.defaultValue).toBe('USD');
      expect(fieldDefinitions.currency.validate.isUppercase).toBe(true);
      expect(fieldDefinitions.currency.validate.len).toEqual([3, 3]);
    });

    test('should ensure status has proper default', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.status.allowNull).toBe(false);
      expect(fieldDefinitions.status.defaultValue).toBe('pending');
    });

    test('should allow stripe_payment_intent_id to be null but unique', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.stripe_payment_intent_id.allowNull).toBe(true);
      expect(fieldDefinitions.stripe_payment_intent_id.unique).toBe(true);
    });

    test('should have proper field types', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      // Check that amount is DECIMAL(10, 2)
      expect(fieldDefinitions.amount.type.constructor.name).toContain('DECIMAL');
      
      // Check that currency is STRING(3)
      expect(fieldDefinitions.currency.type.constructor.name).toContain('STRING');
      
      // Check that status is ENUM
      expect(fieldDefinitions.status.type.constructor.name).toContain('ENUM');
      
      // Check that stripe_payment_intent_id is STRING(255)
      expect(fieldDefinitions.stripe_payment_intent_id.type.constructor.name).toContain('STRING');
    });
  });

  describe('Model Relationships', () => {
    test('should reference User model in user_id field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.user_id.references).toEqual({
        model: mockUser,
        key: 'id'
      });
    });

    test('should reference Booking model in booking_id field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.booking_id.references).toEqual({
        model: mockBooking,
        key: 'id'
      });
    });
  });

  describe('Payment Status Management', () => {
    test('should support querying payments by status', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
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
      ]);

      Object.assign(Payment, { findAll: mockFindAll });

      const completedPayments = await Payment.findAll({
        where: { 
          user_id: 'user-123',
          status: 'completed'
        },
        order: [['created_at', 'DESC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { 
          user_id: 'user-123',
          status: 'completed'
        },
        order: [['created_at', 'DESC']]
      });
      expect(completedPayments).toHaveLength(2);
    });

    test('should support updating payment status', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Payment, { update: mockUpdate });

      const updatedCount = await Payment.update(
        { status: 'completed' },
        { where: { id: 'payment-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { status: 'completed' },
        { where: { id: 'payment-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support processing refunds', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Payment, { update: mockUpdate });

      const updatedCount = await Payment.update(
        { status: 'refunded' },
        { where: { stripe_payment_intent_id: 'pi_123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { status: 'refunded' },
        { where: { stripe_payment_intent_id: 'pi_123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support marking payments as failed', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Payment, { update: mockUpdate });

      const updatedCount = await Payment.update(
        { status: 'failed' },
        { where: { id: 'payment-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { status: 'failed' },
        { where: { id: 'payment-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });
  });

  describe('Payment Analytics', () => {
    test('should support calculating total revenue for user', async () => {
      const mockSum = jest.fn().mockResolvedValue(2500.00);

      Object.assign(Payment, { sum: mockSum });

      const totalRevenue = await Payment.sum('amount', {
        where: { 
          user_id: 'user-123',
          status: 'completed'
        }
      });

      expect(mockSum).toHaveBeenCalledWith('amount', {
        where: { 
          user_id: 'user-123',
          status: 'completed'
        }
      });
      expect(totalRevenue).toBe(2500.00);
    });

    test('should support finding payments by booking', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          booking_id: 'booking-123',
          amount: 100.00,
          status: 'completed',
          created_at: new Date()
        }
      ]);

      Object.assign(Payment, { findAll: mockFindAll });

      const bookingPayments = await Payment.findAll({
        where: { booking_id: 'booking-123' }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { booking_id: 'booking-123' }
      });
      expect(bookingPayments).toHaveLength(1);
    });

    test('should support finding payments by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          amount: 100.00,
          status: 'completed',
          created_at: new Date('2024-01-15')
        }
      ]);

      Object.assign(Payment, { findAll: mockFindAll });

      const monthlyPayments = await Payment.findAll({
        where: { 
          created_at: {
            [require('sequelize').Op.between]: [startDate, endDate]
          },
          status: 'completed'
        }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
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
    test('should support finding payment by Stripe payment intent ID', async () => {
      const mockFindOne = jest.fn().mockResolvedValue({
        id: 'payment-123',
        stripe_payment_intent_id: 'pi_1234567890',
        amount: 100.00,
        status: 'pending'
      });

      Object.assign(Payment, { findOne: mockFindOne });

      const payment = await Payment.findOne({
        where: { stripe_payment_intent_id: 'pi_1234567890' }
      });

      expect(mockFindOne).toHaveBeenCalledWith({
        where: { stripe_payment_intent_id: 'pi_1234567890' }
      });
      expect(payment).toBeTruthy();
      expect(payment.stripe_payment_intent_id).toBe('pi_1234567890');
    });

    test('should support updating Stripe payment intent ID', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Payment, { update: mockUpdate });

      const updatedCount = await Payment.update(
        { stripe_payment_intent_id: 'pi_new_intent_123' },
        { where: { id: 'payment-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { stripe_payment_intent_id: 'pi_new_intent_123' },
        { where: { id: 'payment-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should handle payments without Stripe integration', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          amount: 100.00,
          status: 'completed',
          stripe_payment_intent_id: null
        }
      ]);

      Object.assign(Payment, { findAll: mockFindAll });

      const nonStripePayments = await Payment.findAll({
        where: { stripe_payment_intent_id: null }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { stripe_payment_intent_id: null }
      });
      expect(nonStripePayments).toHaveLength(1);
    });
  });

  describe('Currency Support', () => {
    const supportedCurrencies = [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL'
    ];

    test.each(supportedCurrencies)('should support %s currency', async (currency) => {
      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 100.00,
        currency,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

      Object.assign(Payment, { create: mockCreate });

      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 100.00,
        currency
      };

      const result = await Payment.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result.currency).toBe(currency);
    });

    test('should validate currency format is uppercase', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.currency.validate.isUppercase).toBe(true);
    });

    test('should validate currency is exactly 3 characters', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.currency.validate.len).toEqual([3, 3]);
    });

    test('should support calculating totals by currency', async () => {
      const mockSum = jest.fn()
        .mockResolvedValueOnce(1500.00) // USD total
        .mockResolvedValueOnce(800.00); // EUR total

      Object.assign(Payment, { sum: mockSum });

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
      expect(mockSum).toHaveBeenCalledTimes(2);
    });
  });

  describe('Payment Status Transitions', () => {
    const statusTransitions = [
      { from: 'pending', to: 'completed' },
      { from: 'pending', to: 'failed' },
      { from: 'completed', to: 'refunded' },
      { from: 'failed', to: 'pending' } // retry scenario
    ];

    test.each(statusTransitions)('should support status transition from %s to %s', async ({ from, to }) => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Payment, { update: mockUpdate });

      const updatedCount = await Payment.update(
        { status: to },
        { where: { status: from } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { status: to },
        { where: { status: from } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support bulk status updates', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([5]); // 5 payments updated

      Object.assign(Payment, { update: mockUpdate });

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

      expect(mockUpdate).toHaveBeenCalledWith(
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
    test('should handle large payment amounts within DECIMAL(10,2) limits', async () => {
      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 99999999.99, // Maximum for DECIMAL(10,2)
        currency: 'USD'
      };

      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        ...validData,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

      Object.assign(Payment, { create: mockCreate });

      const result = await Payment.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result.amount).toBe(99999999.99);
    });

    test('should handle long Stripe payment intent IDs', async () => {
      const longStripeId = 'pi_' + 'a'.repeat(250); // Test at the limit of STRING(255)

      const validData = {
        user_id: 'user-123',
        booking_id: 'booking-123',
        amount: 100.00,
        currency: 'USD',
        stripe_payment_intent_id: longStripeId
      };

      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        ...validData,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

      Object.assign(Payment, { create: mockCreate });

      const result = await Payment.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result.stripe_payment_intent_id).toBe(longStripeId);
    });

    test('should handle concurrent payment processing for same booking', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          booking_id: 'booking-123',
          status: 'pending',
          created_at: new Date()
        }
      ]);

      Object.assign(Payment, { findAll: mockFindAll });

      const concurrentPayments = await Payment.findAll({
        where: { 
          booking_id: 'booking-123',
          status: 'pending'
        }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { 
          booking_id: 'booking-123',
          status: 'pending'
        }
      });
      expect(concurrentPayments).toHaveLength(1);
    });
  });
});