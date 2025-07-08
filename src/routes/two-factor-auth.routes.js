/**
 * Two-Factor Authentication Routes
 * 
 * Routes for 2FA setup, verification, and management
 * 
 * @author meetabl Team
 */

const express = require('express');
const { body } = require('express-validator');
const { authenticate, requireEmailVerification } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validation');
const twoFactorAuthService = require('../services/two-factor-auth.service');
const { asyncHandler, successResponse, notFoundError, validationError } = require('../utils/error-response');

const router = express.Router();

// Apply authentication to all 2FA routes
router.use(authenticate);
router.use(requireEmailVerification);

/**
 * @route GET /api/2fa/status
 * @desc Get 2FA status for current user
 * @access Private
 */
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const status = await twoFactorAuthService.get2FAStatus(req.user.id);
    return successResponse(res, status, '2FA status retrieved successfully');
  } catch (error) {
    throw error;
  }
}));

/**
 * @route POST /api/2fa/setup
 * @desc Generate 2FA secret and QR code for setup
 * @access Private
 */
router.post('/setup', asyncHandler(async (req, res) => {
  try {
    const setupData = await twoFactorAuthService.generateSecret(req.user);
    return successResponse(res, setupData, '2FA setup data generated successfully');
  } catch (error) {
    throw error;
  }
}));

/**
 * @route POST /api/2fa/enable
 * @desc Enable 2FA with verification token
 * @access Private
 */
router.post('/enable', [
  body('token')
    .notEmpty()
    .withMessage('2FA token is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Token must be 6 digits')
    .isNumeric()
    .withMessage('Token must be numeric'),
  body('secret')
    .notEmpty()
    .withMessage('2FA secret is required')
    .isLength({ min: 16 })
    .withMessage('Invalid secret format'),
  validateRequest
], asyncHandler(async (req, res) => {
  try {
    const { token, secret } = req.body;
    const result = await twoFactorAuthService.enable2FA(req.user.id, token, secret);
    return successResponse(res, result, '2FA enabled successfully');
  } catch (error) {
    if (error.message === 'Invalid verification token') {
      throw validationError([{ field: 'token', message: 'Invalid 2FA token' }]);
    }
    throw error;
  }
}));

/**
 * @route POST /api/2fa/disable
 * @desc Disable 2FA with verification token
 * @access Private
 */
router.post('/disable', [
  body('token')
    .notEmpty()
    .withMessage('2FA token or backup code is required')
    .isString()
    .withMessage('Token must be a string'),
  validateRequest
], asyncHandler(async (req, res) => {
  try {
    const { token } = req.body;
    const result = await twoFactorAuthService.disable2FA(req.user.id, token);
    return successResponse(res, result, '2FA disabled successfully');
  } catch (error) {
    if (error.message === 'Invalid token or backup code') {
      throw validationError([{ field: 'token', message: 'Invalid 2FA token or backup code' }]);
    }
    if (error.message === '2FA is not enabled') {
      throw validationError([{ field: '2fa', message: '2FA is not currently enabled' }]);
    }
    throw error;
  }
}));

/**
 * @route POST /api/2fa/verify
 * @desc Verify 2FA token (for testing purposes)
 * @access Private
 */
router.post('/verify', [
  body('token')
    .notEmpty()
    .withMessage('2FA token is required')
    .isString()
    .withMessage('Token must be a string'),
  validateRequest
], asyncHandler(async (req, res) => {
  try {
    const { token } = req.body;
    const result = await twoFactorAuthService.verifyLogin2FA(req.user, token);
    return successResponse(res, result, 'Token verification completed');
  } catch (error) {
    throw error;
  }
}));

/**
 * @route POST /api/2fa/backup-codes/regenerate
 * @desc Regenerate backup codes
 * @access Private
 */
router.post('/backup-codes/regenerate', [
  body('token')
    .notEmpty()
    .withMessage('2FA token is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Token must be 6 digits')
    .isNumeric()
    .withMessage('Token must be numeric'),
  validateRequest
], asyncHandler(async (req, res) => {
  try {
    const { token } = req.body;
    const result = await twoFactorAuthService.regenerateBackupCodes(req.user.id, token);
    return successResponse(res, result, 'Backup codes regenerated successfully');
  } catch (error) {
    if (error.message === 'Invalid 2FA token') {
      throw validationError([{ field: 'token', message: 'Invalid 2FA token' }]);
    }
    if (error.message === '2FA is not enabled') {
      throw validationError([{ field: '2fa', message: '2FA is not currently enabled' }]);
    }
    throw error;
  }
}));

module.exports = router;