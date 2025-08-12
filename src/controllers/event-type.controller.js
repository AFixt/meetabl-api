/**
 * Event Type Controller
 * 
 * Handles CRUD operations for event types
 */

const { v4: uuidv4 } = require('uuid');
const { EventType, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

/**
 * Get all event types for the authenticated user
 */
const getEventTypes = async (req, res, next) => {
  try {
    const eventTypes = await EventType.findAll({
      where: { userId: req.user.id },
      order: [
        ['position', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: eventTypes
    });
  } catch (error) {
    logger.error('Error fetching event types:', error);
    next(error);
  }
};

/**
 * Get a single event type by ID
 */
const getEventType = async (req, res, next) => {
  try {
    const { id } = req.params;

    const eventType = await EventType.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!eventType) {
      return res.status(404).json({
        success: false,
        message: 'Event type not found'
      });
    }

    res.json({
      success: true,
      data: eventType
    });
  } catch (error) {
    logger.error('Error fetching event type:', error);
    next(error);
  }
};

/**
 * Transform snake_case fields to camelCase for Sequelize
 */
const transformRequestBody = (body) => {
  const transformed = {};
  
  // Map snake_case fields to camelCase
  const fieldMapping = {
    'location_type': 'locationType',
    'requires_confirmation': 'requiresConfirmation',
    'buffer_before': 'bufferBefore',
    'buffer_after': 'bufferAfter',
    'minimum_notice': 'minimumNotice',
    'maximum_advance': 'maximumAdvance',
    'reminder_minutes': 'reminderMinutes',
    'is_active': 'isActive'
  };
  
  // Copy all fields, transforming snake_case to camelCase where needed
  Object.keys(body).forEach(key => {
    const mappedKey = fieldMapping[key] || key;
    transformed[mappedKey] = body[key];
  });
  
  return transformed;
};

/**
 * Create a new event type
 */
const createEventType = async (req, res, next) => {
  try {
    // Check if user can add more event types
    const currentCount = await EventType.count({
      where: { userId: req.user.id }
    });

    const user = await User.findByPk(req.user.id);
    if (!user.canAddEventTypes(currentCount)) {
      const { PLAN_LIMITS } = require('../config/stripe-products');
      const planType = user.plan_type?.toUpperCase() || 'FREE';
      const planLimits = PLAN_LIMITS[planType] || PLAN_LIMITS.FREE;
      return res.status(403).json({
        success: false,
        message: `You have reached your event type limit of ${planLimits.maxEventTypes}. Please upgrade your plan to add more event types.`
      });
    }

    // Transform request body from snake_case to camelCase
    const transformedBody = transformRequestBody(req.body);

    // Generate unique slug
    const slug = await EventType.generateSlug(transformedBody.name, req.user.id);

    // Get next position
    const maxPosition = await EventType.max('position', {
      where: { userId: req.user.id }
    });

    const eventType = await EventType.create({
      ...transformedBody,
      id: uuidv4(),
      userId: req.user.id,
      slug,
      position: (maxPosition || 0) + 1
    });

    res.status(201).json({
      success: true,
      data: eventType
    });
  } catch (error) {
    logger.error('Error creating event type:', error);
    next(error);
  }
};

/**
 * Update an event type
 */
const updateEventType = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Transform request body from snake_case to camelCase
    const transformedBody = transformRequestBody(req.body);

    // Debug logging
    logger.info('Update event type request body:', req.body);
    logger.info('Transformed body:', transformedBody);
    
    const eventType = await EventType.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!eventType) {
      return res.status(404).json({
        success: false,
        message: 'Event type not found'
      });
    }

    // If name is being changed, regenerate slug
    if (transformedBody.name && transformedBody.name !== eventType.name) {
      transformedBody.slug = await EventType.generateSlug(transformedBody.name, req.user.id);
    }

    // Log before and after update
    logger.info('Before update - reminderMinutes:', eventType.reminderMinutes);
    await eventType.update(transformedBody);
    logger.info('After update - reminderMinutes:', eventType.reminderMinutes);

    res.json({
      success: true,
      data: eventType
    });
  } catch (error) {
    logger.error('Error updating event type:', error);
    next(error);
  }
};

/**
 * Delete an event type
 */
const deleteEventType = async (req, res, next) => {
  try {
    const { id } = req.params;

    const eventType = await EventType.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!eventType) {
      return res.status(404).json({
        success: false,
        message: 'Event type not found'
      });
    }

    await eventType.destroy();

    res.json({
      success: true,
      message: 'Event type deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting event type:', error);
    next(error);
  }
};

/**
 * Reorder event types
 */
const reorderEventTypes = async (req, res, next) => {
  try {
    const { eventTypeIds } = req.body;

    if (!Array.isArray(eventTypeIds)) {
      return res.status(400).json({
        success: false,
        message: 'eventTypeIds must be an array'
      });
    }

    // Verify all event types belong to the user
    const eventTypes = await EventType.findAll({
      where: {
        id: eventTypeIds,
        userId: req.user.id
      }
    });

    if (eventTypes.length !== eventTypeIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event type IDs'
      });
    }

    // Update positions
    const updates = eventTypeIds.map((id, index) => 
      EventType.update(
        { position: index },
        { where: { id, userId: req.user.id } }
      )
    );

    await Promise.all(updates);

    res.json({
      success: true,
      message: 'Event types reordered successfully'
    });
  } catch (error) {
    logger.error('Error reordering event types:', error);
    next(error);
  }
};

/**
 * Get all public event types for a user
 */
const getPublicEventTypes = async (req, res, next) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all active event types for this user
    const eventTypes = await EventType.findAll({
      where: {
        userId: user.id,
        isActive: true
      },
      attributes: [
        'id', 'name', 'slug', 'description', 'duration', 'color',
        'location', 'locationType', 'requiresConfirmation',
        'minimumNotice', 'maximumAdvance', 'isActive'
      ],
      order: [
        ['position', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: eventTypes
    });
  } catch (error) {
    logger.error('Error fetching public event types:', error);
    next(error);
  }
};

/**
 * Get public event type for booking
 */
const getPublicEventType = async (req, res, next) => {
  try {
    const { username, slug } = req.params;

    // Find user by username
    const user = await User.findOne({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find event type
    const eventType = await EventType.findOne({
      where: {
        userId: user.id,
        slug,
        isActive: true
      },
      attributes: [
        'id', 'name', 'description', 'duration', 'color',
        'location', 'locationType', 'requiresConfirmation',
        'minimumNotice', 'maximumAdvance', 'questions'
      ]
    });

    if (!eventType) {
      return res.status(404).json({
        success: false,
        message: 'Event type not found or inactive'
      });
    }

    res.json({
      success: true,
      data: {
        eventType,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          timezone: user.timezone
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching public event type:', error);
    next(error);
  }
};

module.exports = {
  getEventTypes,
  getEventType,
  createEventType,
  updateEventType,
  deleteEventType,
  reorderEventTypes,
  getPublicEventType,
  getPublicEventTypes
};