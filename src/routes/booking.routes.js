/**
 * Booking routes
 *
 * Defines routes for booking management
 *
 * @author meetabl Team
 */

const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');
const { validateUuid, validateBooking, validateGetRequest } = require('../middlewares/validation');
const bookingController = require('../controllers/booking.controller');
const subscriptionService = require('../services/subscription.service');

const router = express.Router();

// Private routes (require authentication)
router.use('/my', authenticateJWT);

/**
 * @route GET /api/bookings/my
 * @desc Get all bookings for current user
 * @access Private
 */
router.get('/my', validateGetRequest, bookingController.getUserBookings);

/**
 * @route POST /api/bookings/my
 * @desc Create new booking
 * @access Private
 */
router.post('/my', 
  validateBooking,
  subscriptionService.requireWithinLimit('bookings_per_month', async (req) => {
    const { Booking } = require('../models');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    return await Booking.count({
      where: {
        userId: req.user.id,
        startTime: {
          [require('sequelize').Op.gte]: startOfMonth
        }
      }
    });
  }),
  bookingController.createBooking
);

/**
 * @route GET /api/bookings/my/:id
 * @desc Get booking by ID
 * @access Private
 */
router.get('/my/:id', validateUuid, bookingController.getBooking);

/**
 * @route PUT /api/bookings/my/:id/cancel
 * @desc Cancel booking
 * @access Private
 */
router.put('/my/:id/cancel', validateUuid, bookingController.cancelBooking);

/**
 * @route PUT /api/bookings/my/:id/reschedule
 * @desc Reschedule booking
 * @access Private
 */
router.put('/my/:id/reschedule', validateUuid, validateBooking, bookingController.rescheduleBooking);

/**
 * @route POST /api/bookings/my/bulk-cancel
 * @desc Bulk cancel bookings
 * @access Private
 */
router.post('/my/bulk-cancel', bookingController.bulkCancelBookings);

// Public routes (no authentication required)

/**
 * @route GET /api/bookings/public/:username
 * @desc Get public booking availability for a user
 * @access Public
 */
router.get('/public/:username', bookingController.getPublicBookings);

/**
 * @route POST /api/bookings/public/:username
 * @desc Create public booking for a user
 * @access Public
 */
router.post('/public/:username', validateBooking, bookingController.createPublicBooking);

/**
 * @route GET /api/bookings/confirm/:token
 * @desc Confirm a booking request
 * @access Public
 */
router.get('/confirm/:token', bookingController.confirmBookingRequest);

/**
 * @route GET /api/bookings/approve/:token
 * @desc Approve a booking request by host
 * @access Public
 */
router.get('/approve/:token', bookingController.approveBookingRequest);

/**
 * @route POST /api/bookings/reject/:token
 * @desc Reject a booking request by host
 * @access Public
 */
router.post('/reject/:token', bookingController.rejectBookingRequest);

/**
 * @route POST /api/bookings/:id/approve
 * @desc Approve a booking request by ID (authenticated)
 * @access Private
 */
router.post('/:id/approve', authenticateJWT, bookingController.approveBookingById);

/**
 * @route POST /api/bookings/:id/reject
 * @desc Reject a booking request by ID (authenticated)
 * @access Private
 */
router.post('/:id/reject', authenticateJWT, bookingController.rejectBookingById);

module.exports = router;
