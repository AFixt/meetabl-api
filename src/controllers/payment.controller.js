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
const {
  asyncHandler,
  successResponse,
  validationError,
  createError
} = require('../utils/error-response');

/**
 * Process payment for a booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processPayment = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
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

    return successResponse(res, paymentIntent, 'Payment intent created successfully');
});

/**
 * Get payment history for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 20, offset = 0 } = req.query;

  // Get payment history
  const history = await paymentService.getPaymentHistory(userId, {
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10)
  });

  return successResponse(res, history, 'Payment history retrieved successfully');
});

/**
 * Process refund for a payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refundPayment = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
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

    return successResponse(res, refund, 'Refund processed successfully');
});

/**
 * Handle Stripe webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleStripeWebhook = asyncHandler(async (req, res) => {
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
      throw createError('VALIDATION_ERROR', `Webhook Error: ${err.message}`);
    }
  } else {
    event = req.body;
  }

  // Handle the event
  await paymentService.handleWebhookEvent(event);

  // Return a response to acknowledge receipt of the event
  return successResponse(res, { received: true }, 'Webhook processed successfully');
});

module.exports = {
  processPayment,
  getPaymentHistory,
  refundPayment,
  handleStripeWebhook
};