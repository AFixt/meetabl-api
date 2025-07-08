/**
 * GDPR compliance routes
 * 
 * Routes for GDPR-related operations including data export, deletion,
 * and consent management
 * 
 * @author meetabl Team
 */

const express = require('express');
const { body, query, param } = require('express-validator');
const { authenticate, requireEmailVerification } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validation');
const {
  exportData,
  deleteAccount,
  cancelDeletion,
  manageConsent,
  getDataProcessingAgreement,
  getPrivacySettings,
  updatePrivacySettings,
  getRequestStatus
} = require('../controllers/gdpr.controller');

const router = express.Router();

// Apply authentication to all GDPR routes
router.use(authenticate);
router.use(requireEmailVerification);

/**
 * @route GET /api/gdpr/export-data
 * @desc Export user data for GDPR data portability
 * @access Private
 */
router.get('/export-data', [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be either "json" or "csv"'),
  validateRequest
], exportData);

/**
 * @route POST /api/gdpr/delete-account
 * @desc Request account deletion with optional grace period
 * @access Private
 */
router.post('/delete-account', [
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
    .isLength({ max: 1000 })
    .withMessage('Reason must be less than 1000 characters'),
  body('immediate')
    .optional()
    .isBoolean()
    .withMessage('Immediate must be a boolean'),
  validateRequest
], deleteAccount);

/**
 * @route POST /api/gdpr/cancel-deletion
 * @desc Cancel pending account deletion
 * @access Private
 */
router.post('/cancel-deletion', [
  body('gdpr_request_id')
    .notEmpty()
    .withMessage('GDPR request ID is required')
    .isUUID()
    .withMessage('GDPR request ID must be a valid UUID'),
  validateRequest
], cancelDeletion);

/**
 * @route PUT /api/gdpr/consent-preferences
 * @desc Manage consent preferences
 * @access Private
 */
router.put('/consent-preferences', [
  body('marketing_consent')
    .optional()
    .isBoolean()
    .withMessage('Marketing consent must be a boolean'),
  body('data_processing_consent')
    .optional()
    .isBoolean()
    .withMessage('Data processing consent must be a boolean'),
  validateRequest
], manageConsent);

/**
 * @route GET /api/gdpr/data-processing-agreement
 * @desc Get data processing agreement and consent history
 * @access Private
 */
router.get('/data-processing-agreement', getDataProcessingAgreement);

/**
 * @route GET /api/gdpr/privacy-settings
 * @desc Get privacy settings and communication preferences
 * @access Private
 */
router.get('/privacy-settings', getPrivacySettings);

/**
 * @route PUT /api/gdpr/privacy-settings
 * @desc Update privacy settings and communication preferences
 * @access Private
 */
router.put('/privacy-settings', [
  body('marketing_consent')
    .optional()
    .isBoolean()
    .withMessage('Marketing consent must be a boolean'),
  body('email_notifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be a boolean'),
  body('sms_notifications')
    .optional()
    .isBoolean()
    .withMessage('SMS notifications must be a boolean'),
  body('push_notifications')
    .optional()
    .isBoolean()
    .withMessage('Push notifications must be a boolean'),
  body('notification_booking_confirmed')
    .optional()
    .isBoolean()
    .withMessage('Booking confirmation notifications must be a boolean'),
  body('notification_booking_cancelled')
    .optional()
    .isBoolean()
    .withMessage('Booking cancellation notifications must be a boolean'),
  body('notification_booking_reminder')
    .optional()
    .isBoolean()
    .withMessage('Booking reminder notifications must be a boolean'),
  body('notification_new_booking')
    .optional()
    .isBoolean()
    .withMessage('New booking notifications must be a boolean'),
  validateRequest
], updatePrivacySettings);

/**
 * @route GET /api/gdpr/requests
 * @desc Get all GDPR requests for the user
 * @access Private
 */
router.get('/requests', getRequestStatus);

/**
 * @route GET /api/gdpr/requests/:request_id
 * @desc Get specific GDPR request status
 * @access Private
 */
router.get('/requests/:request_id', [
  param('request_id')
    .isUUID()
    .withMessage('Request ID must be a valid UUID'),
  validateRequest
], getRequestStatus);

module.exports = router;