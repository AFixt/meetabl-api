/**
 * Authentication routes
 *
 * Defines routes for user registration, login, and token management
 *
 * @author meetabl Team
 */

const express = require('express');
const { validateUserRegistration, validateUserLogin } = require('../middlewares/validation');
const { authenticateJWT } = require('../middlewares/auth');
const authController = require('../controllers/auth.controller');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', validateUserRegistration, authController.register);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', validateUserLogin, authController.login);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh auth token
 * @access Public
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private (requires authentication)
 */
router.post('/logout', authenticateJWT, authController.logout);

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @route POST /api/auth/verify-email
 * @desc Verify email with token
 * @access Public
 */
router.post('/verify-email', authController.verifyEmail);

module.exports = router;
