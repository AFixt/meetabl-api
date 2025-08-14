/**
 * Stripe Webhook Service
 * 
 * Handles processing of Stripe webhook events
 */

const stripeService = require('./stripe.service');
const stripeBillingService = require('./stripe-billing.service');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');
const { User, AuditLog } = require('../models');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

class StripeWebhookService {
  constructor() {
    // Map event types to handler methods
    this.eventHandlers = {
      // Customer events
      'customer.created': this.handleCustomerCreated.bind(this),
      'customer.updated': this.handleCustomerUpdated.bind(this),
      'customer.deleted': this.handleCustomerDeleted.bind(this),
      
      // Subscription events
      'customer.subscription.created': this.handleSubscriptionCreated.bind(this),
      'customer.subscription.updated': this.handleSubscriptionUpdated.bind(this),
      'customer.subscription.deleted': this.handleSubscriptionDeleted.bind(this),
      'customer.subscription.trial_will_end': this.handleSubscriptionTrialWillEnd.bind(this),
      
      // Invoice events
      'invoice.created': this.handleInvoiceCreated.bind(this),
      'invoice.finalized': this.handleInvoiceFinalized.bind(this),
      'invoice.paid': this.handleInvoicePaid.bind(this),
      'invoice.payment_failed': this.handleInvoicePaymentFailed.bind(this),
      'invoice.payment_action_required': this.handleInvoicePaymentActionRequired.bind(this),
      
      // Payment method events
      'payment_method.attached': this.handlePaymentMethodAttached.bind(this),
      'payment_method.detached': this.handlePaymentMethodDetached.bind(this),
      'payment_method.updated': this.handlePaymentMethodUpdated.bind(this),
      
      // Checkout events
      'checkout.session.completed': this.handleCheckoutSessionCompleted.bind(this),
      'checkout.session.expired': this.handleCheckoutSessionExpired.bind(this),
      
      // Charge events
      'charge.refunded': this.handleChargeRefunded.bind(this)
    };
  }

  /**
   * Process webhook event
   * @param {Object} event - Stripe event object
   * @returns {Promise<Object>} Processing result
   */
  async processWebhookEvent(event) {
    try {
      logger.info(`Processing webhook event: ${event.type} (${event.id})`);

      // Check if we've already processed this event (idempotency)
      const processed = await this.checkEventProcessed(event.id);
      if (processed) {
        logger.info(`Event ${event.id} already processed, skipping`);
        return { status: 'already_processed' };
      }

      // Get handler for event type
      const handler = this.eventHandlers[event.type];
      if (!handler) {
        logger.warn(`No handler for event type: ${event.type}`);
        return { status: 'no_handler' };
      }

      // Process the event
      const result = await handler(event);

      // Mark event as processed
      await this.markEventProcessed(event);

      // Log the event
      await this.logWebhookEvent(event, 'success', result);

      return { status: 'success', result };
    } catch (error) {
      logger.error(`Error processing webhook event ${event.type}:`, error);
      
      // Log the error
      await this.logWebhookEvent(event, 'error', { error: error.message });
      
      throw error;
    }
  }

  /**
   * Check if event has already been processed
   * @param {string} eventId - Stripe event ID
   * @returns {Promise<boolean>} Whether event was processed
   */
  async checkEventProcessed(eventId) {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM audit_logs 
        WHERE action = 'stripe_webhook_processed' 
        AND metadata->>'$.event_id' = :eventId
      `;

      const [result] = await sequelize.query(query, {
        replacements: { eventId },
        type: QueryTypes.SELECT
      });

      return result.count > 0;
    } catch (error) {
      logger.error('Error checking event processed status:', error);
      return false;
    }
  }

  /**
   * Mark event as processed
   * @param {Object} event - Stripe event object
   * @returns {Promise<void>}
   */
  async markEventProcessed(event) {
    try {
      await AuditLog.create({
        user_id: null,
        action: 'stripe_webhook_processed',
        table_name: 'webhook_events',
        record_id: event.id,
        metadata: {
          event_id: event.id,
          event_type: event.type,
          created: event.created,
          livemode: event.livemode
        }
      });
    } catch (error) {
      logger.error('Error marking event as processed:', error);
    }
  }

  /**
   * Log webhook event
   * @param {Object} event - Stripe event object
   * @param {string} status - Processing status
   * @param {Object} result - Processing result
   * @returns {Promise<void>}
   */
  async logWebhookEvent(event, status, result) {
    try {
      await AuditLog.create({
        user_id: null,
        action: `webhook_${event.type}`,
        table_name: 'webhook_events',
        record_id: event.id,
        metadata: {
          event_id: event.id,
          status,
          result,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error logging webhook event:', error);
    }
  }

  /**
   * Find user by Stripe customer ID
   * @param {string} customerId - Stripe customer ID
   * @returns {Promise<Object|null>} User object or null
   */
  async findUserByCustomerId(customerId) {
    try {
      const user = await User.findOne({
        where: { stripe_customer_id: customerId }
      });
      return user;
    } catch (error) {
      logger.error(`Error finding user by customer ID ${customerId}:`, error);
      return null;
    }
  }

  // Customer event handlers

  async handleCustomerCreated(event) {
    const customer = event.data.object;
    logger.info(`Customer created: ${customer.id}`);
    
    // Usually customer is created from our side, but log it
    return { customerId: customer.id };
  }

  async handleCustomerUpdated(event) {
    const customer = event.data.object;
    logger.info(`Customer updated: ${customer.id}`);
    
    // Find user and sync email if changed
    const user = await this.findUserByCustomerId(customer.id);
    if (user && user.email !== customer.email) {
      await user.update({ email: customer.email });
    }
    
    return { customerId: customer.id, synced: !!user };
  }

  async handleCustomerDeleted(event) {
    const customer = event.data.object;
    logger.info(`Customer deleted: ${customer.id}`);
    
    // Clear Stripe fields from user
    const user = await this.findUserByCustomerId(customer.id);
    if (user) {
      await user.update({
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_subscription_status: null,
        stripe_price_id: null,
        stripe_current_period_end: null
      });
    }
    
    return { customerId: customer.id, cleared: !!user };
  }

  // Subscription event handlers

  async handleSubscriptionCreated(event) {
    const subscription = event.data.object;
    logger.info(`Subscription created: ${subscription.id}`);
    
    const user = await this.findUserByCustomerId(subscription.customer);
    if (user) {
      await user.update({
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status,
        stripe_price_id: subscription.items.data[0]?.price.id,
        stripe_current_period_end: new Date(subscription.current_period_end * 1000)
      });
    }
    
    return { subscriptionId: subscription.id, userId: user?.id };
  }

  async handleSubscriptionUpdated(event) {
    const subscription = event.data.object;
    logger.info(`Subscription updated: ${subscription.id}`);
    
    const user = await this.findUserByCustomerId(subscription.customer);
    if (user) {
      const priceId = subscription.items.data[0]?.price.id;
      
      // Import stripe products configuration
      const stripeProducts = require('../config/stripe-products');
      
      // Determine plan type from price ID
      const planDetails = stripeProducts.getPlanFromPriceId(priceId);
      let planType = user.plan_type; // Keep existing if not found
      if (planDetails) {
        planType = planDetails.plan;
      }
      
      await user.update({
        stripe_subscription_status: subscription.status,
        stripe_price_id: priceId,
        stripe_current_period_end: new Date(subscription.current_period_end * 1000),
        plan_type: planType,
        billing_period: planDetails?.interval === 'year' ? 'annual' : 'monthly'
      });
      
      // Save user if plan changed
      if (planDetails) {
        await user.save();
      }
    }
    
    return { subscriptionId: subscription.id, userId: user?.id, status: subscription.status };
  }

  async handleSubscriptionDeleted(event) {
    const subscription = event.data.object;
    logger.info(`Subscription deleted: ${subscription.id}`);
    
    const user = await this.findUserByCustomerId(subscription.customer);
    if (user) {
      await user.update({
        stripe_subscription_status: 'canceled',
        stripe_current_period_end: new Date(subscription.current_period_end * 1000),
        plan_type: 'free'
      });
    }
    
    return { subscriptionId: subscription.id, userId: user?.id };
  }

  async handleSubscriptionTrialWillEnd(event) {
    const subscription = event.data.object;
    logger.info(`Subscription trial ending soon: ${subscription.id}`);
    
    // This is where you'd send a notification email
    const user = await this.findUserByCustomerId(subscription.customer);
    if (user) {
      // TODO: Send trial ending email notification
      logger.info(`Trial ending notification needed for user ${user.id}`);
    }
    
    return { subscriptionId: subscription.id, userId: user?.id };
  }

  // Invoice event handlers

  async handleInvoiceCreated(event) {
    const invoice = event.data.object;
    logger.info(`Invoice created: ${invoice.id}`);
    return { invoiceId: invoice.id };
  }

  async handleInvoiceFinalized(event) {
    const invoice = event.data.object;
    logger.info(`Invoice finalized: ${invoice.id}`);
    
    // Save to billing history when finalized
    const user = await this.findUserByCustomerId(invoice.customer);
    if (user) {
      await stripeBillingService.saveInvoiceToBillingHistory(invoice, user.id);
    }
    
    return { invoiceId: invoice.id, userId: user?.id };
  }

  async handleInvoicePaid(event) {
    const invoice = event.data.object;
    logger.info(`Invoice paid: ${invoice.id}`);
    
    // Update billing history
    const user = await this.findUserByCustomerId(invoice.customer);
    if (user) {
      await stripeBillingService.saveInvoiceToBillingHistory(invoice, user.id);
      
      // Update subscription status if this was a subscription invoice
      if (invoice.subscription) {
        await user.update({
          stripe_subscription_status: 'active'
        });
      }
    }
    
    return { invoiceId: invoice.id, userId: user?.id, amount: invoice.amount_paid };
  }

  async handleInvoicePaymentFailed(event) {
    const invoice = event.data.object;
    logger.info(`Invoice payment failed: ${invoice.id}`);
    
    const user = await this.findUserByCustomerId(invoice.customer);
    if (user) {
      await stripeBillingService.saveInvoiceToBillingHistory(invoice, user.id);
      
      // Update subscription status
      if (invoice.subscription) {
        await user.update({
          stripe_subscription_status: 'past_due'
        });
      }
      
      // TODO: Send payment failed notification
      logger.info(`Payment failed notification needed for user ${user.id}`);
    }
    
    return { invoiceId: invoice.id, userId: user?.id, attemptCount: invoice.attempt_count };
  }

  async handleInvoicePaymentActionRequired(event) {
    const invoice = event.data.object;
    logger.info(`Invoice payment action required: ${invoice.id}`);
    
    const user = await this.findUserByCustomerId(invoice.customer);
    if (user) {
      // TODO: Send payment action required notification
      logger.info(`Payment action required notification needed for user ${user.id}`);
    }
    
    return { invoiceId: invoice.id, userId: user?.id };
  }

  // Payment method event handlers

  async handlePaymentMethodAttached(event) {
    const paymentMethod = event.data.object;
    logger.info(`Payment method attached: ${paymentMethod.id}`);
    return { paymentMethodId: paymentMethod.id, customerId: paymentMethod.customer };
  }

  async handlePaymentMethodDetached(event) {
    const paymentMethod = event.data.object;
    logger.info(`Payment method detached: ${paymentMethod.id}`);
    return { paymentMethodId: paymentMethod.id };
  }

  async handlePaymentMethodUpdated(event) {
    const paymentMethod = event.data.object;
    logger.info(`Payment method updated: ${paymentMethod.id}`);
    return { paymentMethodId: paymentMethod.id };
  }

  // Checkout event handlers

  async handleCheckoutSessionCompleted(event) {
    const session = event.data.object;
    logger.info(`Checkout session completed: ${session.id}`);
    
    // Update user subscription if this was a subscription checkout
    if (session.mode === 'subscription' && session.subscription) {
      const user = await this.findUserByCustomerId(session.customer);
      if (user) {
        const stripe = stripeService.getStripe();
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        
        // Get the price ID from subscription
        const priceId = subscription.items.data[0]?.price.id;
        
        // Import stripe products configuration
        const stripeProducts = require('../config/stripe-products');
        
        // Determine plan type from price ID
        const planDetails = stripeProducts.getPlanFromPriceId(priceId);
        let planType = 'free';
        if (planDetails) {
          planType = planDetails.plan;
        }
        
        // Update user with subscription details and apply plan limits
        await user.update({
          stripe_subscription_id: subscription.id,
          stripe_subscription_status: subscription.status,
          stripe_price_id: priceId,
          stripe_current_period_end: new Date(subscription.current_period_end * 1000),
          plan_type: planType,
          billing_period: planDetails?.interval === 'year' ? 'annual' : 'monthly'
        });
        
        // Save user with new plan type
        await user.save();
        
        logger.info(`User ${user.id} upgraded to ${planType} plan (${planDetails?.interval || 'unknown'} billing)`);
      }
    }
    
    return { sessionId: session.id, customerId: session.customer };
  }

  async handleCheckoutSessionExpired(event) {
    const session = event.data.object;
    logger.info(`Checkout session expired: ${session.id}`);
    return { sessionId: session.id };
  }

  // Charge event handlers

  async handleChargeRefunded(event) {
    const charge = event.data.object;
    logger.info(`Charge refunded: ${charge.id}`);
    
    // Update billing history if we have the invoice
    if (charge.invoice) {
      const query = `
        UPDATE billing_history 
        SET 
          status = CASE 
            WHEN :refunded = amount THEN 'refunded'
            ELSE 'partial_refund'
          END,
          refunded_amount = :refunded,
          updated = NOW()
        WHERE stripe_invoice_id = :invoiceId
      `;

      await sequelize.query(query, {
        replacements: {
          invoiceId: charge.invoice,
          refunded: charge.amount_refunded
        },
        type: QueryTypes.UPDATE
      });
    }
    
    return { chargeId: charge.id, amountRefunded: charge.amount_refunded };
  }

  /**
   * Get webhook statistics
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Webhook statistics
   */
  async getWebhookStatistics(options = {}) {
    try {
      const startDate = options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      const endDate = options.endDate || new Date();

      const query = `
        SELECT 
          action as event_type,
          COUNT(*) as count,
          SUM(CASE WHEN metadata->>'$.status' = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN metadata->>'$.status' = 'error' THEN 1 ELSE 0 END) as error_count
        FROM audit_logs
        WHERE action LIKE 'webhook_%'
        AND created BETWEEN :startDate AND :endDate
        GROUP BY action
        ORDER BY count DESC
      `;

      const stats = await sequelize.query(query, {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT
      });

      return {
        period: { startDate, endDate },
        events: stats,
        total: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0)
      };
    } catch (error) {
      logger.error('Error getting webhook statistics:', error);
      throw new AppError('Failed to get webhook statistics', 500);
    }
  }
}

// Export singleton instance
module.exports = new StripeWebhookService();