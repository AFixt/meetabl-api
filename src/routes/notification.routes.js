/**
 * Notification routes
 *
 * Defines routes for notification management
 *
 * @author meetabl Team
 */

const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');
const { validateUuid } = require('../middlewares/validation');
const notificationController = require('../controllers/notification.controller');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

/**
 * @route GET /api/notifications
 * @desc Get notification history for current user
 * @access Private
 */
router.get('/', notificationController.getNotificationHistory);

/**
 * @route GET /api/notifications/stats
 * @desc Get notification statistics
 * @access Private
 */
router.get('/stats', notificationController.getNotificationStats);

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark notification as read
 * @access Private
 */
router.put('/:id/read', validateUuid, notificationController.markNotificationRead);

/**
 * @route POST /api/notifications/:id/resend
 * @desc Resend failed notification
 * @access Private
 */
router.post('/:id/resend', validateUuid, notificationController.resendNotification);

/**
 * @route POST /api/notifications/test
 * @desc Send test notification
 * @access Private
 */
router.post('/test', notificationController.sendTestNotification);

module.exports = router;