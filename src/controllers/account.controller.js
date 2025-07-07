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
      user_id: userId,
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
      user_id: userId,
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
      user_id: userId,
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
      user_id: userId,
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
      user_id: userId,
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
  getCustomerPortal
};