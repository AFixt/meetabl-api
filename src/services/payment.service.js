/**
 * Payment service
 *
 * Manages payment processing with Stripe integration
 *
 * @author meetabl Team
 */

const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { Payment, Booking, User, Invoice, PricingRule } = require('../models');
const { sequelize } = require('../config/database');

// Initialize Stripe with API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

/**
 * Create a payment intent with Stripe
 * @param {string} bookingId - Booking ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Payment intent details
 */
const createPaymentIntent = async (bookingId, userId) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Get booking details
    const booking = await Booking.findByPk(bookingId, {
      include: [User],
      transaction
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Get pricing rule for the host
    const pricingRule = await PricingRule.findOne({
      where: {
        user_id: booking.user_id,
        is_active: true
      },
      transaction
    });

    if (!pricingRule) {
      throw new Error('No active pricing rule found for this host');
    }

    // Calculate amount (assuming price is per slot/hour)
    const duration = (new Date(booking.end_time) - new Date(booking.start_time)) / (1000 * 60 * 60); // hours
    const amount = Math.round(pricingRule.price_per_slot * duration * 100); // Convert to cents

    // Create payment record
    const payment = await Payment.create({
      user_id: userId,
      booking_id: bookingId,
      amount: pricingRule.price_per_slot * duration,
      currency: pricingRule.currency,
      status: 'pending'
    }, { transaction });

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: pricingRule.currency.toLowerCase(),
      metadata: {
        payment_id: payment.id,
        booking_id: bookingId,
        user_id: userId
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    // Update payment with Stripe payment intent ID
    await payment.update({
      stripe_payment_intent_id: paymentIntent.id
    }, { transaction });

    await transaction.commit();

    logger.info(`Payment intent created for booking ${bookingId}`, {
      payment_id: payment.id,
      stripe_payment_intent_id: paymentIntent.id
    });

    return {
      payment_id: payment.id,
      client_secret: paymentIntent.client_secret,
      amount: payment.amount,
      currency: payment.currency
    };

  } catch (error) {
    await transaction.rollback();
    logger.error('Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Confirm payment after successful Stripe payment
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @returns {Promise<Object>} Updated payment details
 */
const confirmPayment = async (paymentIntentId) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Get payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment not successful');
    }

    // Find payment record
    const payment = await Payment.findOne({
      where: { stripe_payment_intent_id: paymentIntentId },
      transaction
    });

    if (!payment) {
      throw new Error('Payment record not found');
    }

    // Update payment status
    await payment.update({
      status: 'completed'
    }, { transaction });

    // Generate invoice
    const invoiceNumber = `INV-${Date.now()}-${payment.id.substring(0, 8)}`;
    const invoice = await Invoice.create({
      payment_id: payment.id,
      invoice_number: invoiceNumber,
      status: 'paid'
    }, { transaction });

    await transaction.commit();

    logger.info(`Payment confirmed for payment ${payment.id}`);

    return {
      payment,
      invoice
    };

  } catch (error) {
    await transaction.rollback();
    logger.error('Error confirming payment:', error);
    throw error;
  }
};

/**
 * Process refund for a payment
 * @param {string} paymentId - Payment ID
 * @param {number} amount - Amount to refund (optional, defaults to full refund)
 * @param {string} reason - Refund reason
 * @returns {Promise<Object>} Refund details
 */
const processRefund = async (paymentId, amount = null, reason = 'requested_by_customer') => {
  const transaction = await sequelize.transaction();
  
  try {
    // Get payment details
    const payment = await Payment.findByPk(paymentId, { transaction });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'completed') {
      throw new Error('Only completed payments can be refunded');
    }

    // Calculate refund amount
    const refundAmount = amount ? Math.round(amount * 100) : undefined; // Convert to cents if specified

    // Create Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      amount: refundAmount,
      reason
    });

    // Update payment status
    await payment.update({
      status: 'refunded'
    }, { transaction });

    // Update invoice status if exists
    const invoice = await Invoice.findOne({
      where: { payment_id: payment.id },
      transaction
    });

    if (invoice) {
      await invoice.update({
        status: 'draft'
      }, { transaction });
    }

    await transaction.commit();

    logger.info(`Refund processed for payment ${paymentId}`, {
      refund_id: refund.id,
      amount: refund.amount / 100
    });

    return {
      refund_id: refund.id,
      amount: refund.amount / 100,
      currency: refund.currency,
      status: refund.status
    };

  } catch (error) {
    await transaction.rollback();
    logger.error('Error processing refund:', error);
    throw error;
  }
};

/**
 * Get payment history for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit, offset, etc.)
 * @returns {Promise<Object>} Payment history
 */
const getPaymentHistory = async (userId, options = {}) => {
  try {
    const { limit = 20, offset = 0 } = options;

    const payments = await Payment.findAndCountAll({
      where: { user_id: userId },
      include: [{
        model: Booking,
        include: [User]
      }, {
        model: Invoice
      }],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    return {
      total: payments.count,
      payments: payments.rows,
      limit,
      offset
    };

  } catch (error) {
    logger.error('Error getting payment history:', error);
    throw error;
  }
};

/**
 * Handle Stripe webhook events
 * @param {Object} event - Stripe webhook event
 * @returns {Promise<void>}
 */
const handleWebhookEvent = async (event) => {
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await confirmPayment(event.data.object.id);
        break;
      
      case 'payment_intent.payment_failed':
        const failedPayment = await Payment.findOne({
          where: { stripe_payment_intent_id: event.data.object.id }
        });
        if (failedPayment) {
          await failedPayment.update({ status: 'failed' });
        }
        break;
      
      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }
  } catch (error) {
    logger.error('Error handling webhook event:', error);
    throw error;
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  processRefund,
  getPaymentHistory,
  handleWebhookEvent
};