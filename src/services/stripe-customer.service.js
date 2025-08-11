/**
 * Stripe Customer Service
 * 
 * Handles all Stripe customer-related operations
 */

const stripeService = require('./stripe.service');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');
const { User } = require('../models');

class StripeCustomerService {
  /**
   * Create a new Stripe customer
   * @param {Object} user - User object
   * @param {Object} options - Additional customer options
   * @returns {Promise<Object>} Stripe customer object
   */
  async createCustomer(user, options = {}) {
    try {
      const stripe = stripeService.getStripe();

      // Prepare customer data
      const customerData = {
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
        metadata: {
          user_id: user.id.toString(),
          created_from: 'meetabl_app'
        },
        ...options
      };

      // Add phone if available
      if (user.phone) {
        customerData.phone = user.phone;
      }

      // Create customer in Stripe
      const customer = await stripe.customers.create(customerData);

      // Update user with Stripe customer ID
      await user.update({
        stripe_customer_id: customer.id
      });

      logger.info(`Created Stripe customer ${customer.id} for user ${user.id}`);
      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Get or create Stripe customer for a user
   * @param {Object} user - User object
   * @returns {Promise<Object>} Stripe customer object
   */
  async getOrCreateCustomer(user) {
    try {
      // Check if user already has a Stripe customer ID
      if (user.stripe_customer_id) {
        const customer = await this.getCustomer(user.stripe_customer_id);
        if (customer && !customer.deleted) {
          return customer;
        }
      }

      // Create new customer
      return await this.createCustomer(user);
    } catch (error) {
      logger.error('Failed to get or create Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Get a Stripe customer by ID
   * @param {string} customerId - Stripe customer ID
   * @returns {Promise<Object>} Stripe customer object
   */
  async getCustomer(customerId) {
    try {
      const stripe = stripeService.getStripe();
      const customer = await stripe.customers.retrieve(customerId);
      return customer;
    } catch (error) {
      logger.error(`Failed to retrieve Stripe customer ${customerId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Update a Stripe customer
   * @param {string} customerId - Stripe customer ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated Stripe customer object
   */
  async updateCustomer(customerId, updates) {
    try {
      const stripe = stripeService.getStripe();
      const customer = await stripe.customers.update(customerId, updates);
      
      logger.info(`Updated Stripe customer ${customerId}`);
      return customer;
    } catch (error) {
      logger.error(`Failed to update Stripe customer ${customerId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Update customer from user data
   * @param {Object} user - User object with updated data
   * @returns {Promise<Object>} Updated Stripe customer object
   */
  async updateCustomerFromUser(user) {
    if (!user.stripe_customer_id) {
      throw new AppError('User does not have a Stripe customer ID', 400);
    }

    try {
      const updates = {
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
        metadata: {
          user_id: user.id.toString(),
          updated_at: new Date().toISOString()
        }
      };

      if (user.phone) {
        updates.phone = user.phone;
      }

      return await this.updateCustomer(user.stripe_customer_id, updates);
    } catch (error) {
      logger.error('Failed to update customer from user:', error);
      throw error;
    }
  }

  /**
   * Delete a Stripe customer (soft delete)
   * @param {string} customerId - Stripe customer ID
   * @returns {Promise<Object>} Deleted customer object
   */
  async deleteCustomer(customerId) {
    try {
      const stripe = stripeService.getStripe();
      
      // Cancel all active subscriptions first
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active'
      });

      for (const subscription of subscriptions.data) {
        await stripe.subscriptions.cancel(subscription.id);
        logger.info(`Cancelled subscription ${subscription.id} for customer ${customerId}`);
      }

      // Delete the customer
      const customer = await stripe.customers.del(customerId);
      
      logger.info(`Deleted Stripe customer ${customerId}`);
      return customer;
    } catch (error) {
      logger.error(`Failed to delete Stripe customer ${customerId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * List payment methods for a customer
   * @param {string} customerId - Stripe customer ID
   * @param {string} type - Payment method type (default: 'card')
   * @returns {Promise<Array>} Array of payment methods
   */
  async listPaymentMethods(customerId, type = 'card') {
    try {
      const stripe = stripeService.getStripe();
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: type
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error(`Failed to list payment methods for customer ${customerId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Get default payment method for a customer
   * @param {string} customerId - Stripe customer ID
   * @returns {Promise<Object|null>} Default payment method or null
   */
  async getDefaultPaymentMethod(customerId) {
    try {
      const customer = await this.getCustomer(customerId);
      
      if (!customer.invoice_settings?.default_payment_method) {
        return null;
      }

      const stripe = stripeService.getStripe();
      const paymentMethod = await stripe.paymentMethods.retrieve(
        customer.invoice_settings.default_payment_method
      );

      return paymentMethod;
    } catch (error) {
      logger.error(`Failed to get default payment method for customer ${customerId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Create a setup intent for adding payment methods
   * @param {string} customerId - Stripe customer ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Setup intent object
   */
  async createSetupIntent(customerId, options = {}) {
    try {
      const stripe = stripeService.getStripe();
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        ...options
      });

      logger.info(`Created setup intent ${setupIntent.id} for customer ${customerId}`);
      return setupIntent;
    } catch (error) {
      logger.error(`Failed to create setup intent for customer ${customerId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Get customer portal URL
   * @param {string} customerId - Stripe customer ID
   * @param {string} returnUrl - URL to return to after portal session
   * @returns {Promise<string>} Portal session URL
   */
  async createPortalSession(customerId, returnUrl) {
    try {
      const stripe = stripeService.getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
      });

      logger.info(`Created portal session for customer ${customerId}`);
      return session.url;
    } catch (error) {
      logger.error(`Failed to create portal session for customer ${customerId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Sync all users with Stripe customers
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync results
   */
  async syncAllCustomers(options = {}) {
    const results = {
      created: 0,
      updated: 0,
      errors: 0,
      total: 0
    };

    try {
      const users = await User.findAll({
        where: options.where || {}
      });

      results.total = users.length;

      for (const user of users) {
        try {
          if (!user.stripe_customer_id) {
            await this.createCustomer(user);
            results.created++;
          } else {
            await this.updateCustomerFromUser(user);
            results.updated++;
          }
        } catch (error) {
          logger.error(`Failed to sync user ${user.id}:`, error);
          results.errors++;
        }
      }

      logger.info('Customer sync completed:', results);
      return results;
    } catch (error) {
      logger.error('Failed to sync customers:', error);
      throw new AppError('Customer sync failed', 500);
    }
  }
}

// Export singleton instance
module.exports = new StripeCustomerService();