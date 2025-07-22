/**
 * Stripe Elements Service
 * 
 * Provides backend support for Stripe Elements integration
 * Handles setup intents, payment intents, and client secrets
 * 
 * @author meetabl Team
 */

const stripeService = require('./stripe.service');
const stripeCustomerService = require('./stripe-customer.service');
const stripeBillingService = require('./stripe-billing.service');
const logger = require('../config/logger');
const { User, AuditLog } = require('../models');
const { v4: uuidv4 } = require('uuid');

class StripeElementsService {
  /**
   * Create setup intent for adding payment methods
   * @param {string} userId - User ID
   * @param {Object} options - Setup intent options
   * @returns {Promise<Object>} Setup intent with client secret
   */
  async createSetupIntent(userId, options = {}) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Ensure Stripe customer exists
      const customer = await stripeCustomerService.getOrCreateCustomer(user);
      
      const stripe = stripeService.getStripe();
      
      const setupIntentData = {
        customer: customer.id,
        usage: 'off_session', // For future payments
        payment_method_types: ['card'],
        metadata: {
          user_id: userId,
          purpose: options.purpose || 'payment_method_setup'
        }
      };

      // Add automatic payment methods if specified
      if (options.automatic_payment_methods) {
        setupIntentData.automatic_payment_methods = {
          enabled: true
        };
      }

      const setupIntent = await stripe.setupIntents.create(setupIntentData);

      // Log setup intent creation
      await AuditLog.create({
        id: uuidv4(),
        user_id: userId,
        action: 'stripe.setup_intent_created',
        metadata: {
          setup_intent_id: setupIntent.id,
          customer_id: customer.id,
          purpose: options.purpose || 'payment_method_setup'
        }
      });

      logger.info(`Setup intent created for user ${userId}: ${setupIntent.id}`);

      return {
        setup_intent_id: setupIntent.id,
        client_secret: setupIntent.client_secret,
        customer_id: customer.id,
        status: setupIntent.status
      };
    } catch (error) {
      logger.error(`Error creating setup intent for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create payment intent for one-time payments
   * @param {string} userId - User ID
   * @param {number} amount - Payment amount in cents
   * @param {string} currency - Currency code
   * @param {Object} options - Payment intent options
   * @returns {Promise<Object>} Payment intent with client secret
   */
  async createPaymentIntent(userId, amount, currency = 'usd', options = {}) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Ensure Stripe customer exists
      const customer = await stripeCustomerService.getOrCreateCustomer(user);
      
      const stripe = stripeService.getStripe();
      
      const paymentIntentData = {
        amount: Math.round(amount), // Ensure integer
        currency: currency.toLowerCase(),
        customer: customer.id,
        setup_future_usage: options.setup_future_usage || 'off_session',
        payment_method_types: ['card'],
        metadata: {
          user_id: userId,
          purpose: options.purpose || 'one_time_payment',
          description: options.description || 'Payment'
        }
      };

      // Add automatic payment methods if specified
      if (options.automatic_payment_methods) {
        paymentIntentData.automatic_payment_methods = {
          enabled: true
        };
      }

      // Add description
      if (options.description) {
        paymentIntentData.description = options.description;
      }

      // Add receipt email
      if (user.email) {
        paymentIntentData.receipt_email = user.email;
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

      // Log payment intent creation
      await AuditLog.create({
        id: uuidv4(),
        user_id: userId,
        action: 'stripe.payment_intent_created',
        metadata: {
          payment_intent_id: paymentIntent.id,
          amount,
          currency,
          customer_id: customer.id,
          purpose: options.purpose || 'one_time_payment'
        }
      });

      logger.info(`Payment intent created for user ${userId}: ${paymentIntent.id} (${amount} ${currency})`);

      return {
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        customer_id: customer.id,
        amount,
        currency,
        status: paymentIntent.status
      };
    } catch (error) {
      logger.error(`Error creating payment intent for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Confirm setup intent after Elements collection
   * @param {string} setupIntentId - Setup intent ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Confirmation result
   */
  async confirmSetupIntent(setupIntentId, userId) {
    try {
      const stripe = stripeService.getStripe();
      
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      
      if (setupIntent.metadata.user_id !== userId) {
        throw new Error('Setup intent does not belong to user');
      }

      // Log setup intent confirmation
      await AuditLog.create({
        id: uuidv4(),
        user_id: userId,
        action: 'stripe.setup_intent_confirmed',
        metadata: {
          setup_intent_id: setupIntentId,
          status: setupIntent.status,
          payment_method_id: setupIntent.payment_method
        }
      });

      logger.info(`Setup intent confirmed for user ${userId}: ${setupIntentId}`);

      return {
        setup_intent_id: setupIntentId,
        status: setupIntent.status,
        payment_method_id: setupIntent.payment_method,
        payment_method: setupIntent.payment_method ? {
          id: setupIntent.payment_method.id,
          type: setupIntent.payment_method.type,
          card: setupIntent.payment_method.card
        } : null
      };
    } catch (error) {
      logger.error(`Error confirming setup intent ${setupIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Get Elements configuration for client
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Elements configuration
   */
  async getElementsConfig(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get or create Stripe customer
      const customer = await stripeCustomerService.getOrCreateCustomer(user);

      // Get existing payment methods
      const paymentMethods = await stripeCustomerService.listPaymentMethods(customer.id);
      const defaultPaymentMethod = await stripeCustomerService.getDefaultPaymentMethod(customer.id);

      return {
        stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
        customer_id: customer.id,
        appearance: {
          theme: 'stripe', // or 'night', 'flat'
          variables: {
            colorPrimary: '#0570de',
            colorBackground: '#ffffff',
            colorText: '#30313d',
            colorDanger: '#df1b41',
            fontFamily: 'Ideal Sans, system-ui, sans-serif',
            spacingUnit: '2px',
            borderRadius: '4px'
          }
        },
        payment_methods: paymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year
          } : null,
          is_default: defaultPaymentMethod?.id === pm.id
        })),
        locale: user.locale || 'auto'
      };
    } catch (error) {
      logger.error(`Error getting Elements config for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Handle successful payment method setup from Elements
   * @param {string} setupIntentId - Setup intent ID
   * @param {string} userId - User ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Result with payment method info
   */
  async handlePaymentMethodSetup(setupIntentId, userId, options = {}) {
    try {
      const stripe = stripeService.getStripe();
      
      // Retrieve the setup intent
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
        expand: ['payment_method']
      });

      if (setupIntent.metadata.user_id !== userId) {
        throw new Error('Setup intent does not belong to user');
      }

      if (setupIntent.status !== 'succeeded') {
        throw new Error(`Setup intent not successful: ${setupIntent.status}`);
      }

      const paymentMethod = setupIntent.payment_method;
      
      // Set as default if requested or if user has no payment methods
      if (options.set_as_default) {
        await stripeBillingService.setDefaultPaymentMethod(
          setupIntent.customer, 
          paymentMethod.id
        );
      }

      // Log successful setup
      await AuditLog.create({
        id: uuidv4(),
        user_id: userId,
        action: 'stripe.payment_method_setup_completed',
        metadata: {
          setup_intent_id: setupIntentId,
          payment_method_id: paymentMethod.id,
          payment_method_type: paymentMethod.type,
          card_last4: paymentMethod.card?.last4,
          set_as_default: options.set_as_default || false
        }
      });

      logger.info(`Payment method setup completed for user ${userId}: ${paymentMethod.id}`);

      return {
        payment_method: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          card: paymentMethod.card ? {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year,
            country: paymentMethod.card.country
          } : null,
          created: new Date(paymentMethod.created * 1000)
        },
        setup_successful: true,
        set_as_default: options.set_as_default || false
      };
    } catch (error) {
      logger.error(`Error handling payment method setup ${setupIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Create ephemeral key for customer (for mobile SDKs)
   * @param {string} userId - User ID
   * @param {string} apiVersion - Stripe API version
   * @returns {Promise<Object>} Ephemeral key
   */
  async createEphemeralKey(userId, apiVersion) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Ensure Stripe customer exists
      const customer = await stripeCustomerService.getOrCreateCustomer(user);
      
      const stripe = stripeService.getStripe();
      
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customer.id },
        { apiVersion }
      );

      // Log ephemeral key creation
      await AuditLog.create({
        id: uuidv4(),
        user_id: userId,
        action: 'stripe.ephemeral_key_created',
        metadata: {
          customer_id: customer.id,
          api_version: apiVersion
        }
      });

      logger.info(`Ephemeral key created for user ${userId}`);

      return ephemeralKey;
    } catch (error) {
      logger.error(`Error creating ephemeral key for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Validate Elements webhook events
   * @param {Object} event - Stripe webhook event
   * @returns {Promise<Object>} Validation result
   */
  async validateElementsEvent(event) {
    try {
      const supportedEvents = [
        'setup_intent.succeeded',
        'setup_intent.setup_failed',
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'payment_method.attached'
      ];

      if (!supportedEvents.includes(event.type)) {
        return { valid: false, reason: 'Unsupported event type' };
      }

      // Validate event structure
      if (!event.data || !event.data.object) {
        return { valid: false, reason: 'Invalid event structure' };
      }

      const object = event.data.object;
      
      // Validate user_id in metadata
      if (!object.metadata || !object.metadata.user_id) {
        return { valid: false, reason: 'Missing user_id in metadata' };
      }

      // Verify user exists
      const user = await User.findByPk(object.metadata.user_id);
      if (!user) {
        return { valid: false, reason: 'User not found' };
      }

      return { valid: true, user_id: object.metadata.user_id };
    } catch (error) {
      logger.error('Error validating Elements event:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }
}

// Export singleton instance
module.exports = new StripeElementsService();