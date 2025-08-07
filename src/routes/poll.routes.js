/**
 * Poll routes
 *
 * Defines all poll-related API endpoints
 * Meeting polls feature for Professional plan users
 *
 * @author meetabl Team
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const pollController = require('../controllers/poll.controller');
const authMiddleware = require('../middlewares/auth');
const { requireMeetingPolls } = require('../middlewares/subscription');
const validationMiddleware = require('../middlewares/validation');

// Validation schemas
const createPollValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 15, max: 1440 })
    .withMessage('Duration must be between 15 and 1440 minutes'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a valid string'),
  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid ISO 8601 date'),
  body('maxVotesPerParticipant')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max votes per participant must be between 1 and 10'),
  body('allowAnonymousVotes')
    .optional()
    .isBoolean()
    .withMessage('Allow anonymous votes must be a boolean'),
  body('requireParticipantDetails')
    .optional()
    .isBoolean()
    .withMessage('Require participant details must be a boolean'),
  body('timeSlots')
    .isArray({ min: 1, max: 20 })
    .withMessage('Time slots must be an array with 1-20 items'),
  body('timeSlots.*.startTime')
    .isISO8601()
    .withMessage('Each time slot must have a valid start time'),
  body('timeSlots.*.endTime')
    .isISO8601()
    .withMessage('Each time slot must have a valid end time'),
  body('notificationSettings')
    .optional()
    .isObject()
    .withMessage('Notification settings must be an object')
];

const updatePollValidation = [
  body('title')
    .optional()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid ISO 8601 date'),
  body('maxVotesPerParticipant')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max votes per participant must be between 1 and 10'),
  body('allowAnonymousVotes')
    .optional()
    .isBoolean()
    .withMessage('Allow anonymous votes must be a boolean'),
  body('requireParticipantDetails')
    .optional()
    .isBoolean()
    .withMessage('Require participant details must be a boolean'),
  body('notificationSettings')
    .optional()
    .isObject()
    .withMessage('Notification settings must be an object')
];

const submitVotesValidation = [
  body('participantName')
    .notEmpty()
    .withMessage('Participant name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Participant name must be between 1 and 100 characters'),
  body('participantEmail')
    .isEmail()
    .withMessage('Valid participant email is required')
    .normalizeEmail(),
  body('timeSlotIds')
    .isArray({ min: 1, max: 10 })
    .withMessage('Time slot IDs must be an array with 1-10 items'),
  body('timeSlotIds.*')
    .isUUID()
    .withMessage('Each time slot ID must be a valid UUID')
];

const finalizePollValidation = [
  body('selectedTimeSlotId')
    .isUUID()
    .withMessage('Selected time slot ID must be a valid UUID')
];

const pollIdValidation = [
  param('pollId')
    .isUUID()
    .withMessage('Poll ID must be a valid UUID')
];

const tokenValidation = [
  param('token')
    .isAlphanumeric()
    .isLength({ min: 32, max: 32 })
    .withMessage('Invalid poll token')
];

const queryValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be 0 or greater'),
  query('order')
    .optional()
    .isIn(['created', 'updated', 'title', 'deadline'])
    .withMessage('Order must be one of: created, updated, title, deadline'),
  query('dir')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Direction must be asc or desc'),
  query('status')
    .optional()
    .isIn(['active', 'closed', 'finalized'])
    .withMessage('Status must be one of: active, closed, finalized')
];

// Protected routes (require authentication and Professional plan)
router.use(authMiddleware.authenticate);
router.use(requireMeetingPolls);

/**
 * @swagger
 * /api/polls:
 *   get:
 *     summary: Get all polls for current user
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [created, updated, title, deadline]
 *           default: created
 *       - in: query
 *         name: dir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, closed, finalized]
 *     responses:
 *       200:
 *         description: Polls retrieved successfully
 *       403:
 *         description: Professional plan required
 */
router.get('/',
  queryValidation,
  validationMiddleware.validateRequest,
  pollController.getUserPolls
);

/**
 * @swagger
 * /api/polls:
 *   post:
 *     summary: Create a new poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - timeSlots
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               durationMinutes:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 1440
 *                 default: 60
 *               timezone:
 *                 type: string
 *                 default: UTC
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               maxVotesPerParticipant:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 default: 3
 *               allowAnonymousVotes:
 *                 type: boolean
 *                 default: false
 *               requireParticipantDetails:
 *                 type: boolean
 *                 default: true
 *               timeSlots:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 20
 *                 items:
 *                   type: object
 *                   required:
 *                     - startTime
 *                     - endTime
 *                   properties:
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       201:
 *         description: Poll created successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Professional plan required
 */
router.post('/',
  createPollValidation,
  validationMiddleware.validateRequest,
  pollController.createPoll
);

/**
 * @swagger
 * /api/polls/{pollId}:
 *   get:
 *     summary: Get poll by ID (owner only)
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Poll retrieved successfully
 *       404:
 *         description: Poll not found
 *       403:
 *         description: Professional plan required
 */
router.get('/:pollId',
  pollIdValidation,
  validationMiddleware.validateRequest,
  pollController.getPoll
);

/**
 * @swagger
 * /api/polls/{pollId}:
 *   put:
 *     summary: Update poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               maxVotesPerParticipant:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *               allowAnonymousVotes:
 *                 type: boolean
 *               requireParticipantDetails:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Poll updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Poll not found
 *       403:
 *         description: Professional plan required
 */
router.put('/:pollId',
  pollIdValidation,
  updatePollValidation,
  validationMiddleware.validateRequest,
  pollController.updatePoll
);

/**
 * @swagger
 * /api/polls/{pollId}/finalize:
 *   post:
 *     summary: Finalize poll with selected time slot
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - selectedTimeSlotId
 *             properties:
 *               selectedTimeSlotId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Poll finalized successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Poll not found
 *       403:
 *         description: Professional plan required
 */
router.post('/:pollId/finalize',
  pollIdValidation,
  finalizePollValidation,
  validationMiddleware.validateRequest,
  pollController.finalizePoll
);

/**
 * @swagger
 * /api/polls/{pollId}/close:
 *   post:
 *     summary: Close poll (stop accepting votes)
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Poll closed successfully
 *       400:
 *         description: Poll cannot be closed
 *       404:
 *         description: Poll not found
 *       403:
 *         description: Professional plan required
 */
router.post('/:pollId/close',
  pollIdValidation,
  validationMiddleware.validateRequest,
  pollController.closePoll
);

/**
 * @swagger
 * /api/polls/{pollId}:
 *   delete:
 *     summary: Delete poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Poll deleted successfully
 *       400:
 *         description: Poll cannot be deleted
 *       404:
 *         description: Poll not found
 *       403:
 *         description: Professional plan required
 */
router.delete('/:pollId',
  pollIdValidation,
  validationMiddleware.validateRequest,
  pollController.deletePoll
);

// Public routes (no authentication required)
const publicRouter = express.Router();

/**
 * @swagger
 * /api/polls/public/{token}:
 *   get:
 *     summary: Get poll by public token (for participants)
 *     tags: [Polls]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-f0-9]{32}$'
 *     responses:
 *       200:
 *         description: Poll retrieved successfully
 *       404:
 *         description: Poll not found
 *       400:
 *         description: Poll is no longer active
 */
publicRouter.get('/public/:token',
  tokenValidation,
  validationMiddleware.validateRequest,
  pollController.getPollByToken
);

/**
 * @swagger
 * /api/polls/public/{token}/vote:
 *   post:
 *     summary: Submit votes for poll (public endpoint)
 *     tags: [Polls]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-f0-9]{32}$'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantName
 *               - participantEmail
 *               - timeSlotIds
 *             properties:
 *               participantName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               participantEmail:
 *                 type: string
 *                 format: email
 *               timeSlotIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Votes submitted successfully
 *       400:
 *         description: Invalid input data or poll not active
 *       404:
 *         description: Poll not found
 */
publicRouter.post('/public/:token/vote',
  tokenValidation,
  submitVotesValidation,
  validationMiddleware.validateRequest,
  pollController.submitVotes
);

// Combine routers
const combinedRouter = express.Router();
combinedRouter.use(router);
combinedRouter.use(publicRouter);

module.exports = combinedRouter;