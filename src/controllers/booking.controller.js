/**
 * Booking controller
 *
 * Handles meeting/appointment bookings
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const logger = require('../config/logger');
const {
  Booking, User, Notification, AuditLog, AvailabilityRule
} = require('../models');
const { sequelize } = require('../config/database');
const notificationService = require('../services/notification.service');
const calendarService = require('../services/calendar.service');

/**
 * Get all bookings for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 100, offset = 0, order = 'start_time', dir = 'desc'
    } = req.query;

    // Find all bookings for this user
    const bookings = await Booking.findAndCountAll({
      where: { user_id: userId },
      limit,
      offset,
      order: [[order, dir]],
      include: [{
        model: Notification,
        required: false
      }]
    });

    // Set pagination headers
    res.set({
      'X-Total-Count': bookings.count,
      'X-Total-Pages': Math.ceil(bookings.count / limit),
      'X-Per-Page': limit,
      'X-Current-Page': Math.floor(offset / limit) + 1
    });

    return res.status(200).json(bookings.rows);
  } catch (error) {
    logger.error('Error getting user bookings:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get bookings'
      }
    });
  }
};

/**
 * Create a new booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createBooking = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const {
      customer_name, customer_email, start_time, end_time
    } = req.body;

    // Validate datetime format
    if (!moment(start_time).isValid() || !moment(end_time).isValid()) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Invalid date format',
          params: [
            {
              param: 'start_time',
              message: 'Start time must be a valid ISO 8601 date-time'
            },
            {
              param: 'end_time',
              message: 'End time must be a valid ISO 8601 date-time'
            }
          ]
        }
      });
    }

    // Validate time range
    if (moment(start_time).isSameOrAfter(moment(end_time))) {
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

    // Check for overlapping bookings
    const overlappingBookings = await Booking.findOne({
      where: {
        user_id: userId,
        status: 'confirmed',
        [sequelize.Op.or]: [
          {
            // Starts during another booking
            start_time: {
              [sequelize.Op.lt]: end_time,
              [sequelize.Op.gte]: start_time
            }
          },
          {
            // Ends during another booking
            end_time: {
              [sequelize.Op.lte]: end_time,
              [sequelize.Op.gt]: start_time
            }
          },
          {
            // Completely overlaps another booking
            start_time: {
              [sequelize.Op.lte]: start_time
            },
            end_time: {
              [sequelize.Op.gte]: end_time
            }
          }
        ]
      }
    });

    if (overlappingBookings) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Time slot is not available',
          params: [
            {
              param: 'start_time',
              message: 'Time slot overlaps with an existing booking'
            }
          ]
        }
      });
    }

    // Create booking
    const bookingId = uuidv4();
    const booking = await Booking.create({
      id: bookingId,
      user_id: userId,
      customer_name,
      customer_email,
      start_time,
      end_time,
      status: 'confirmed'
    }, { transaction });

    // Create email notification
    await Notification.create({
      id: uuidv4(),
      booking_id: bookingId,
      type: 'email',
      status: 'pending'
    }, { transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'booking.create',
      metadata: {
        bookingId,
        customer_email,
        start_time,
        end_time
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log booking creation
    logger.info(`Booking created: ${bookingId}`);

    // Queue email notification job
    await notificationService.queueNotification(bookingId, 'email');
    
    // Create calendar event if user has calendar integration
    try {
      await calendarService.createCalendarEvent(booking);
    } catch (calendarError) {
      logger.error(`Failed to create calendar event for booking ${bookingId}:`, calendarError);
      // Non-critical error, don't fail the booking creation
    }

    return res.status(201).json(booking);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error creating booking:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to create booking'
      }
    });
  }
};

/**
 * Get booking by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find booking
    const booking = await Booking.findOne({
      where: { id, user_id: userId },
      include: [{
        model: Notification,
        required: false
      }]
    });

    if (!booking) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Booking not found'
        }
      });
    }

    return res.status(200).json(booking);
  } catch (error) {
    logger.error('Error getting booking:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get booking'
      }
    });
  }
};

/**
 * Cancel booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const cancelBooking = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find booking
    const booking = await Booking.findOne({
      where: { id, user_id: userId }
    });

    if (!booking) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Booking not found'
        }
      });
    }

    // Check if booking is already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Booking is already cancelled'
        }
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    await booking.save({ transaction });

    // Create cancellation notification
    await Notification.create({
      id: uuidv4(),
      booking_id: id,
      type: 'email',
      status: 'pending'
    }, { transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'booking.cancel',
      metadata: {
        bookingId: id
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log cancellation
    logger.info(`Booking cancelled: ${id}`);

    // Queue email notification job for cancellation
    await notificationService.queueNotification(id, 'email');
    
    // Update calendar event if user has calendar integration
    try {
      // In a real implementation, we would update or delete the calendar event
      // For now, we'll create a new event with the cancelled status
      booking.description = 'CANCELLED: ' + (booking.description || '');
      await calendarService.createCalendarEvent(booking);
    } catch (calendarError) {
      logger.error(`Failed to update calendar event for cancelled booking ${id}:`, calendarError);
      // Non-critical error, don't fail the cancellation
    }

    return res.status(200).json(booking);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error cancelling booking:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to cancel booking'
      }
    });
  }
};

/**
 * Get public bookings for a user (by username or ID)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPublicBookings = async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({
      where: {
        [sequelize.Op.or]: [
          { name: username }, // Check if username matches name
          { id: username } // Check if username matches ID
        ]
      }
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'User not found'
        }
      });
    }

    const userId = user.id;
    const { date, duration = 60 } = req.query;

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

    // Parse date and get day of week (0 = Sunday, 6 = Saturday)
    const targetDate = moment(date, 'YYYY-MM-DD');
    const dayOfWeek = targetDate.day();
    
    // Validate duration
    const slotDuration = parseInt(duration) || 60; // Default 60 minutes
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

    // Get availability rules for this day of week
    const rules = await AvailabilityRule.findAll({
      where: { user_id: userId, day_of_week: dayOfWeek }
    });

    if (rules.length === 0) {
      return res.status(200).json({
        user: {
          id: user.id,
          name: user.name
        },
        date,
        available_slots: []
      });
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

    for (const rule of rules) {
      // Parse rule times
      const startTime = moment(rule.start_time, 'HH:mm:ss');
      const endTime = moment(rule.end_time, 'HH:mm:ss');

      // Create slots with specified duration
      const slotStart = moment(targetDate).hours(startTime.hours()).minutes(startTime.minutes()).seconds(0);
      const ruleEnd = moment(targetDate).hours(endTime.hours()).minutes(endTime.minutes()).seconds(0);

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
          return (
            (moment(slot.start).isBefore(bookingEnd) && moment(slot.end).isAfter(bookingStart))
            || (moment(slot.start).add(rule.buffer_minutes, 'minutes').isBefore(bookingEnd)
            && moment(slot.end).subtract(rule.buffer_minutes, 'minutes').isAfter(bookingStart))
          );
        });

        // Add slot if no conflict
        if (!isConflict) {
          allSlots.push(slot);
        }
      }
    }

    // Sort slots by start time
    allSlots.sort((a, b) => moment(a.start).diff(moment(b.start)));

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name
      },
      date,
      available_slots: allSlots
    });
  } catch (error) {
    logger.error('Error getting public bookings:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get available booking slots'
      }
    });
  }
};

/**
 * Create public booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createPublicBooking = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { username } = req.params;
    const {
      customer_name, customer_email, start_time, end_time
    } = req.body;

    // Find user by username
    const user = await User.findOne({
      where: {
        [sequelize.Op.or]: [
          { name: username }, // Check if username matches name
          { id: username } // Check if username matches ID
        ]
      }
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'User not found'
        }
      });
    }

    const userId = user.id;

    // Validate datetime format and range
    if (!moment(start_time).isValid() || !moment(end_time).isValid()
        || moment(start_time).isSameOrAfter(moment(end_time))) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Invalid date/time format or range',
          params: [
            {
              param: 'start_time',
              message: 'Start time must be a valid ISO 8601 date-time'
            },
            {
              param: 'end_time',
              message: 'End time must be after start time'
            }
          ]
        }
      });
    }

    // Check for overlapping bookings
    const overlappingBookings = await Booking.findOne({
      where: {
        user_id: userId,
        status: 'confirmed',
        [sequelize.Op.or]: [
          {
            start_time: {
              [sequelize.Op.lt]: end_time,
              [sequelize.Op.gte]: start_time
            }
          },
          {
            end_time: {
              [sequelize.Op.lte]: end_time,
              [sequelize.Op.gt]: start_time
            }
          },
          {
            start_time: {
              [sequelize.Op.lte]: start_time
            },
            end_time: {
              [sequelize.Op.gte]: end_time
            }
          }
        ]
      }
    });

    if (overlappingBookings) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Time slot is not available',
          params: [
            {
              param: 'start_time',
              message: 'Time slot overlaps with an existing booking'
            }
          ]
        }
      });
    }

    // Create booking
    const bookingId = uuidv4();
    const booking = await Booking.create({
      id: bookingId,
      user_id: userId,
      customer_name,
      customer_email,
      start_time,
      end_time,
      status: 'confirmed'
    }, { transaction });

    // Create email notifications for both user and customer
    await Notification.create({
      id: uuidv4(),
      booking_id: bookingId,
      type: 'email',
      status: 'pending'
    }, { transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'booking.public.create',
      metadata: {
        bookingId,
        customer_name,
        customer_email,
        start_time,
        end_time
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log booking creation
    logger.info(`Public booking created: ${bookingId}`);

    // Queue email notification jobs for both user and customer
    await notificationService.queueNotification(bookingId, 'email');
    
    // Create calendar event if user has calendar integration
    try {
      await calendarService.createCalendarEvent(booking);
    } catch (calendarError) {
      logger.error(`Failed to create calendar event for public booking ${bookingId}:`, calendarError);
      // Non-critical error, don't fail the booking creation
    }

    return res.status(201).json({
      id: booking.id,
      customer_name: booking.customer_name,
      start_time: booking.start_time,
      end_time: booking.end_time,
      status: booking.status
    });
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error creating public booking:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to create booking'
      }
    });
  }
};

module.exports = {
  getUserBookings,
  createBooking,
  getBooking,
  cancelBooking,
  getPublicBookings,
  createPublicBooking
};
