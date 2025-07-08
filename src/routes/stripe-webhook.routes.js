/**
 * Stripe Webhook Routes
 * 
 * Handles incoming Stripe webhook events for subscription management,
 * payment processing, and customer lifecycle events
 * 
 * @author meetabl Team
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const stripeService = require('../services/stripe.service');
const stripeWebhookService = require('../services/stripe-webhook.service');
const { AuditLog } = require('../models');
const { asyncHandler, successResponse, validationError } = require('../utils/error-response');

const router = express.Router();

/**
 * @route POST /api/stripe/webhook
 * @desc Handle Stripe webhook events
 * @access Public (with signature verification)
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const sig = req.get('stripe-signature');
  const payload = req.body;

  if (!sig) {
    throw validationError([{ field: 'stripe-signature', message: 'Missing Stripe signature' }]);
  }

  if (!payload) {
    throw validationError([{ field: 'payload', message: 'Missing webhook payload' }]);
  }

  try {
    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(payload, sig);
    
    logger.info(`Received Stripe webhook: ${event.type}`, {
      event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      api_version: event.api_version
    });

    // Check for duplicate events using idempotency
    const idempotencyKey = `stripe_webhook_${event.id}`;
    const existingLog = await AuditLog.findOne({
      where: {
        action: 'stripe.webhook_received',
        metadata: {
          event_id: event.id
        }
      }
    });

    if (existingLog) {
      logger.info(`Duplicate webhook event ignored: ${event.id}`);
      return successResponse(res, { received: true, duplicate: true }, 'Webhook received (duplicate)');
    }

    // Process the webhook event
    const result = await stripeWebhookService.processWebhookEvent(event);

    // Log successful webhook processing
    await AuditLog.create({
      id: uuidv4(),
      user_id: result.user_id || null,
      action: 'stripe.webhook_received',
      metadata: {
        event_id: event.id,
        event_type: event.type,
        processed: true,
        result_summary: result.summary || 'Webhook processed successfully',
        livemode: event.livemode,
        api_version: event.api_version
      }
    });

    logger.info(`Successfully processed Stripe webhook: ${event.type}`, {
      event_id: event.id,
      user_id: result.user_id,
      result: result.summary
    });

    return successResponse(res, { 
      received: true, 
      event_id: event.id,
      event_type: event.type,
      processed: true,
      result: result.summary
    }, 'Webhook processed successfully');

  } catch (error) {
    // Log webhook processing error
    try {
      await AuditLog.create({
        id: uuidv4(),
        user_id: null,
        action: 'stripe.webhook_failed',
        metadata: {
          error: error.message,
          signature: sig ? 'present' : 'missing',
          payload_size: payload ? payload.length : 0,
          timestamp: new Date().toISOString()
        }
      });
    } catch (auditError) {
      logger.error('Failed to log webhook error:', auditError);
    }

    logger.error('Stripe webhook processing failed:', {
      error: error.message,
      signature: sig ? 'present' : 'missing',
      payload_size: payload ? payload.length : 0
    });

    // For webhook endpoints, we should return 200 even on processing errors
    // to prevent Stripe from retrying non-recoverable errors
    if (error.type === 'StripeSignatureVerificationError') {
      return res.status(400).json({
        error: {
          code: 'invalid_signature',
          message: 'Invalid webhook signature'
        }
      });
    }

    // For other errors, return 200 to acknowledge receipt
    // but log the error for investigation
    return successResponse(res, { 
      received: true, 
      processed: false,
      error: error.message 
    }, 'Webhook received but processing failed');
  }
});

// Handle webhook with raw body (middleware handles this in app.js)
router.post('/', handleWebhook);

/**
 * @route GET /api/stripe/webhook/status
 * @desc Get webhook endpoint status and recent events (for debugging)
 * @access Private (requires authentication)
 */
router.get('/status', async (req, res) => {
  try {
    // Get recent webhook events from audit logs
    const recentEvents = await AuditLog.findAll({
      where: {
        action: ['stripe.webhook_received', 'stripe.webhook_failed']
      },
      order: [['created', 'DESC']],
      limit: 20,
      attributes: ['action', 'metadata', 'created']
    });

    const status = {
      endpoint_active: true,
      recent_events: recentEvents.map(event => ({
        action: event.action,
        event_type: event.metadata?.event_type,
        event_id: event.metadata?.event_id,
        processed: event.metadata?.processed || false,
        error: event.metadata?.error,
        timestamp: event.created
      })),
      webhook_url: `${process.env.API_BASE_URL || 'https://api.meetabl.com'}/api/stripe/webhook`,
      supported_events: [
        'customer.created',
        'customer.updated', 
        'customer.deleted',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'invoice.created',
        'invoice.finalized',
        'payment_method.attached',
        'payment_method.detached',
        'setup_intent.succeeded',
        'checkout.session.completed'
      ]
    };

    return successResponse(res, status, 'Webhook status retrieved successfully');
  } catch (error) {
    logger.error('Error getting webhook status:', error);
    return res.status(500).json({
      error: {
        code: 'webhook_status_error',
        message: 'Failed to retrieve webhook status'
      }
    });
  }
});

module.exports = router;