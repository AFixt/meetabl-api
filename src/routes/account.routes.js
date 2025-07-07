/**
 * Account management routes
 * 
 * Routes for subscription, billing, and account operations
 * 
 * @author meetabl Team
 */

const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, requireEmailVerification } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validation');
const {
  getSubscription,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
  getBillingHistory,
  getCustomerPortal
} = require('../controllers/account.controller');

const router = express.Router();

// Apply authentication to all account routes
router.use(authenticate);
router.use(requireEmailVerification);

/**
 * @route GET /api/account/subscription
 * @desc Get current subscription details
 * @access Private
 */
router.get('/subscription', getSubscription);

/**
 * @route POST /api/account/upgrade
 * @desc Upgrade subscription plan
 * @access Private
 */
router.post('/upgrade', [
  body('price_id')
    .notEmpty()
    .withMessage('Price ID is required')
    .isString()
    .withMessage('Price ID must be a string'),
  body('payment_method_id')
    .optional()
    .isString()
    .withMessage('Payment method ID must be a string'),
  validateRequest
], upgradeSubscription);

/**
 * @route POST /api/account/downgrade
 * @desc Downgrade subscription plan
 * @access Private
 */
router.post('/downgrade', [
  body('price_id')
    .notEmpty()
    .withMessage('Price ID is required')
    .isString()
    .withMessage('Price ID must be a string'),
  validateRequest
], downgradeSubscription);

/**
 * @route POST /api/account/cancel-subscription
 * @desc Cancel current subscription
 * @access Private
 */
router.post('/cancel-subscription', [
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters'),
  body('feedback')
    .optional()
    .isString()
    .withMessage('Feedback must be a string')
    .isLength({ max: 1000 })
    .withMessage('Feedback must be less than 1000 characters'),
  body('immediate')
    .optional()
    .isBoolean()
    .withMessage('Immediate must be a boolean'),
  validateRequest
], cancelSubscription);

/**
 * @route POST /api/account/reactivate-subscription
 * @desc Reactivate cancelled subscription
 * @access Private
 */
router.post('/reactivate-subscription', reactivateSubscription);

/**
 * @route GET /api/account/billing-history
 * @desc Get billing history
 * @access Private
 */
router.get('/billing-history', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be 0 or greater'),
  validateRequest
], getBillingHistory);

/**
 * @route GET /api/account/customer-portal
 * @desc Get Stripe customer portal URL
 * @access Private
 */
router.get('/customer-portal', [
  query('return_url')
    .optional()
    .isURL()
    .withMessage('Return URL must be a valid URL'),
  validateRequest
], getCustomerPortal);

module.exports = router;