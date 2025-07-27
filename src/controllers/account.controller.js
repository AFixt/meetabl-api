/**
 * Account Management Controller
 * 
 * Handles subscription, billing, and account-related operations
 * 
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { User, AuditLog } = require('../models');
const stripeService = require('../services/stripe.service');
const stripeSubscriptionService = require('../services/stripe-subscription.service');
const stripeCustomerService = require('../services/stripe-customer.service');
const stripeBillingService = require('../services/stripe-billing.service');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const { asyncHandler, successResponse, notFoundError, validationError, createError, forbiddenError } = require('../utils/error-response');

/**
 * Get current subscription details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSubscription = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user with fresh data
    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Get detailed subscription status
    const subscriptionStatus = await stripeSubscriptionService.getSubscriptionStatus(user);
    
    // Get upcoming invoice if user has active subscription
    let upcomingInvoice = null;
    if (subscriptionStatus.has_access && user.stripe_subscription_id) {
      try {
        upcomingInvoice = await stripeSubscriptionService.getUpcomingInvoice(user);
      } catch (error) {
        logger.warn(`Could not retrieve upcoming invoice for user ${userId}:`, error.message);
      }
    }

    // Get payment method if customer exists
    let defaultPaymentMethod = null;
    if (user.stripe_customer_id) {
      try {
        defaultPaymentMethod = await stripeCustomerService.getDefaultPaymentMethod(user.stripe_customer_id);
      } catch (error) {
        logger.warn(`Could not retrieve payment method for user ${userId}:`, error.message);
      }
    }

    const responseData = {
      subscription: subscriptionStatus,
      upcoming_invoice: upcomingInvoice ? {
        amount_due: stripeService.parseAmount(upcomingInvoice.amount_due, upcomingInvoice.currency),
        currency: upcomingInvoice.currency,
        period_start: new Date(upcomingInvoice.period_start * 1000),
        period_end: new Date(upcomingInvoice.period_end * 1000),
        due_date: upcomingInvoice.due_date ? new Date(upcomingInvoice.due_date * 1000) : null
      } : null,
      payment_method: defaultPaymentMethod ? {
        id: defaultPaymentMethod.id,
        type: defaultPaymentMethod.type,
        card: defaultPaymentMethod.card ? {
          brand: defaultPaymentMethod.card.brand,
          last4: defaultPaymentMethod.card.last4,
          exp_month: defaultPaymentMethod.card.exp_month,
          exp_year: defaultPaymentMethod.card.exp_year
        } : null
      } : null,
      stripe_customer_id: user.stripe_customer_id
    };

    return successResponse(res, responseData, 'Subscription details retrieved successfully');
  } catch (error) {
    logger.error('Error getting subscription details:', error);
    throw error;
  }
});

/**
 * Upgrade subscription plan
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const upgradeSubscription = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { price_id, payment_method_id } = req.body;

    if (!price_id) {
      throw validationError([{ field: 'price_id', message: 'Price ID is required' }]);
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Super admins don't need subscriptions
    if (stripeService.isSuperAdmin(user)) {
      throw forbiddenError('Super admin accounts do not require subscriptions');
    }

    let result;

    if (user.stripe_subscription_id) {
      // Change existing subscription
      result = await stripeSubscriptionService.changeSubscriptionPlan(user, price_id);
    } else {
      // Create new subscription
      if (payment_method_id) {
        // Create subscription with specific payment method
        result = await stripeSubscriptionService.createSubscription(user, price_id, {
          default_payment_method: payment_method_id
        });
      } else {
        // Create checkout session for payment collection
        const checkoutSession = await stripeSubscriptionService.createCheckoutSession(
          user, 
          price_id,
          {
            successUrl: `${process.env.FRONTEND_URL}/account/subscription?success=true`,
            cancelUrl: `${process.env.FRONTEND_URL}/account/subscription?cancelled=true`
          }
        );

        return successResponse(res, {
          checkout_session: {
            id: checkoutSession.id,
            url: checkoutSession.url
          }
        }, 'Checkout session created. Please complete payment to activate subscription.');
      }
    }

    // Log the upgrade
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'subscription.upgrade',
      metadata: {
        price_id,
        subscription_id: result.id
      }
    });

    // Get updated subscription status
    const subscriptionStatus = await stripeSubscriptionService.getSubscriptionStatus(user);

    return successResponse(res, {
      subscription: subscriptionStatus,
      stripe_subscription: {
        id: result.id,
        status: result.status
      }
    }, 'Subscription upgraded successfully');
  } catch (error) {
    logger.error('Error upgrading subscription:', error);
    throw error;
  }
});

/**
 * Downgrade subscription plan
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const downgradeSubscription = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { price_id } = req.body;

    if (!price_id) {
      throw validationError([{ field: 'price_id', message: 'Price ID is required' }]);
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Super admins don't have subscriptions to downgrade
    if (stripeService.isSuperAdmin(user)) {
      throw forbiddenError('Super admin accounts do not have subscriptions to modify');
    }

    if (!user.stripe_subscription_id) {
      throw validationError([{ field: 'subscription', message: 'No active subscription found' }]);
    }

    // Change subscription plan (downgrade at period end to avoid immediate charges)
    const result = await stripeSubscriptionService.changeSubscriptionPlan(user, price_id, {
      proration_behavior: 'none' // No proration for downgrades
    });

    // Log the downgrade
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'subscription.downgrade',
      metadata: {
        price_id,
        subscription_id: result.id
      }
    });

    // Get updated subscription status
    const subscriptionStatus = await stripeSubscriptionService.getSubscriptionStatus(user);

    return successResponse(res, {
      subscription: subscriptionStatus,
      stripe_subscription: {
        id: result.id,
        status: result.status
      }
    }, 'Subscription downgraded successfully. Changes will take effect at the end of your current billing period.');
  } catch (error) {
    logger.error('Error downgrading subscription:', error);
    throw error;
  }
});

/**
 * Cancel subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const cancelSubscription = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, feedback, immediate = false } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Super admins don't have subscriptions to cancel
    if (stripeService.isSuperAdmin(user)) {
      throw forbiddenError('Super admin accounts do not have subscriptions to cancel');
    }

    if (!user.stripe_subscription_id) {
      throw validationError([{ field: 'subscription', message: 'No active subscription found' }]);
    }

    // Cancel subscription
    const result = await stripeSubscriptionService.cancelSubscription(user, {
      atPeriodEnd: !immediate,
      reason,
      feedback
    });

    // Log the cancellation
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'subscription.cancel',
      metadata: {
        subscription_id: result.id,
        reason,
        feedback,
        immediate
      }
    });

    // Get updated subscription status
    const subscriptionStatus = await stripeSubscriptionService.getSubscriptionStatus(user);

    const message = immediate 
      ? 'Subscription cancelled immediately. You no longer have access to premium features.'
      : 'Subscription cancelled. You will retain access until the end of your current billing period.';

    return successResponse(res, {
      subscription: subscriptionStatus,
      stripe_subscription: {
        id: result.id,
        status: result.status,
        cancel_at_period_end: result.cancel_at_period_end
      }
    }, message);
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    throw error;
  }
});

/**
 * Reactivate cancelled subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const reactivateSubscription = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    if (!user.stripe_subscription_id) {
      throw validationError([{ field: 'subscription', message: 'No subscription found' }]);
    }

    // Reactivate subscription
    const result = await stripeSubscriptionService.reactivateSubscription(user);

    // Log the reactivation
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'subscription.reactivate',
      metadata: {
        subscription_id: result.id
      }
    });

    // Get updated subscription status
    const subscriptionStatus = await stripeSubscriptionService.getSubscriptionStatus(user);

    return successResponse(res, {
      subscription: subscriptionStatus,
      stripe_subscription: {
        id: result.id,
        status: result.status,
        cancel_at_period_end: result.cancel_at_period_end
      }
    }, 'Subscription reactivated successfully');
  } catch (error) {
    logger.error('Error reactivating subscription:', error);
    throw error;
  }
});

/**
 * Get billing history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBillingHistory = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Get billing history from database
    const billingHistory = await stripeBillingService.getBillingHistory(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return successResponse(res, {
      billing_history: billingHistory,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: billingHistory.length === parseInt(limit)
      }
    }, 'Billing history retrieved successfully');
  } catch (error) {
    logger.error('Error getting billing history:', error);
    throw error;
  }
});

/**
 * Get payment methods
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentMethods = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    if (!user.stripe_customer_id) {
      return successResponse(res, {
        payment_methods: [],
        default_payment_method: null
      }, 'No payment methods found');
    }

    // Get payment methods and default payment method
    const [paymentMethods, defaultPaymentMethod] = await Promise.all([
      stripeCustomerService.listPaymentMethods(user.stripe_customer_id),
      stripeCustomerService.getDefaultPaymentMethod(user.stripe_customer_id)
    ]);

    // Format payment methods for response
    const formattedPaymentMethods = paymentMethods.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
        country: pm.card.country
      } : null,
      created: new Date(pm.created * 1000),
      is_default: defaultPaymentMethod?.id === pm.id
    }));

    return successResponse(res, {
      payment_methods: formattedPaymentMethods,
      default_payment_method: defaultPaymentMethod?.id || null
    }, 'Payment methods retrieved successfully');
  } catch (error) {
    logger.error('Error getting payment methods:', error);
    throw error;
  }
});

/**
 * Create setup intent for adding payment method
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createSetupIntent = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Ensure customer exists
    const customer = await stripeCustomerService.getOrCreateCustomer(user);

    // Create setup intent
    const setupIntent = await stripeCustomerService.createSetupIntent(customer.id);

    // Log setup intent creation
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'payment_method.setup_intent_created',
      metadata: {
        setup_intent_id: setupIntent.id,
        customer_id: customer.id
      }
    });

    return successResponse(res, {
      setup_intent: {
        id: setupIntent.id,
        client_secret: setupIntent.client_secret,
        status: setupIntent.status
      }
    }, 'Setup intent created successfully');
  } catch (error) {
    logger.error('Error creating setup intent:', error);
    throw error;
  }
});

/**
 * Set default payment method
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const setDefaultPaymentMethod = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { payment_method_id } = req.body;

    if (!payment_method_id) {
      throw validationError([{ field: 'payment_method_id', message: 'Payment method ID is required' }]);
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    if (!user.stripe_customer_id) {
      throw validationError([{ field: 'customer', message: 'No Stripe customer found' }]);
    }

    // Set default payment method
    await stripeBillingService.setDefaultPaymentMethod(user.stripe_customer_id, payment_method_id);

    // Log the change
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'payment_method.set_default',
      metadata: {
        payment_method_id,
        customer_id: user.stripe_customer_id
      }
    });

    return successResponse(res, {
      payment_method_id,
      is_default: true
    }, 'Default payment method updated successfully');
  } catch (error) {
    logger.error('Error setting default payment method:', error);
    throw error;
  }
});

/**
 * Remove payment method
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removePaymentMethod = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { payment_method_id } = req.params;

    if (!payment_method_id) {
      throw validationError([{ field: 'payment_method_id', message: 'Payment method ID is required' }]);
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Detach payment method
    await stripeBillingService.detachPaymentMethod(payment_method_id);

    // Log the removal
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'payment_method.removed',
      metadata: {
        payment_method_id,
        customer_id: user.stripe_customer_id
      }
    });

    return successResponse(res, {
      payment_method_id,
      removed: true
    }, 'Payment method removed successfully');
  } catch (error) {
    logger.error('Error removing payment method:', error);
    throw error;
  }
});

/**
 * Get usage statistics for metered billing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUsage = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'current', metric } = req.query;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Calculate period dates
    let startDate, endDate;
    const now = new Date();

    switch (period) {
      case 'current':
        // Current billing period
        if (user.stripe_current_period_end) {
          endDate = user.stripe_current_period_end;
          startDate = new Date(endDate);
          startDate.setMonth(startDate.getMonth() - 1);
        } else {
          // Fallback to current month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // Build query
    let whereClause = 'user_id = :userId AND timestamp BETWEEN :startDate AND :endDate';
    const replacements = { userId, startDate, endDate };

    if (metric) {
      whereClause += ' AND metric_name = :metric';
      replacements.metric = metric;
    }

    // Get usage summary
    const usageSummary = await sequelize.query(`
      SELECT 
        metric_name,
        COUNT(*) as usage_count,
        SUM(quantity) as total_quantity,
        MIN(timestamp) as first_usage,
        MAX(timestamp) as last_usage
      FROM usage_records 
      WHERE ${whereClause}
      GROUP BY metric_name
      ORDER BY metric_name
    `, {
      replacements,
      type: QueryTypes.SELECT
    });

    // Get daily breakdown for the period
    const dailyUsage = await sequelize.query(`
      SELECT 
        DATE(timestamp) as usage_date,
        metric_name,
        SUM(quantity) as daily_total
      FROM usage_records 
      WHERE ${whereClause}
      GROUP BY DATE(timestamp), metric_name
      ORDER BY usage_date, metric_name
    `, {
      replacements,
      type: QueryTypes.SELECT
    });

    // Get unreported usage (for debugging)
    const unreportedUsage = await sequelize.query(`
      SELECT 
        metric_name,
        COUNT(*) as unreported_count,
        SUM(quantity) as unreported_quantity
      FROM usage_records 
      WHERE user_id = :userId AND reported_at IS NULL
      GROUP BY metric_name
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    });

    // Format response
    const response = {
      period: {
        type: period,
        start_date: startDate,
        end_date: endDate
      },
      summary: usageSummary.map(item => ({
        metric: item.metric_name,
        usage_count: parseInt(item.usage_count),
        total_quantity: parseInt(item.total_quantity),
        first_usage: item.first_usage,
        last_usage: item.last_usage
      })),
      daily_breakdown: dailyUsage.map(item => ({
        date: item.usage_date,
        metric: item.metric_name,
        quantity: parseInt(item.daily_total)
      })),
      unreported: unreportedUsage.map(item => ({
        metric: item.metric_name,
        count: parseInt(item.unreported_count),
        quantity: parseInt(item.unreported_quantity)
      }))
    };

    return successResponse(res, response, 'Usage statistics retrieved successfully');
  } catch (error) {
    logger.error('Error getting usage statistics:', error);
    throw error;
  }
});

/**
 * Record usage for a metric (for internal use)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const recordUsage = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { metric_name, quantity = 1, metadata = {} } = req.body;

    if (!metric_name) {
      throw validationError([{ field: 'metric_name', message: 'Metric name is required' }]);
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Create idempotency key
    const idempotencyKey = `${userId}-${metric_name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Record usage
    const usageRecord = await sequelize.query(`
      INSERT INTO usage_records (
        user_id, metric_name, quantity, timestamp, idempotency_key, metadata, created, updated
      ) VALUES (
        :userId, :metricName, :quantity, NOW(), :idempotencyKey, :metadata, NOW(), NOW()
      )
    `, {
      replacements: {
        userId,
        metricName: metric_name,
        quantity: parseInt(quantity),
        idempotencyKey,
        metadata: JSON.stringify(metadata)
      },
      type: QueryTypes.INSERT
    });

    // Log the usage recording
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'usage.recorded',
      metadata: {
        metric_name,
        quantity,
        idempotency_key: idempotencyKey
      }
    });

    return successResponse(res, {
      usage_record_id: usageRecord[0],
      metric_name,
      quantity: parseInt(quantity),
      recorded_at: new Date()
    }, 'Usage recorded successfully');
  } catch (error) {
    logger.error('Error recording usage:', error);
    throw error;
  }
});

/**
 * Get usage limits and current usage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUsageLimits = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Define usage limits based on subscription plan
    const subscriptionStatus = await stripeSubscriptionService.getSubscriptionStatus(user);
    
    // Default limits (these would typically come from Stripe product metadata)
    const planLimits = {
      basic: {
        bookings: 50,
        api_calls: 1000,
        storage_gb: 1
      },
      professional: {
        bookings: 200,
        api_calls: 5000,
        storage_gb: 5
      },
      enterprise: {
        bookings: -1, // unlimited
        api_calls: -1, // unlimited
        storage_gb: 50
      }
    };

    // Determine current plan
    let currentPlan = 'basic';
    if (stripeService.isSuperAdmin(user)) {
      currentPlan = 'enterprise';
    } else if (subscriptionStatus.has_access) {
      // This would need to map Stripe price IDs to plan names
      currentPlan = 'professional'; // simplified for now
    }

    const limits = planLimits[currentPlan];

    // Get current period usage
    const startDate = user.stripe_current_period_end 
      ? new Date(user.stripe_current_period_end.getTime() - (30 * 24 * 60 * 60 * 1000))
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const endDate = user.stripe_current_period_end || new Date();

    const currentUsage = await sequelize.query(`
      SELECT 
        metric_name,
        SUM(quantity) as total_usage
      FROM usage_records 
      WHERE user_id = :userId 
      AND timestamp BETWEEN :startDate AND :endDate
      GROUP BY metric_name
    `, {
      replacements: { userId, startDate, endDate },
      type: QueryTypes.SELECT
    });

    // Format usage data
    const usageData = {};
    currentUsage.forEach(item => {
      usageData[item.metric_name] = parseInt(item.total_usage);
    });

    // Calculate usage percentages and warnings
    const usageStatus = {};
    Object.keys(limits).forEach(metric => {
      const limit = limits[metric];
      const used = usageData[metric] || 0;
      
      if (limit === -1) {
        usageStatus[metric] = {
          limit: 'unlimited',
          used,
          percentage: 0,
          warning: false,
          exceeded: false
        };
      } else {
        const percentage = Math.round((used / limit) * 100);
        usageStatus[metric] = {
          limit,
          used,
          percentage,
          warning: percentage >= 80,
          exceeded: used >= limit
        };
      }
    });

    return successResponse(res, {
      plan: currentPlan,
      period: {
        start: startDate,
        end: endDate
      },
      limits,
      usage: usageStatus,
      is_super_admin: stripeService.isSuperAdmin(user)
    }, 'Usage limits retrieved successfully');
  } catch (error) {
    logger.error('Error getting usage limits:', error);
    throw error;
  }
});

/**
 * Get customer portal URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCustomerPortal = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { return_url } = req.query;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    if (!user.stripe_customer_id) {
      throw validationError([{ field: 'customer', message: 'No Stripe customer found. Please contact support.' }]);
    }

    const returnUrl = return_url || `${process.env.FRONTEND_URL}/account/subscription`;
    
    // Create customer portal session
    const portalUrl = await stripeCustomerService.createPortalSession(user.stripe_customer_id, returnUrl);

    // Log portal access
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'billing.portal_accessed',
      metadata: {
        customer_id: user.stripe_customer_id,
        return_url: returnUrl
      }
    });

    return successResponse(res, {
      portal_url: portalUrl
    }, 'Customer portal URL generated successfully');
  } catch (error) {
    logger.error('Error creating customer portal session:', error);
    throw error;
  }
});

module.exports = {
  getSubscription,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
  getBillingHistory,
  getPaymentMethods,
  createSetupIntent,
  setDefaultPaymentMethod,
  removePaymentMethod,
  getUsage,
  recordUsage,
  getUsageLimits,
  getCustomerPortal
};