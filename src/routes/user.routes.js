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

// Public routes (no authentication required)
/**
 * @route GET /api/users/public/:username
 * @desc Get public profile data
 * @access Public
 */
router.get('/public/:username', userController.getPublicProfile);

// Apply authentication middleware for all routes below
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
router.post('/me/logo',
  (req, res, next) => {
    console.log('[ROUTE /me/logo] ===================');
    console.log('[ROUTE /me/logo] Request received at:', new Date().toISOString());
    console.log('[ROUTE /me/logo] Method:', req.method);
    console.log('[ROUTE /me/logo] URL:', req.url);
    console.log('[ROUTE /me/logo] User authenticated:', req.user ? 'YES' : 'NO');
    console.log('[ROUTE /me/logo] User ID:', req.user ? req.user.id : 'NO USER');
    console.log('[ROUTE /me/logo] Content-Type:', req.get('content-type'));
    console.log('[ROUTE /me/logo] Content-Length:', req.get('content-length'));
    console.log('[ROUTE /me/logo] Connection state:', req.socket.readyState);
    console.log('[ROUTE /me/logo] Socket destroyed:', req.socket.destroyed);
    
    // Monitor connection events
    req.socket.on('close', () => {
      console.log('[ROUTE /me/logo SOCKET] Socket closed unexpectedly!');
    });
    
    req.socket.on('error', (err) => {
      console.error('[ROUTE /me/logo SOCKET ERROR]', err.message, err.code);
    });
    
    req.on('aborted', () => {
      console.log('[ROUTE /me/logo ABORTED] Client aborted the request!');
    });
    
    req.on('close', () => {
      console.log('[ROUTE /me/logo CLOSE] Request closed!');
    });
    
    console.log('[ROUTE /me/logo] Calling multer upload.single...');
    
    // Wrap multer to catch errors
    const multerMiddleware = userController.upload.single('logo');
    multerMiddleware(req, res, (err) => {
      if (err) {
        console.error('[ROUTE /me/logo MULTER ERROR]', err.message, err.code, err.stack);
        return res.status(400).json({ error: err.message });
      }
      console.log('[ROUTE /me/logo] Multer processing complete');
      next();
    });
  },
  (req, res, next) => {
    console.log('[ROUTE /me/logo AFTER MULTER] ===================');
    console.log('[ROUTE /me/logo AFTER MULTER] File uploaded:', req.file ? 'YES' : 'NO');
    if (req.file) {
      console.log('[ROUTE /me/logo AFTER MULTER] File details:', JSON.stringify(req.file, null, 2));
    }
    console.log('[ROUTE /me/logo AFTER MULTER] Body:', JSON.stringify(req.body, null, 2));
    console.log('[ROUTE /me/logo AFTER MULTER] Calling controller...');
    next();
  },
  userController.uploadLogo
);

/**
 * @route DELETE /api/users/me/logo
 * @desc Delete logo image
 * @access Private
 */
router.delete('/me/logo', userController.deleteLogo);

/**
 * @route POST /api/users/me/avatar
 * @desc Upload avatar image
 * @access Private
 */
router.post('/me/avatar',
  userController.upload.single('avatar'),
  userController.uploadAvatar
);

/**
 * @route DELETE /api/users/me/avatar
 * @desc Delete avatar image
 * @access Private
 */
router.delete('/me/avatar', userController.deleteAvatar);

module.exports = router;
