/**
 * Validation middleware
 *
 * Provides request validation functions using express-validator
 *
 * @author AccessMeet Team
 */

const {
  body, query, param, validationResult
} = require('express-validator');
const logger = require('../config/logger');

/**
 * Process validation errors and return a standardized error response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  logger.debug('Validation errors:', errors.array());

  // Format errors to match API error response format
  const formattedErrors = errors.array().map((error) => ({
    param: error.param,
    message: error.msg
  }));

  return res.status(400).json({
    error: {
      code: 'bad_request',
      message: 'Validation failed',
      params: formattedErrors
    }
  });
};

/**
 * Common validation rules for GET requests
 */
const validateGetRequest = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
    .toInt(),

  query('order')
    .optional()
    .isString()
    .withMessage('Order must be a string'),

  query('dir')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Direction must be either "asc" or "desc"'),

  validateRequest
];

/**
 * Validate UUID parameter
 */
const validateUuid = [
  param('id')
    .isUUID(4)
    .withMessage('ID must be a valid UUID'),

  validateRequest
];

/**
 * Validate user registration
 */
const validateUserRegistration = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be at most 100 characters'),

  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be valid')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),

  body('timezone')
    .notEmpty()
    .withMessage('Timezone is required'),

  validateRequest
];

/**
 * Validate user login
 */
const validateUserLogin = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be valid')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  validateRequest
];

/**
 * Validate availability rule creation
 */
const validateAvailabilityRule = [
  body('day_of_week')
    .notEmpty()
    .withMessage('Day of week is required')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 and 6')
    .toInt(),

  body('start_time')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
    .withMessage('Start time must be in HH:MM:SS format'),

  body('end_time')
    .notEmpty()
    .withMessage('End time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
    .withMessage('End time must be in HH:MM:SS format'),

  body('buffer_minutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Buffer minutes must be a non-negative integer')
    .toInt(),

  body('max_bookings_per_day')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max bookings per day must be at least 1')
    .toInt(),

  validateRequest
];

/**
 * Validate booking creation
 */
const validateBooking = [
  body('customer_name')
    .notEmpty()
    .withMessage('Customer name is required')
    .isLength({ max: 100 })
    .withMessage('Customer name must be at most 100 characters'),

  body('customer_email')
    .notEmpty()
    .withMessage('Customer email is required')
    .isEmail()
    .withMessage('Customer email must be valid')
    .normalizeEmail(),

  body('start_time')
    .notEmpty()
    .withMessage('Start time is required')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date-time'),

  body('end_time')
    .notEmpty()
    .withMessage('End time is required')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date-time'),

  validateRequest
];

/**
 * Validate user settings update
 */
const validateUserSettings = [
  body('branding_color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Branding color must be a valid hex color'),

  body('confirmation_email_copy')
    .optional()
    .isString()
    .withMessage('Confirmation email copy must be a string'),

  body('accessibility_mode')
    .optional()
    .isBoolean()
    .withMessage('Accessibility mode must be a boolean'),

  body('alt_text_enabled')
    .optional()
    .isBoolean()
    .withMessage('Alt text enabled must be a boolean'),

  validateRequest
];

module.exports = {
  validateRequest,
  validateGetRequest,
  validateUuid,
  validateUserRegistration,
  validateUserLogin,
  validateAvailabilityRule,
  validateBooking,
  validateUserSettings
};
