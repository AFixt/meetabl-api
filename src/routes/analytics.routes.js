/**
 * Analytics routes
 *
 * Defines routes for analytics and reporting
 *
 * @author meetabl Team
 */

const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');
const analyticsController = require('../controllers/analytics.controller');
const subscriptionService = require('../services/subscription.service');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Analytics requires professional or enterprise plan
router.use(subscriptionService.requireFeature('analytics'));

/**
 * @route GET /api/analytics/bookings/stats
 * @desc Get booking statistics
 * @access Private
 */
router.get('/bookings/stats', analyticsController.getBookingStats);

/**
 * @route GET /api/analytics/users/me
 * @desc Get user analytics
 * @access Private
 */
router.get('/users/me', analyticsController.getUserAnalytics);

/**
 * @route GET /api/analytics/bookings/export
 * @desc Export bookings data
 * @access Private
 */
router.get('/bookings/export', analyticsController.exportBookings);

/**
 * @route GET /api/analytics/revenue
 * @desc Get revenue analytics (placeholder for future payment integration)
 * @access Private
 */
router.get('/revenue', analyticsController.getRevenueAnalytics);

module.exports = router;