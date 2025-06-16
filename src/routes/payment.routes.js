/**
 * Payment routes
 *
 * Defines routes for payment processing and management
 *
 * @author meetabl Team
 */

const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');
const { 
  validatePayment, 
  validateRefund, 
  validatePricingRule,
  validateUuid,
  validateGetRequest 
} = require('../middlewares/validation');
const paymentController = require('../controllers/payment.controller');
const pricingRuleController = require('../controllers/pricing-rule.controller');
const invoiceController = require('../controllers/invoice.controller');

const router = express.Router();

// Stripe webhook route (no authentication required)
/**
 * @route POST /api/payments/webhook
 * @desc Handle Stripe webhook events
 * @access Public (verified by Stripe signature)
 */
router.post('/webhook', paymentController.handleStripeWebhook);

// All other routes require authentication
router.use(authenticateJWT);

// Payment routes
/**
 * @route POST /api/payments/process
 * @desc Process payment for a booking
 * @access Private
 */
router.post('/process', validatePayment, paymentController.processPayment);

/**
 * @route GET /api/payments/history
 * @desc Get payment history for current user
 * @access Private
 */
router.get('/history', validateGetRequest, paymentController.getPaymentHistory);

/**
 * @route POST /api/payments/refund
 * @desc Process refund for a payment
 * @access Private
 */
router.post('/refund', validateRefund, paymentController.refundPayment);

// Pricing rule routes
/**
 * @route GET /api/payments/pricing-rules
 * @desc Get all pricing rules for current user
 * @access Private
 */
router.get('/pricing-rules', validateGetRequest, pricingRuleController.getPricingRules);

/**
 * @route POST /api/payments/pricing-rules
 * @desc Create new pricing rule
 * @access Private
 */
router.post('/pricing-rules', validatePricingRule, pricingRuleController.createPricingRule);

/**
 * @route PUT /api/payments/pricing-rules/:id
 * @desc Update pricing rule
 * @access Private
 */
router.put('/pricing-rules/:id', [validateUuid, validatePricingRule], pricingRuleController.updatePricingRule);

/**
 * @route DELETE /api/payments/pricing-rules/:id
 * @desc Delete pricing rule
 * @access Private
 */
router.delete('/pricing-rules/:id', validateUuid, pricingRuleController.deletePricingRule);

// Invoice routes
/**
 * @route GET /api/payments/invoices
 * @desc Get all invoices for current user
 * @access Private
 */
router.get('/invoices', validateGetRequest, invoiceController.getInvoices);

/**
 * @route GET /api/payments/invoices/:id
 * @desc Get specific invoice
 * @access Private
 */
router.get('/invoices/:id', validateUuid, invoiceController.getInvoice);

/**
 * @route GET /api/payments/invoices/:id/download
 * @desc Download invoice PDF
 * @access Private
 */
router.get('/invoices/:id/download', validateUuid, invoiceController.downloadInvoice);

module.exports = router;