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
 * @desc    Upgrade subscription (redirects to Outseta)
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
 * @desc    Cancel subscription (redirects to Outseta)
 * @access  Private
 */
router.post('/cancel',
  authenticateJWT,
  [
    body('redirectUrl').optional().isURL()
  ],
  validateRequest,
  subscriptionController.cancel
);

module.exports = router;