/**
 * Availability routes
 *
 * Defines routes for availability rule management
 *
 * @author meetabl Team
 */

const express = require('express');
const { authenticateJWT } = require('../middlewares/auth');
const { checkEventTypeLimit } = require('../middlewares/subscription');
const { validateUuid, validateAvailabilityRule, validateGetRequest } = require('../middlewares/validation');
const availabilityController = require('../controllers/availability.controller');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

/**
 * @route GET /api/availability/rules
 * @desc Get all availability rules for current user
 * @access Private
 */
router.get('/rules', validateGetRequest, availabilityController.getAvailabilityRules);

/**
 * @route POST /api/availability/rules
 * @desc Create new availability rule (limited by subscription plan)
 * @access Private
 */
router.post('/rules', checkEventTypeLimit, validateAvailabilityRule, availabilityController.createAvailabilityRule);

/**
 * @route GET /api/availability/rules/:id
 * @desc Get availability rule by ID
 * @access Private
 */
router.get('/rules/:id', validateUuid, availabilityController.getAvailabilityRule);

/**
 * @route PUT /api/availability/rules/:id
 * @desc Update availability rule
 * @access Private
 */
router.put('/rules/:id', validateUuid, validateAvailabilityRule, availabilityController.updateAvailabilityRule);

/**
 * @route DELETE /api/availability/rules/:id
 * @desc Delete availability rule
 * @access Private
 */
router.delete('/rules/:id', validateUuid, availabilityController.deleteAvailabilityRule);

/**
 * @route GET /api/availability/slots
 * @desc Get available time slots for a date
 * @access Private
 */
router.get('/slots', availabilityController.getAvailableTimeSlots);

module.exports = router;
