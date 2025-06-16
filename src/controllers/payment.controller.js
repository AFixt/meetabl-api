/**
 * Payment controller
 *
 * Handles payment processing and management
 *
 * @author meetabl Team
 */

const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const paymentService = require('../services/payment.service');
const { AuditLog } = require('../models');

/**
 * Process payment for a booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processPayment = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { booking_id } = req.body;
    const userId = req.user.id;

    // Create payment intent
    const paymentIntent = await paymentService.createPaymentIntent(booking_id, userId);

    // Log the action
    await AuditLog.create({
      user_id: userId,
      action: 'payment_initiated',
      entity_type: 'payment',
      entity_id: paymentIntent.payment_id,
      metadata: JSON.stringify({
        booking_id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      })
    });

    logger.info(`Payment initiated by user ${userId} for booking ${booking_id}`);

    return res.status(200).json({
      message: 'Payment intent created successfully',
      data: paymentIntent
    });
  } catch (error) {
    logger.error('Error processing payment:', error);
    return res.status(500).json({
      error: 'Failed to process payment',
      message: error.message
    });
  }
};

/**
 * Get payment history for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    // Get payment history
    const history = await paymentService.getPaymentHistory(userId, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    return res.status(200).json({
      message: 'Payment history retrieved successfully',
      data: history
    });
  } catch (error) {
    logger.error('Error getting payment history:', error);
    return res.status(500).json({
      error: 'Failed to retrieve payment history',
      message: error.message
    });
  }
};

/**
 * Process refund for a payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refundPayment = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { payment_id, amount, reason } = req.body;
    const userId = req.user.id;

    // Process refund
    const refund = await paymentService.processRefund(payment_id, amount, reason);

    // Log the action
    await AuditLog.create({
      user_id: userId,
      action: 'payment_refunded',
      entity_type: 'payment',
      entity_id: payment_id,
      metadata: JSON.stringify({
        refund_id: refund.refund_id,
        amount: refund.amount,
        reason
      })
    });

    logger.info(`Refund processed by user ${userId} for payment ${payment_id}`);

    return res.status(200).json({
      message: 'Refund processed successfully',
      data: refund
    });
  } catch (error) {
    logger.error('Error processing refund:', error);
    return res.status(500).json({
      error: 'Failed to process refund',
      message: error.message
    });
  }
};

/**
 * Handle Stripe webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleStripeWebhook = async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    // Verify webhook signature
    if (endpointSecret) {
      const signature = req.headers['stripe-signature'];
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          endpointSecret
        );
      } catch (err) {
        logger.error('Webhook signature verification failed:', err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      event = req.body;
    }

    // Handle the event
    await paymentService.handleWebhookEvent(event);

    // Return a response to acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling Stripe webhook:', error);
    return res.status(500).json({
      error: 'Failed to handle webhook',
      message: error.message
    });
  }
};

module.exports = {
  processPayment,
  getPaymentHistory,
  refundPayment,
  handleStripeWebhook
};