/**
 * Stripe service unit tests
 *
 * Tests for Stripe integration service
 *
 * @author meetabl Team
 */

// Mock dependencies before imports
jest.mock('stripe', () => {
  const mockStripe = {
    webhooks: {
      constructEvent: jest.fn()
    }
  };
  return jest.fn(() => mockStripe);
});

jest.mock('../../../src/config/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../src/utils/errors', () => ({
  AppError: class AppError extends Error {
    constructor(message, statusCode = 500, metadata = {}) {
      super(message);
      this.statusCode = statusCode;
      this.metadata = metadata;
      this.name = 'AppError';
    }
  }
}));

jest.mock('../../../src/config/stripe-products', () => ({
  TRIAL: {
    DAYS: 14
  }
}));

const Stripe = require('stripe');
const { AppError } = require('../../../src/utils/errors');

// Import service after mocks
const stripeService = require('../../../src/services/stripe.service');

describe('StripeService', () => {
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = process.env;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset process.env for each test
    process.env = { ...originalEnv };
    
    // Reset service state
    stripeService.stripe = null;
    stripeService.initialized = false;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('initialize', () => {
    test('should initialize Stripe with API key', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
      
      const mockStripeInstance = { test: 'mock' };
      Stripe.mockReturnValue(mockStripeInstance);

      stripeService.initialize();

      expect(Stripe).toHaveBeenCalledWith('sk_test_12345', {
        apiVersion: '2023-10-16',
        maxNetworkRetries: 2,
        timeout: 30000,
        telemetry: false
      });
      expect(stripeService.stripe).toBe(mockStripeInstance);
      expect(stripeService.initialized).toBe(true);
    });

    test('should use fallback API key if STRIPE_SECRET_KEY not available', () => {
      process.env.STRIPE_API_KEY = 'sk_test_fallback';
      delete process.env.STRIPE_SECRET_KEY;

      stripeService.initialize();

      expect(Stripe).toHaveBeenCalledWith('sk_test_fallback', expect.any(Object));
    });

    test('should throw error if no API key configured', () => {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_API_KEY;

      expect(() => stripeService.initialize()).toThrow(AppError);
      expect(() => stripeService.initialize()).toThrow('Stripe API key not configured');
    });

    test('should not reinitialize if already initialized', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
      
      stripeService.initialize();
      const firstStripeInstance = stripeService.stripe;
      
      stripeService.initialize();
      
      expect(stripeService.stripe).toBe(firstStripeInstance);
      expect(Stripe).toHaveBeenCalledTimes(1);
    });

    test('should handle Stripe initialization errors', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
      
      Stripe.mockImplementation(() => {
        throw new Error('Stripe initialization failed');
      });

      expect(() => stripeService.initialize()).toThrow(AppError);
      expect(() => stripeService.initialize()).toThrow('Failed to initialize payment service');
    });
  });

  describe('getStripe', () => {
    test('should return Stripe instance after initialization', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
      
      const mockStripeInstance = { test: 'mock' };
      Stripe.mockReturnValue(mockStripeInstance);

      const stripe = stripeService.getStripe();

      expect(stripe).toBe(mockStripeInstance);
      expect(stripeService.initialized).toBe(true);
    });

    test('should initialize if not already initialized', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
      
      const mockStripeInstance = { test: 'mock' };
      Stripe.mockReturnValue(mockStripeInstance);

      expect(stripeService.initialized).toBe(false);
      
      const stripe = stripeService.getStripe();

      expect(stripe).toBe(mockStripeInstance);
      expect(stripeService.initialized).toBe(true);
    });
  });

  describe('verifyWebhookSignature', () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
      
      const mockStripeInstance = {
        webhooks: {
          constructEvent: jest.fn()
        }
      };
      Stripe.mockReturnValue(mockStripeInstance);
      stripeService.initialize();
    });

    test('should verify webhook signature successfully', () => {
      const mockEvent = { id: 'evt_test', type: 'payment_intent.succeeded' };
      stripeService.stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = stripeService.verifyWebhookSignature('payload', 'signature');

      expect(stripeService.stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_test'
      );
      expect(result).toEqual(mockEvent);
    });

    test('should throw error if webhook secret not configured', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      expect(() => stripeService.verifyWebhookSignature('payload', 'signature'))
        .toThrow(AppError);
      expect(() => stripeService.verifyWebhookSignature('payload', 'signature'))
        .toThrow('Stripe webhook secret not configured');
    });

    test('should handle signature verification errors', () => {
      stripeService.stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => stripeService.verifyWebhookSignature('payload', 'invalid-signature'))
        .toThrow(AppError);
      expect(() => stripeService.verifyWebhookSignature('payload', 'invalid-signature'))
        .toThrow('Invalid webhook signature');
    });
  });

  describe('handleStripeError', () => {
    test('should handle card declined error', () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'card_declined',
        message: 'Your card was declined.'
      };

      const result = stripeService.handleStripeError(stripeError);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Your card was declined. Please try a different payment method.');
      expect(result.statusCode).toBe(400);
      expect(result.metadata.stripeError).toBe('StripeCardError');
    });

    test('should handle insufficient funds error', () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'insufficient_funds',
        message: 'Your card has insufficient funds.'
      };

      const result = stripeService.handleStripeError(stripeError);

      expect(result.message).toBe('Your card has insufficient funds.');
      expect(result.statusCode).toBe(400);
    });

    test('should handle rate limit error', () => {
      const stripeError = {
        type: 'StripeRateLimitError',
        message: 'Too many requests.'
      };

      const result = stripeService.handleStripeError(stripeError);

      expect(result.message).toBe('Too many requests. Please try again later.');
      expect(result.statusCode).toBe(429);
    });

    test('should handle API error', () => {
      const stripeError = {
        type: 'StripeAPIError',
        message: 'API error occurred.'
      };

      const result = stripeService.handleStripeError(stripeError);

      expect(result.message).toBe('A payment service error occurred. Please try again later.');
      expect(result.statusCode).toBe(400);
    });

    test('should handle unknown card error with fallback', () => {
      const stripeError = {
        type: 'StripeCardError',
        code: 'unknown_error',
        message: 'Unknown card error.'
      };

      const result = stripeService.handleStripeError(stripeError);

      expect(result.message).toBe('An error occurred while processing your card. Please try again.');
      expect(result.statusCode).toBe(400);
    });

    test('should handle unknown error type', () => {
      const stripeError = {
        type: 'UnknownError',
        message: 'Unknown error occurred.'
      };

      const result = stripeService.handleStripeError(stripeError);

      expect(result.message).toBe('An error occurred processing your request.');
      expect(result.statusCode).toBe(500);
    });
  });

  describe('formatAmount', () => {
    test('should format USD amount to cents', () => {
      const result = stripeService.formatAmount(10.99, 'usd');
      expect(result).toBe(1099);
    });

    test('should format amount with default currency', () => {
      const result = stripeService.formatAmount(25.50);
      expect(result).toBe(2550);
    });

    test('should handle zero decimal currencies', () => {
      const result = stripeService.formatAmount(1000, 'jpy');
      expect(result).toBe(1000);
    });

    test('should handle zero decimal currencies case insensitive', () => {
      const result = stripeService.formatAmount(1000, 'JPY');
      expect(result).toBe(1000);
    });

    test('should round fractional cents', () => {
      const result = stripeService.formatAmount(10.999, 'usd');
      expect(result).toBe(1100);
    });

    test('should handle all zero decimal currencies', () => {
      const zeroDecimalCurrencies = ['jpy', 'krw', 'vnd', 'clp', 'pyg', 'xaf', 'xof', 'xpf'];
      
      zeroDecimalCurrencies.forEach(currency => {
        const result = stripeService.formatAmount(1000, currency);
        expect(result).toBe(1000);
      });
    });
  });

  describe('parseAmount', () => {
    test('should parse USD amount from cents', () => {
      const result = stripeService.parseAmount(1099, 'usd');
      expect(result).toBe(10.99);
    });

    test('should parse amount with default currency', () => {
      const result = stripeService.parseAmount(2550);
      expect(result).toBe(25.50);
    });

    test('should handle zero decimal currencies', () => {
      const result = stripeService.parseAmount(1000, 'jpy');
      expect(result).toBe(1000);
    });

    test('should handle zero decimal currencies case insensitive', () => {
      const result = stripeService.parseAmount(1000, 'JPY');
      expect(result).toBe(1000);
    });
  });

  describe('createIdempotencyKey', () => {
    test('should create idempotency key with prefix', () => {
      const result = stripeService.createIdempotencyKey('payment');
      
      expect(result).toMatch(/^payment-\d+-[a-z0-9]{7}$/);
    });

    test('should create idempotency key with additional parts', () => {
      const result = stripeService.createIdempotencyKey('payment', 'user-123', 'booking-456');
      
      expect(result).toMatch(/^payment-user-123-booking-456-\d+-[a-z0-9]{7}$/);
    });

    test('should create unique keys', () => {
      const key1 = stripeService.createIdempotencyKey('test');
      const key2 = stripeService.createIdempotencyKey('test');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('isSuperAdmin', () => {
    test('should return true for super admin user', () => {
      const user = { id: 'user-1', is_super_admin: true };
      
      const result = stripeService.isSuperAdmin(user);
      
      expect(result).toBe(true);
    });

    test('should return false for regular user', () => {
      const user = { id: 'user-1', is_super_admin: false };
      
      const result = stripeService.isSuperAdmin(user);
      
      expect(result).toBe(false);
    });

    test('should return false for user without is_super_admin field', () => {
      const user = { id: 'user-1' };
      
      const result = stripeService.isSuperAdmin(user);
      
      expect(result).toBe(false);
    });

    test('should return falsy for null user', () => {
      const result = stripeService.isSuperAdmin(null);
      
      expect(result).toBeFalsy();
    });
  });

  describe('hasActiveSubscription', () => {
    test('should return true for super admin', () => {
      const user = { id: 'user-1', is_super_admin: true };
      
      const result = stripeService.hasActiveSubscription(user);
      
      expect(result).toBe(true);
    });

    test('should return true for active subscription', () => {
      const user = { 
        id: 'user-1', 
        is_super_admin: false,
        stripe_subscription_status: 'active'
      };
      
      const result = stripeService.hasActiveSubscription(user);
      
      expect(result).toBe(true);
    });

    test('should return true for trialing subscription', () => {
      const user = { 
        id: 'user-1', 
        is_super_admin: false,
        stripe_subscription_status: 'trialing'
      };
      
      const result = stripeService.hasActiveSubscription(user);
      
      expect(result).toBe(true);
    });

    test('should return false for canceled subscription', () => {
      const user = { 
        id: 'user-1', 
        is_super_admin: false,
        stripe_subscription_status: 'canceled'
      };
      
      const result = stripeService.hasActiveSubscription(user);
      
      expect(result).toBe(false);
    });

    test('should return false for user without subscription status', () => {
      const user = { 
        id: 'user-1', 
        is_super_admin: false
      };
      
      const result = stripeService.hasActiveSubscription(user);
      
      expect(result).toBe(false);
    });
  });

  describe('isInTrial', () => {
    test('should return true for trialing subscription', () => {
      const user = { 
        id: 'user-1',
        stripe_subscription_status: 'trialing'
      };
      
      const result = stripeService.isInTrial(user);
      
      expect(result).toBe(true);
    });

    test('should return false for active subscription', () => {
      const user = { 
        id: 'user-1',
        stripe_subscription_status: 'active'
      };
      
      const result = stripeService.isInTrial(user);
      
      expect(result).toBe(false);
    });

    test('should return false for canceled subscription', () => {
      const user = { 
        id: 'user-1',
        stripe_subscription_status: 'canceled'
      };
      
      const result = stripeService.isInTrial(user);
      
      expect(result).toBe(false);
    });
  });

  describe('calculateTrialEnd', () => {
    test('should calculate trial end date', () => {
      const now = new Date('2024-01-01T00:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now);

      const result = stripeService.calculateTrialEnd();

      const expected = new Date('2024-01-15T00:00:00Z'); // 14 days later
      expect(result).toEqual(expected);

      global.Date.mockRestore();
    });

    test('should handle month boundaries', () => {
      const now = new Date('2024-01-30T00:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now);

      const result = stripeService.calculateTrialEnd();

      const expected = new Date('2024-02-13T00:00:00Z'); // 14 days later
      expect(result).toEqual(expected);

      global.Date.mockRestore();
    });
  });
});