/**
 * Authentication routes
 *
 * Defines routes for user registration, login, and token management
 *
 * @author AccessMeet Team
 */

const express = require('express');
const { validateUserRegistration, validateUserLogin } = require('../middlewares/validation');
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

module.exports = router;
