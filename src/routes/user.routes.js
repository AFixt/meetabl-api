/**
 * User routes
 *
 * Defines routes for user profile management
 *
 * @author AccessMeet Team
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

module.exports = router;
