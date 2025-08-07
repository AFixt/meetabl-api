/**
 * Subscription routes
 * 
 * Handles subscription management endpoints
 * 
 * @author meetabl Team
 */

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticateJWT } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validation');
const subscriptionController = require('../controllers/subscription.controller');

/**
 * @route   GET /api/subscriptions/current
 * @desc    Get current user's subscription details
 * @access  Private
 */
router.get('/current', 
  authenticateJWT, 
  subscriptionController.getSubscription
);

/**
 * @route   GET /api/subscriptions/plans
 * @desc    Get available subscription plans
 * @access  Public
 */
router.get('/plans', 
  subscriptionController.getPlans
);

/**
 * @route   GET /api/subscriptions/features/:feature
 * @desc    Check if user has access to a specific feature
 * @access  Private
 */
router.get('/features/:feature', 
  authenticateJWT, 
  subscriptionController.checkFeature
);

/**
 * @route   GET /api/subscriptions/limits/:limitType
 * @desc    Check usage against subscription limits
 * @access  Private
 */
router.get('/limits/:limitType', 
  authenticateJWT, 
  subscriptionController.checkLimit
);

/**
 * @route   GET /api/subscriptions/usage
 * @desc    Get subscription usage statistics
 * @access  Private
 */
router.get('/usage', 
  authenticateJWT, 
  subscriptionController.getUsageStats
);

/**
 * @route   POST /api/subscriptions/upgrade
 * @desc    Upgrade subscription (creates Stripe checkout session)
 * @access  Private
 */
router.post('/upgrade',
  authenticateJWT,
  [
    body('planId').optional().isString(),
    body('redirectUrl').optional().isURL()
  ],
  validateRequest,
  subscriptionController.upgrade
);

/**
 * @route   POST /api/subscriptions/cancel
 * @desc    Cancel subscription (via Stripe)
 * @access  Private
 */
router.post('/cancel',
  authenticateJWT,
  [
    body('reason').optional().isString()
  ],
  validateRequest,
  subscriptionController.cancel
);

/**
 * @route   POST /api/subscriptions/create-checkout-session
 * @desc    Create Stripe checkout session with price ID (new multi-tier endpoint)
 * @access  Private
 */
router.post('/create-checkout-session',
  authenticateJWT,
  [
    body('price_id').notEmpty().withMessage('price_id is required').isString()
  ],
  validateRequest,
  subscriptionController.createCheckoutSession
);

/**
 * @route   POST /api/subscriptions/sync
 * @desc    Sync subscription status with Stripe (useful when webhooks fail)
 * @access  Private
 */
router.post('/sync',
  authenticateJWT,
  subscriptionController.syncSubscription
);

module.exports = router;