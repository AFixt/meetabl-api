/**
 * Stripe Elements Routes
 * 
 * API endpoints supporting Stripe Elements integration
 * Handles setup intents, payment intents, and client configuration
 * 
 * @author meetabl Team
 */

const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, requireEmailVerification } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validation');
const stripeElementsService = require('../services/stripe-elements.service');
const { asyncHandler, successResponse, notFoundError, validationError } = require('../utils/error-response');

const router = express.Router();

// Apply authentication to all Elements routes
router.use(authenticate);
router.use(requireEmailVerification);

/**
 * @route GET /api/stripe/elements/config
 * @desc Get Stripe Elements configuration for client
 * @access Private
 */
router.get('/config', asyncHandler(async (req, res) => {
  try {
    const config = await stripeElementsService.getElementsConfig(req.user.id);
    return successResponse(res, config, 'Elements configuration retrieved successfully');
  } catch (error) {
    throw error;
  }
}));

/**
 * @route POST /api/stripe/elements/setup-intent
 * @desc Create setup intent for adding payment methods
 * @access Private
 */
router.post('/setup-intent', [
  body('purpose')
    .optional()
    .isString()
    .withMessage('Purpose must be a string'),
  body('automatic_payment_methods')
    .optional()
    .isBoolean()
    .withMessage('Automatic payment methods must be a boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  try {
    const { purpose, automatic_payment_methods } = req.body;
    
    const setupIntent = await stripeElementsService.createSetupIntent(req.user.id, {
      purpose,
      automatic_payment_methods
    });
    
    return successResponse(res, setupIntent, 'Setup intent created successfully');
  } catch (error) {
    throw error;
  }
}));

/**
 * @route POST /api/stripe/elements/payment-intent
 * @desc Create payment intent for one-time payments
 * @access Private
 */
router.post('/payment-intent', [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isNumeric()
    .withMessage('Amount must be numeric')
    .custom((value) => {
      if (value <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (value < 50) { // Minimum 50 cents for most currencies
        throw new Error('Amount must be at least 50 cents');
      }
      return true;
    }),
  body('currency')
    .optional()
    .isString()
    .withMessage('Currency must be a string')
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be 3 characters'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ max: 200 })
    .withMessage('Description must be less than 200 characters'),
  body('setup_future_usage')
    .optional()
    .isIn(['on_session', 'off_session'])
    .withMessage('Setup future usage must be "on_session" or "off_session"'),
  body('automatic_payment_methods')
    .optional()
    .isBoolean()
    .withMessage('Automatic payment methods must be a boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  try {
    const { 
      amount, 
      currency = 'usd', 
      description, 
      setup_future_usage,
      automatic_payment_methods 
    } = req.body;
    
    const paymentIntent = await stripeElementsService.createPaymentIntent(
      req.user.id, 
      amount, 
      currency, 
      {
        description,
        setup_future_usage,
        automatic_payment_methods
      }
    );
    
    return successResponse(res, paymentIntent, 'Payment intent created successfully');
  } catch (error) {
    throw error;
  }
}));

/**
 * @route POST /api/stripe/elements/confirm-setup
 * @desc Confirm setup intent after Elements collection
 * @access Private
 */
router.post('/confirm-setup', [
  body('setup_intent_id')
    .notEmpty()
    .withMessage('Setup intent ID is required')
    .isString()
    .withMessage('Setup intent ID must be a string'),
  body('set_as_default')
    .optional()
    .isBoolean()
    .withMessage('Set as default must be a boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  try {
    const { setup_intent_id, set_as_default } = req.body;
    
    // First confirm the setup intent
    const confirmation = await stripeElementsService.confirmSetupIntent(
      setup_intent_id, 
      req.user.id
    );
    
    // Then handle the payment method setup
    const result = await stripeElementsService.handlePaymentMethodSetup(
      setup_intent_id,
      req.user.id,
      { set_as_default }
    );
    
    return successResponse(res, {
      confirmation,
      payment_method_setup: result
    }, 'Setup intent confirmed and payment method added successfully');
  } catch (error) {
    throw error;
  }
}));

/**
 * @route POST /api/stripe/elements/ephemeral-key
 * @desc Create ephemeral key for mobile SDKs
 * @access Private
 */
router.post('/ephemeral-key', [
  body('api_version')
    .notEmpty()
    .withMessage('API version is required')
    .isString()
    .withMessage('API version must be a string')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('API version must be in YYYY-MM-DD format'),
  validateRequest
], asyncHandler(async (req, res) => {
  try {
    const { api_version } = req.body;
    
    const ephemeralKey = await stripeElementsService.createEphemeralKey(
      req.user.id,
      api_version
    );
    
    return successResponse(res, ephemeralKey, 'Ephemeral key created successfully');
  } catch (error) {
    throw error;
  }
}));

/**
 * @route GET /api/stripe/elements/payment-methods
 * @desc Get user's saved payment methods for Elements
 * @access Private
 */
router.get('/payment-methods', asyncHandler(async (req, res) => {
  try {
    const config = await stripeElementsService.getElementsConfig(req.user.id);
    
    return successResponse(res, {
      payment_methods: config.payment_methods,
      customer_id: config.customer_id
    }, 'Payment methods retrieved successfully');
  } catch (error) {
    throw error;
  }
}));

/**
 * @route POST /api/stripe/elements/validate-event
 * @desc Validate Elements-related webhook events (internal use)
 * @access Private
 */
router.post('/validate-event', [
  body('event')
    .notEmpty()
    .withMessage('Event is required')
    .isObject()
    .withMessage('Event must be an object'),
  validateRequest
], asyncHandler(async (req, res) => {
  try {
    const { event } = req.body;
    
    const validation = await stripeElementsService.validateElementsEvent(event);
    
    return successResponse(res, validation, 'Event validation completed');
  } catch (error) {
    throw error;
  }
}));

module.exports = router;