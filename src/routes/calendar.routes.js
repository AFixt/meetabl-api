/**
 * Calendar routes
 *
 * Defines routes for calendar integration
 *
 * @author meetabl Team
 */

const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');
const { requireIntegrations, checkCalendarLimit } = require('../middlewares/subscription');
const calendarController = require('../controllers/calendar.controller');

const router = express.Router();

// Apply authentication middleware to protected routes
router.use(['/status', '/disconnect', '/google/auth', '/microsoft/auth'], authenticateJWT);

/**
 * @route GET /api/calendar/status
 * @desc Get calendar integration status
 * @access Private
 */
router.get('/status', calendarController.getCalendarStatus);

/**
 * @route DELETE /api/calendar/disconnect/:provider
 * @desc Disconnect calendar integration
 * @access Private
 */
router.delete('/disconnect/:provider', calendarController.disconnectCalendar);

/**
 * @route GET /api/calendar/google/status
 * @desc Get Google Calendar integration status
 * @access Public
 */
router.get('/google/status', calendarController.getGoogleStatus);

/**
 * @route GET /api/calendar/google/auth
 * @desc Get Google OAuth authorization URL
 * @access Private (Requires integration access and calendar limit check)
 */
router.get('/google/auth', requireIntegrations, checkCalendarLimit, calendarController.getGoogleAuthUrl);

/**
 * @route GET /api/calendar/google/callback
 * @desc Handle Google OAuth callback
 * @access Public
 */
router.get('/google/callback', calendarController.handleGoogleCallback);

/**
 * @route GET /api/calendar/microsoft/status
 * @desc Get Microsoft Calendar integration status
 * @access Public
 */
router.get('/microsoft/status', calendarController.getMicrosoftStatus);

/**
 * @route GET /api/calendar/microsoft/auth
 * @desc Get Microsoft OAuth authorization URL
 * @access Private (Requires integration access and calendar limit check)
 */
router.get('/microsoft/auth', requireIntegrations, checkCalendarLimit, calendarController.getMicrosoftAuthUrl);

/**
 * @route GET /api/calendar/microsoft/callback
 * @desc Handle Microsoft OAuth callback
 * @access Public
 */
router.get('/microsoft/callback', calendarController.handleMicrosoftCallback);

module.exports = router;
