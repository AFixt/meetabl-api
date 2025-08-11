/**
 * Subscription service unit tests
 *
 * Tests for subscription management and feature access control
 *
 * @author meetabl Team
 */

// Mock dependencies before imports
jest.mock('../../../src/config/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }))
}));

jest.mock('../../../src/models', () => ({
  User: {
    findByPk: jest.fn()
  }
}));

jest.mock('../../../src/services/stripe.service', () => ({
  getActiveSubscription: jest.fn()
}));

const { User } = require('../../../src/models');
const stripeService = require('../../../src/services/stripe.service');

// Import service after mocks
const subscriptionService = require('../../../src/services/subscription.service');

describe('SubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkFeatureAccess', () => {
    test('should grant access to basic features for basic tier', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic',
        stripe_customer_id: null
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const hasAccess = await subscriptionService.checkFeatureAccess('user-1', 'booking');

      expect(hasAccess).toBe(true);
      expect(User.findByPk).toHaveBeenCalledWith('user-1');
    });

    test('should deny access to advanced features for basic tier', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic',
        stripe_customer_id: null
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const hasAccess = await subscriptionService.checkFeatureAccess('user-1', 'teams');

      expect(hasAccess).toBe(false);
    });

    test('should grant access to advanced features for professional tier', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Professional',
        stripe_customer_id: null
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const hasAccess = await subscriptionService.checkFeatureAccess('user-1', 'teams');

      expect(hasAccess).toBe(true);
    });

    test('should grant access to all features for enterprise tier', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Enterprise',
        stripe_customer_id: null
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const hasAccess = await subscriptionService.checkFeatureAccess('user-1', 'sso');

      expect(hasAccess).toBe(true);
    });

    test('should check Stripe subscription for users with stripe_customer_id', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic',
        stripe_customer_id: 'cus_123'
      };

      const mockSubscription = {
        status: 'active',
        items: {
          data: [{
            price: {
              metadata: {
                tier: 'professional'
              }
            }
          }]
        }
      };

      User.findByPk.mockResolvedValueOnce(mockUser);
      stripeService.getActiveSubscription.mockResolvedValueOnce(mockSubscription);

      const hasAccess = await subscriptionService.checkFeatureAccess('user-1', 'teams');

      expect(hasAccess).toBe(true);
      expect(stripeService.getActiveSubscription).toHaveBeenCalledWith('cus_123');
    });

    test('should fallback to local data if Stripe fails', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Professional',
        stripe_customer_id: 'cus_123'
      };

      User.findByPk.mockResolvedValueOnce(mockUser);
      stripeService.getActiveSubscription.mockRejectedValueOnce(new Error('Stripe error'));

      const hasAccess = await subscriptionService.checkFeatureAccess('user-1', 'teams');

      expect(hasAccess).toBe(true);
    });

    test('should return false for non-existent user', async () => {
      User.findByPk.mockResolvedValueOnce(null);

      const hasAccess = await subscriptionService.checkFeatureAccess('non-existent', 'booking');

      expect(hasAccess).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      User.findByPk.mockRejectedValueOnce(new Error('Database error'));

      const hasAccess = await subscriptionService.checkFeatureAccess('user-1', 'booking');

      expect(hasAccess).toBe(false);
    });

    test('should default to basic tier for unknown subscription plans', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'UnknownPlan',
        stripe_customer_id: null
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const hasAccess = await subscriptionService.checkFeatureAccess('user-1', 'teams');

      expect(hasAccess).toBe(false); // teams not in basic tier
    });

    test('should handle users without subscription_plan', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: null,
        stripe_customer_id: null
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const hasAccess = await subscriptionService.checkFeatureAccess('user-1', 'booking');

      expect(hasAccess).toBe(true); // booking is in basic tier (default)
    });
  });

  describe('checkUsageLimit', () => {
    test('should allow usage within limits for basic tier', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic'
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const result = await subscriptionService.checkUsageLimit('user-1', 'bookings_per_month', 25);

      expect(result).toEqual({
        allowed: true,
        limit: 50,
        remaining: 25,
        usage: 25
      });
    });

    test('should deny usage when limit exceeded', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic'
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const result = await subscriptionService.checkUsageLimit('user-1', 'bookings_per_month', 55);

      expect(result).toEqual({
        allowed: false,
        limit: 50,
        remaining: 0,
        usage: 55
      });
    });

    test('should handle unlimited usage for enterprise tier', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Enterprise'
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const result = await subscriptionService.checkUsageLimit('user-1', 'bookings_per_month', 1000);

      expect(result).toEqual({
        allowed: true,
        limit: 'unlimited',
        remaining: 'unlimited'
      });
    });

    test('should return no access for non-existent user', async () => {
      User.findByPk.mockResolvedValueOnce(null);

      const result = await subscriptionService.checkUsageLimit('non-existent', 'bookings_per_month', 10);

      expect(result).toEqual({
        allowed: false,
        limit: 0,
        remaining: 0
      });
    });

    test('should handle database errors', async () => {
      User.findByPk.mockRejectedValueOnce(new Error('Database error'));

      const result = await subscriptionService.checkUsageLimit('user-1', 'bookings_per_month', 10);

      expect(result).toEqual({
        allowed: false,
        limit: 0,
        remaining: 0
      });
    });

    test('should use default usage of 0 when not provided', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic'
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const result = await subscriptionService.checkUsageLimit('user-1', 'bookings_per_month');

      expect(result).toEqual({
        allowed: true,
        limit: 50,
        remaining: 50,
        usage: 0
      });
    });
  });

  describe('getSubscriptionDetails', () => {
    test('should return subscription details from Stripe for active subscription', async () => {
      const mockUser = {
        id: 'user-1',
        stripe_customer_id: 'cus_123',
        update: jest.fn().mockResolvedValue(true)
      };

      const mockSubscription = {
        status: 'active',
        current_period_end: 1640995200, // Unix timestamp
        currency: 'usd',
        items: {
          data: [{
            price: {
              unit_amount: 2999,
              metadata: {
                tier: 'professional'
              },
              recurring: {
                interval: 'month'
              }
            }
          }]
        }
      };

      User.findByPk.mockResolvedValueOnce(mockUser);
      stripeService.getActiveSubscription.mockResolvedValueOnce(mockSubscription);

      const result = await subscriptionService.getSubscriptionDetails('user-1');

      expect(result).toEqual({
        plan: 'Professional',
        status: 'active',
        endDate: new Date(1640995200 * 1000),
        features: expect.arrayContaining(['booking', 'teams', 'analytics']),
        limits: expect.objectContaining({
          bookings_per_month: 500,
          team_members: 5
        }),
        billing: {
          amount: 29.99,
          currency: 'usd',
          interval: 'month'
        }
      });

      expect(mockUser.update).toHaveBeenCalledWith({
        subscription_plan: 'Professional',
        subscription_status: 'active',
        subscription_end_date: new Date(1640995200 * 1000)
      });
    });

    test('should fallback to local data when Stripe fails', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Professional',
        subscription_status: 'active',
        subscription_end_date: new Date('2024-12-31'),
        stripe_customer_id: 'cus_123'
      };

      User.findByPk.mockResolvedValueOnce(mockUser);
      stripeService.getActiveSubscription.mockRejectedValueOnce(new Error('Stripe error'));

      const result = await subscriptionService.getSubscriptionDetails('user-1');

      expect(result).toEqual({
        plan: 'Professional',
        status: 'active',
        endDate: new Date('2024-12-31'),
        features: expect.arrayContaining(['booking', 'teams', 'analytics']),
        limits: expect.objectContaining({
          bookings_per_month: 500,
          team_members: 5
        })
      });
    });

    test('should use local data for users without Stripe customer ID', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic',
        subscription_status: 'active',
        subscription_end_date: new Date('2024-12-31'),
        stripe_customer_id: null
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const result = await subscriptionService.getSubscriptionDetails('user-1');

      expect(result).toEqual({
        plan: 'Basic',
        status: 'active',
        endDate: new Date('2024-12-31'),
        features: expect.arrayContaining(['booking', 'calendar']),
        limits: expect.objectContaining({
          bookings_per_month: 50,
          team_members: 0
        })
      });
    });

    test('should default to basic tier for users without subscription plan', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: null,
        subscription_status: 'active',
        stripe_customer_id: null
      };

      User.findByPk.mockResolvedValueOnce(mockUser);

      const result = await subscriptionService.getSubscriptionDetails('user-1');

      expect(result.plan).toBe('Basic');
      expect(result.features).toContain('booking');
      expect(result.limits.bookings_per_month).toBe(50);
    });

    test('should throw error for non-existent user', async () => {
      User.findByPk.mockResolvedValueOnce(null);

      await expect(subscriptionService.getSubscriptionDetails('non-existent')).rejects.toThrow('User not found');
    });

    test('should handle database errors', async () => {
      User.findByPk.mockRejectedValueOnce(new Error('Database error'));

      await expect(subscriptionService.getSubscriptionDetails('user-1')).rejects.toThrow('Database error');
    });
  });

  describe('getAvailablePlans', () => {
    test('should return all available subscription plans', () => {
      const plans = subscriptionService.getAvailablePlans();

      expect(plans).toHaveLength(3);
      expect(plans).toEqual([
        {
          id: 'basic',
          name: 'Basic',
          features: expect.arrayContaining(['booking', 'calendar']),
          limits: expect.objectContaining({
            bookings_per_month: 50,
            team_members: 0
          })
        },
        {
          id: 'professional',
          name: 'Professional',
          features: expect.arrayContaining(['booking', 'teams', 'analytics']),
          limits: expect.objectContaining({
            bookings_per_month: 500,
            team_members: 5
          })
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          features: expect.arrayContaining(['booking', 'sso', 'audit_logs']),
          limits: expect.objectContaining({
            bookings_per_month: -1,
            team_members: -1
          })
        }
      ]);
    });
  });

  describe('requireFeature middleware', () => {
    test('should allow access when user has required feature', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Professional'
      };

      const req = { user: mockUser };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      User.findByPk.mockResolvedValueOnce(mockUser);

      const middleware = subscriptionService.requireFeature('teams');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access when user lacks required feature', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic'
      };

      const req = { user: mockUser };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      User.findByPk.mockResolvedValueOnce(mockUser);

      const middleware = subscriptionService.requireFeature('teams');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Feature not available',
        message: 'Your subscription plan does not include access to teams',
        requiredFeature: 'teams',
        currentPlan: 'Basic'
      });
    });

    test('should return 401 for unauthenticated requests', async () => {
      const req = { user: null };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = subscriptionService.requireFeature('teams');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    test('should handle errors gracefully', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Professional'
      };

      const req = { user: mockUser };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      User.findByPk.mockRejectedValueOnce(new Error('Database error'));

      const middleware = subscriptionService.requireFeature('teams');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403); // checkFeatureAccess returns false on error
      expect(res.json).toHaveBeenCalledWith({
        error: 'Feature not available',
        message: 'Your subscription plan does not include access to teams',
        requiredFeature: 'teams',
        currentPlan: 'Professional'
      });
    });
  });

  describe('requireWithinLimit middleware', () => {
    test('should allow access when within usage limits', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic'
      };

      const req = { user: mockUser };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      const getUsage = jest.fn().mockResolvedValue(25);

      User.findByPk.mockResolvedValueOnce(mockUser);

      const middleware = subscriptionService.requireWithinLimit('bookings_per_month', getUsage);
      await middleware(req, res, next);

      expect(getUsage).toHaveBeenCalledWith(req);
      expect(next).toHaveBeenCalled();
      expect(req.usageLimit).toEqual({
        allowed: true,
        limit: 50,
        remaining: 25,
        usage: 25
      });
    });

    test('should deny access when usage limit exceeded', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic'
      };

      const req = { user: mockUser };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      const getUsage = jest.fn().mockResolvedValue(55);

      User.findByPk.mockResolvedValueOnce(mockUser);

      const middleware = subscriptionService.requireWithinLimit('bookings_per_month', getUsage);
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Usage limit exceeded',
        message: 'You have reached your bookings per_month limit',
        limit: 50,
        usage: 55,
        currentPlan: 'Basic'
      });
    });

    test('should return 401 for unauthenticated requests', async () => {
      const req = { user: null };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      const getUsage = jest.fn();

      const middleware = subscriptionService.requireWithinLimit('bookings_per_month', getUsage);
      await middleware(req, res, next);

      expect(getUsage).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    test('should handle errors gracefully', async () => {
      const mockUser = {
        id: 'user-1',
        subscription_plan: 'Basic'
      };

      const req = { user: mockUser };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      const getUsage = jest.fn().mockRejectedValue(new Error('Usage calculation error'));

      const middleware = subscriptionService.requireWithinLimit('bookings_per_month', getUsage);
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to verify usage limits' });
    });
  });
});