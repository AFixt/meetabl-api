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
router.post('/my', validateBooking, bookingController.createBooking);

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

module.exports = router;
