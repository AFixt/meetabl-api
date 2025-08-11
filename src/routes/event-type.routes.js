/**
 * Event Type Routes
 * 
 * Handles event type CRUD operations
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validation');
const { checkEventTypeLimit } = require('../middlewares/subscription');
const {
  getEventTypes,
  getEventType,
  createEventType,
  updateEventType,
  deleteEventType,
  reorderEventTypes,
  getPublicEventType,
  getPublicEventTypes
} = require('../controllers/event-type.controller');

// Validation rules
const createValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be less than 100 characters'),
  body('description')
    .optional()
    .trim(),
  body('duration')
    .optional()
    .isInt({ min: 5, max: 480 }).withMessage('Duration must be between 5 and 480 minutes'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex code'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Location must be less than 255 characters'),
  body('locationType')
    .optional()
    .isIn(['in_person', 'phone', 'video', 'custom']).withMessage('Invalid location type'),
  body('requiresConfirmation')
    .optional()
    .isBoolean().withMessage('Requires confirmation must be a boolean'),
  body('bufferBefore')
    .optional()
    .isInt({ min: 0, max: 120 }).withMessage('Buffer before must be between 0 and 120 minutes'),
  body('bufferAfter')
    .optional()
    .isInt({ min: 0, max: 120 }).withMessage('Buffer after must be between 0 and 120 minutes'),
  body('minimumNotice')
    .optional()
    .isInt({ min: 0, max: 20160 }).withMessage('Minimum notice must be between 0 and 14 days'),
  body('maximumAdvance')
    .optional()
    .isInt({ min: 1440, max: 525600 }).withMessage('Maximum advance must be between 1 and 365 days'),
  body('reminderMinutes')
    .optional()
    .isInt({ min: 0, max: 10080 }).withMessage('Reminder minutes must be between 0 and 7 days'),
  body('questions')
    .optional()
    .isArray().withMessage('Questions must be an array'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('Is active must be a boolean')
];

const updateValidation = [
  param('id').isUUID().withMessage('Invalid event type ID'),
  ...createValidation
];

const reorderValidation = [
  body('eventTypeIds')
    .isArray().withMessage('Event type IDs must be an array')
    .notEmpty().withMessage('Event type IDs cannot be empty')
];

// Protected routes
router.get('/', authenticate, getEventTypes);
router.get('/:id', authenticate, param('id').isUUID(), validateRequest, getEventType);
router.post('/', authenticate, checkEventTypeLimit, createValidation, validateRequest, createEventType);
router.put('/:id', authenticate, updateValidation, validateRequest, updateEventType);
router.delete('/:id', authenticate, param('id').isUUID(), validateRequest, deleteEventType);
router.post('/reorder', authenticate, reorderValidation, validateRequest, reorderEventTypes);

// Public routes
router.get('/public/:username/:slug', getPublicEventType);
router.get('/user/:username', getPublicEventTypes);

module.exports = router;