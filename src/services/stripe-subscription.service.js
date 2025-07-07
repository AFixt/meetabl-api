/**
 * Stripe Subscription Service
 * 
 * Handles all Stripe subscription-related operations
 */

const stripeService = require('./stripe.service');
const stripeCustomerService = require('./stripe-customer.service');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');
const { User } = require('../models');
const { Op } = require('sequelize');

class StripeSubscriptionService {
  /**
   * Create a new subscription
   * @param {Object} user - User object
   * @param {string} priceId - Stripe price ID
   * @param {Object} options - Additional subscription options
   * @returns {Promise<Object>} Stripe subscription object
   */
  async createSubscription(user, priceId, options = {}) {
    try {
      const stripe = stripeService.getStripe();

      // Ensure customer exists
      const customer = await stripeCustomerService.getOrCreateCustomer(user);

      // Check for existing active subscription
      if (user.stripe_subscription_id) {
        const existingSubscription = await this.getSubscription(user.stripe_subscription_id);
        if (existingSubscription && ['active', 'trialing'].includes(existingSubscription.status)) {
          throw new AppError('User already has an active subscription', 400);
        }
      }

      // Prepare subscription data
      const subscriptionData = {
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          user_id: user.id.toString()
        },
        ...options
      };

      // Add trial period for new users (30 days)
      if (!user.stripe_subscription_id && !options.trial_end) {
        subscriptionData.trial_end = Math.floor(stripeService.calculateTrialEnd().getTime() / 1000);
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create(subscriptionData);

      // Update user with subscription details
      await user.update({
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        stripe_subscription_status: subscription.status,
        stripe_current_period_end: new Date(subscription.current_period_end * 1000)
      });

      logger.info(`Created subscription ${subscription.id} for user ${user.id}`);
      return subscription;
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Create a checkout session for subscription
   * @param {Object} user - User object
   * @param {string} priceId - Stripe price ID
   * @param {Object} options - Checkout session options
   * @returns {Promise<Object>} Checkout session object
   */
  async createCheckoutSession(user, priceId, options = {}) {
    try {
      const stripe = stripeService.getStripe();

      // Ensure customer exists
      const customer = await stripeCustomerService.getOrCreateCustomer(user);

      const sessionData = {
        customer: customer.id,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{
          price: priceId,
          quantity: 1
        }],
        success_url: options.successUrl || `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: options.cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`,
        metadata: {
          user_id: user.id.toString()
        }
      };

      // Add trial period for new subscriptions
      if (!user.stripe_subscription_id) {
        sessionData.subscription_data = {
          trial_period_days: 30,
          metadata: {
            user_id: user.id.toString()
          }
        };
      }

      const session = await stripe.checkout.sessions.create(sessionData);

      logger.info(`Created checkout session ${session.id} for user ${user.id}`);
      return session;
    } catch (error) {
      logger.error('Failed to create checkout session:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Get a subscription by ID
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Stripe subscription object
   */
  async getSubscription(subscriptionId) {
    try {
      const stripe = stripeService.getStripe();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      logger.error(`Failed to retrieve subscription ${subscriptionId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Update a subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated subscription object
   */
  async updateSubscription(subscriptionId, updates) {
    try {
      const stripe = stripeService.getStripe();
      const subscription = await stripe.subscriptions.update(subscriptionId, updates);
      
      logger.info(`Updated subscription ${subscriptionId}`);
      return subscription;
    } catch (error) {
      logger.error(`Failed to update subscription ${subscriptionId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Change subscription plan (upgrade/downgrade)
   * @param {Object} user - User object
   * @param {string} newPriceId - New Stripe price ID
   * @param {Object} options - Change options
   * @returns {Promise<Object>} Updated subscription object
   */
  async changeSubscriptionPlan(user, newPriceId, options = {}) {
    if (!user.stripe_subscription_id) {
      throw new AppError('User does not have an active subscription', 400);
    }

    try {
      const stripe = stripeService.getStripe();
      
      // Get current subscription
      const subscription = await this.getSubscription(user.stripe_subscription_id);
      
      if (!subscription || subscription.status === 'canceled') {
        throw new AppError('No active subscription found', 400);
      }

      // Update subscription item with new price
      const subscriptionItem = subscription.items.data[0];
      const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
        items: [{
          id: subscriptionItem.id,
          price: newPriceId
        }],
        proration_behavior: options.proration_behavior || 'create_prorations'
      });

      // Update user record
      await user.update({
        stripe_price_id: newPriceId,
        stripe_subscription_status: updatedSubscription.status
      });

      logger.info(`Changed subscription plan for user ${user.id} to ${newPriceId}`);
      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to change subscription plan:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Cancel a subscription
   * @param {Object} user - User object
   * @param {Object} options - Cancellation options
   * @returns {Promise<Object>} Cancelled subscription object
   */
  async cancelSubscription(user, options = {}) {
    if (!user.stripe_subscription_id) {
      throw new AppError('User does not have an active subscription', 400);
    }

    try {
      const stripe = stripeService.getStripe();
      
      const cancellationData = {
        cancel_at_period_end: options.atPeriodEnd !== false
      };

      // Add cancellation feedback if provided
      if (options.feedback) {
        cancellationData.cancellation_details = {
          comment: options.feedback,
          feedback: options.reason || 'other'
        };
      }

      const subscription = await stripe.subscriptions.update(
        user.stripe_subscription_id,
        cancellationData
      );

      // Update user record
      await user.update({
        stripe_subscription_status: subscription.status
      });

      logger.info(`Cancelled subscription ${subscription.id} for user ${user.id}`);
      return subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Reactivate a cancelled subscription
   * @param {Object} user - User object
   * @returns {Promise<Object>} Reactivated subscription object
   */
  async reactivateSubscription(user) {
    if (!user.stripe_subscription_id) {
      throw new AppError('User does not have a subscription', 400);
    }

    try {
      const stripe = stripeService.getStripe();
      
      // Get current subscription
      const subscription = await this.getSubscription(user.stripe_subscription_id);
      
      if (!subscription.cancel_at_period_end) {
        throw new AppError('Subscription is not scheduled for cancellation', 400);
      }

      // Remove cancellation
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.id,
        { cancel_at_period_end: false }
      );

      // Update user record
      await user.update({
        stripe_subscription_status: updatedSubscription.status
      });

      logger.info(`Reactivated subscription ${subscription.id} for user ${user.id}`);
      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to reactivate subscription:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Get subscription status for a user
   * @param {Object} user - User object
   * @returns {Promise<Object>} Subscription status details
   */
  async getSubscriptionStatus(user) {
    // Super admins always have active status
    if (stripeService.isSuperAdmin(user)) {
      return {
        status: 'active',
        is_super_admin: true,
        has_access: true,
        current_period_end: null,
        cancel_at_period_end: false
      };
    }

    if (!user.stripe_subscription_id) {
      return {
        status: 'none',
        has_access: false,
        trial_available: true
      };
    }

    try {
      const subscription = await this.getSubscription(user.stripe_subscription_id);
      
      return {
        status: subscription.status,
        has_access: ['active', 'trialing'].includes(subscription.status),
        current_period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        price_id: subscription.items.data[0]?.price.id
      };
    } catch (error) {
      logger.error('Failed to get subscription status:', error);
      return {
        status: 'error',
        has_access: false,
        error: error.message
      };
    }
  }

  /**
   * Sync subscription status from Stripe
   * @param {Object} user - User object
   * @returns {Promise<Object>} Updated user object
   */
  async syncSubscriptionStatus(user) {
    if (!user.stripe_subscription_id) {
      return user;
    }

    try {
      const subscription = await this.getSubscription(user.stripe_subscription_id);
      
      await user.update({
        stripe_subscription_status: subscription.status,
        stripe_current_period_end: new Date(subscription.current_period_end * 1000),
        stripe_price_id: subscription.items.data[0]?.price.id
      });

      logger.info(`Synced subscription status for user ${user.id}`);
      return user.reload();
    } catch (error) {
      logger.error(`Failed to sync subscription status for user ${user.id}:`, error);
      throw error;
    }
  }

  /**
   * Get users with expiring trials
   * @param {number} daysBeforeExpiry - Days before expiry to check
   * @returns {Promise<Array>} Array of users with expiring trials
   */
  async getUsersWithExpiringTrials(daysBeforeExpiry = 3) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysBeforeExpiry);

    try {
      const users = await User.findAll({
        where: {
          stripe_subscription_status: 'trialing',
          stripe_current_period_end: {
            [Op.lte]: expiryDate,
            [Op.gte]: new Date()
          }
        }
      });

      return users;
    } catch (error) {
      logger.error('Failed to get users with expiring trials:', error);
      throw new AppError('Failed to retrieve expiring trials', 500);
    }
  }

  /**
   * Get upcoming invoice for a subscription
   * @param {Object} user - User object
   * @returns {Promise<Object>} Upcoming invoice object
   */
  async getUpcomingInvoice(user) {
    if (!user.stripe_customer_id || !user.stripe_subscription_id) {
      return null;
    }

    try {
      const stripe = stripeService.getStripe();
      const invoice = await stripe.invoices.retrieveUpcoming({
        customer: user.stripe_customer_id,
        subscription: user.stripe_subscription_id
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to get upcoming invoice:', error);
      throw stripeService.handleStripeError(error);
    }
  }
}

// Export singleton instance
module.exports = new StripeSubscriptionService();