/**
 * Availability controller
 *
 * Handles availability rules and time slot management
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const logger = require('../config/logger');
const { AvailabilityRule, Booking, AuditLog } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Get availability rules for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAvailabilityRules = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all rules for this user
    const rules = await AvailabilityRule.findAll({
      where: { user_id: userId }
    });

    // Calculate pagination headers
    const totalCount = rules.length;

    // Set pagination headers
    res.set({
      'X-Total-Count': totalCount,
      'X-Total-Pages': Math.ceil(totalCount / 100),
      'X-Per-Page': 100,
      'X-Current-Page': 1
    });

    return res.status(200).json(rules);
  } catch (error) {
    logger.error('Error getting availability rules:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get availability rules'
      }
    });
  }
};

/**
 * Create availability rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createAvailabilityRule = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      buffer_minutes: bufferMinutes,
      max_bookings_per_day: maxBookingsPerDay
    } = req.body;

    // Validate time range
    if (startTime >= endTime) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'End time must be after start time',
          params: [
            {
              param: 'end_time',
              message: 'End time must be after start time'
            }
          ]
        }
      });
    }

    // Create rule
    const rule = await AvailabilityRule.create({
      id: uuidv4(),
      user_id: userId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      buffer_minutes: bufferMinutes,
      max_bookings_per_day: maxBookingsPerDay
    });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'availability.rule.create',
      metadata: {
        ruleId: rule.id,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        buffer_minutes: bufferMinutes,
        max_bookings_per_day: maxBookingsPerDay
      }
    });

    // Log creation
    logger.info(`Availability rule created: ${rule.id}`);

    return res.status(201).json(rule);
  } catch (error) {
    logger.error('Error creating availability rule:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to create availability rule'
      }
    });
  }
};

/**
 * Get availability rule by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAvailabilityRule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find rule
    const rule = await AvailabilityRule.findOne({
      where: { id, user_id: userId }
    });

    if (!rule) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Availability rule not found'
        }
      });
    }

    return res.status(200).json(rule);
  } catch (error) {
    logger.error('Error getting availability rule:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get availability rule'
      }
    });
  }
};

/**
 * Update availability rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateAvailabilityRule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      buffer_minutes: bufferMinutes,
      max_bookings_per_day: maxBookingsPerDay
    } = req.body;

    // Find rule
    const rule = await AvailabilityRule.findOne({
      where: { id, user_id: userId }
    });

    if (!rule) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Availability rule not found'
        }
      });
    }

    // Validate time range if both times are provided
    if (startTime && endTime && startTime >= endTime) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'End time must be after start time',
          params: [
            {
              param: 'end_time',
              message: 'End time must be after start time'
            }
          ]
        }
      });
    }

    // Update fields
    if (dayOfWeek !== undefined) rule.day_of_week = dayOfWeek;
    if (startTime !== undefined) rule.start_time = startTime;
    if (endTime !== undefined) rule.end_time = endTime;
    if (bufferMinutes !== undefined) rule.buffer_minutes = bufferMinutes;
    if (maxBookingsPerDay !== undefined) rule.max_bookings_per_day = maxBookingsPerDay;

    await rule.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'availability.rule.update',
      metadata: {
        ruleId: rule.id,
        updated: {
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          buffer_minutes: bufferMinutes,
          max_bookings_per_day: maxBookingsPerDay
        }
      }
    });

    // Log update
    logger.info(`Availability rule updated: ${rule.id}`);

    return res.status(200).json(rule);
  } catch (error) {
    logger.error('Error updating availability rule:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to update availability rule'
      }
    });
  }
};

/**
 * Delete availability rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAvailabilityRule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find rule
    const rule = await AvailabilityRule.findOne({
      where: { id, user_id: userId }
    });

    if (!rule) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Availability rule not found'
        }
      });
    }

    // Delete rule
    await rule.destroy();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'availability.rule.delete',
      metadata: {
        ruleId: id
      }
    });

    // Log deletion
    logger.info(`Availability rule deleted: ${id}`);

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting availability rule:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to delete availability rule'
      }
    });
  }
};

/**
 * Get available time slots for a specific date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAvailableTimeSlots = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, duration } = req.query;

    // Validate date
    if (!date || !moment(date, 'YYYY-MM-DD').isValid()) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Valid date is required (YYYY-MM-DD)',
          params: [
            {
              param: 'date',
              message: 'Valid date is required (YYYY-MM-DD)'
            }
          ]
        }
      });
    }

    // Validate duration
    const slotDuration = parseInt(duration, 10) || 60; // Default 60 minutes
    if (slotDuration < 15 || slotDuration > 240) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Duration must be between 15 and 240 minutes',
          params: [
            {
              param: 'duration',
              message: 'Duration must be between 15 and 240 minutes'
            }
          ]
        }
      });
    }

    // Parse date and get day of week (0 = Sunday, 6 = Saturday)
    const targetDate = moment(date, 'YYYY-MM-DD');
    const dayOfWeek = targetDate.day();

    // Get availability rules for this day of week
    const rules = await AvailabilityRule.findAll({
      where: { user_id: userId, day_of_week: dayOfWeek }
    });

    if (rules.length === 0) {
      return res.status(200).json([]);
    }

    // Get bookings for this date
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    const bookings = await Booking.findAll({
      where: {
        user_id: userId,
        start_time: { [sequelize.Op.gte]: startOfDay },
        end_time: { [sequelize.Op.lte]: endOfDay },
        status: 'confirmed'
      }
    });

    // Calculate available slots for each rule
    const allSlots = [];

    // Use forEach instead of for...of
    rules.forEach((rule) => {
      // Parse rule times
      const startTime = moment(rule.start_time, 'HH:mm:ss');
      const endTime = moment(rule.end_time, 'HH:mm:ss');

      // Create slots with specified duration
      const slotStart = moment(targetDate)
        .hours(startTime.hours())
        .minutes(startTime.minutes())
        .seconds(0);
      const ruleEnd = moment(targetDate)
        .hours(endTime.hours())
        .minutes(endTime.minutes())
        .seconds(0);

      while (slotStart.add(slotDuration, 'minutes').isSameOrBefore(ruleEnd)) {
        const slot = {
          start: moment(slotStart).subtract(slotDuration, 'minutes').toISOString(),
          end: slotStart.toISOString()
        };

        // Check if slot conflicts with any booking
        const isConflict = bookings.some((booking) => {
          const bookingStart = moment(booking.start_time);
          const bookingEnd = moment(booking.end_time);

          // Check for overlap
          const normalOverlap = moment(slot.start).isBefore(bookingEnd)
            && moment(slot.end).isAfter(bookingStart);

          const bufferOverlap = moment(slot.start).add(rule.buffer_minutes, 'minutes').isBefore(bookingEnd)
            && moment(slot.end).subtract(rule.buffer_minutes, 'minutes').isAfter(bookingStart);

          return normalOverlap || bufferOverlap;
        });

        // Add slot if no conflict
        if (!isConflict) {
          allSlots.push(slot);
        }
      }
    });

    // Sort slots by start time
    allSlots.sort((a, b) => moment(a.start).diff(moment(b.start)));

    return res.status(200).json(allSlots);
  } catch (error) {
    logger.error('Error getting available time slots:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get available time slots'
      }
    });
  }
};

module.exports = {
  getAvailabilityRules,
  createAvailabilityRule,
  getAvailabilityRule,
  updateAvailabilityRule,
  deleteAvailabilityRule,
  getAvailableTimeSlots
};
