/**
 * User routes
 *
 * Defines routes for user profile management
 *
 * @author meetabl Team
 */

const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');
const { validateUserSettings } = require('../middlewares/validation');
const userController = require('../controllers/user.controller');

const router = express.Router();

// Apply authentication middleware
router.use(authenticateJWT);

/**
 * @route GET /api/users/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', userController.getCurrentUser);

/**
 * @route PUT /api/users/me
 * @desc Update user profile
 * @access Private
 */
router.put('/me', userController.updateUser);

/**
 * @route GET /api/users/settings
 * @desc Get user settings
 * @access Private
 */
router.get('/settings', userController.getUserSettings);

/**
 * @route PUT /api/users/settings
 * @desc Update user settings
 * @access Private
 */
router.put('/settings', validateUserSettings, userController.updateUserSettings);

/**
 * @route PUT /api/users/me/password
 * @desc Change user password
 * @access Private
 */
router.put('/me/password', userController.changePassword);

/**
 * @route POST /api/users/me/resend-verification
 * @desc Resend email verification
 * @access Private
 */
const { resendVerificationEmail } = require('../controllers/auth.controller');
router.post('/me/resend-verification', resendVerificationEmail);

/**
 * @route DELETE /api/users/me
 * @desc Delete user account
 * @access Private
 */
router.delete('/me', userController.deleteAccount);

/**
 * @route PUT /api/users/me/public-profile
 * @desc Update public profile settings
 * @access Private
 */
router.put('/me/public-profile', userController.updatePublicProfile);

/**
 * @route POST /api/users/me/logo
 * @desc Upload logo image
 * @access Private
 */
router.post('/me/logo', userController.upload.single('logo'), userController.uploadLogo);

/**
 * @route DELETE /api/users/me/logo
 * @desc Delete logo image
 * @access Private
 */
router.delete('/me/logo', userController.deleteLogo);

// Public routes (no authentication required)

/**
 * @route GET /api/users/:username/profile
 * @desc Get public profile data
 * @access Public
 */
router.get('/:username/profile', userController.getPublicProfile);

module.exports = router;
