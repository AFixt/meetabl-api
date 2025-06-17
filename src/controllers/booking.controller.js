/**
 * Booking controller
 *
 * Handles meeting/appointment bookings
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const {
  isValid,
  parseISO,
  parse,
  isAfter,
  isEqual,
  isBefore,
  startOfDay,
  endOfDay,
  addMinutes,
  set,
  getDay,
  getHours,
  getMinutes,
  differenceInMinutes,
  format
} = require('date-fns');
const logger = require('../config/logger');
const {
  Booking, User, Notification, AuditLog, AvailabilityRule
} = require('../models');
const { sequelize, Op } = require('../config/database');
const notificationService = require('../services/notification.service');
const calendarService = require('../services/calendar.service');

// Helper functions for date-fns
const isSameOrBefore = (date1, date2) => isEqual(date1, date2) || isBefore(date1, date2);
const isSameOrAfter = (date1, date2) => isEqual(date1, date2) || isAfter(date1, date2);

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

    // Find all bookings for this user with optimized includes to prevent N+1 queries
    const bookings = await Booking.findAndCountAll({
      where: { user_id: userId },
      limit,
      offset,
      order: [[order, dir]],
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email', 'timezone'],
          required: true
        },
        {
          model: Notification,
          required: false,
          attributes: ['id', 'type', 'status', 'scheduled_for', 'sent_at']
        }
      ]
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
      customer_name: customerName,
      customer_email: customerEmail,
      start_time: startTime,
      end_time: endTime
    } = req.body;

    // Validate datetime format
    if (!isValid(parseISO(startTime)) || !isValid(parseISO(endTime))) {
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
    const startDate = parseISO(startTime);
    const endDate = parseISO(endTime);
    if (isAfter(startDate, endDate) || isEqual(startDate, endDate)) {
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
        [Op.or]: [
          {
            // Starts during another booking
            start_time: {
              [Op.lt]: endTime,
              [Op.gte]: startTime
            }
          },
          {
            // Ends during another booking
            end_time: {
              [Op.lte]: endTime,
              [Op.gt]: startTime
            }
          },
          {
            // Completely overlaps another booking
            start_time: {
              [Op.lte]: startTime
            },
            end_time: {
              [Op.gte]: endTime
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
      customer_name: customerName,
      customer_email: customerEmail,
      start_time: startTime,
      end_time: endTime,
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
        customer_email: customerEmail,
        start_time: startTime,
        end_time: endTime
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

    // Find booking with optimized includes to prevent N+1 queries
    const booking = await Booking.findOne({
      where: { id, user_id: userId },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email', 'timezone'],
          required: true
        },
        {
          model: Notification,
          required: false,
          attributes: ['id', 'type', 'status', 'scheduled_for', 'sent_at']
        }
      ]
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
      booking.description = `CANCELLED: ${booking.description || ''}`;
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
        [Op.or]: [
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
    const parsedDate = date ? parse(date, 'yyyy-MM-dd', new Date()) : null;
    if (!date || !isValid(parsedDate)) {
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
    const targetDate = parse(date, 'yyyy-MM-dd', new Date());
    const dayOfWeek = getDay(targetDate);

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
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    const bookings = await Booking.findAll({
      where: {
        user_id: userId,
        start_time: { [Op.gte]: dayStart },
        end_time: { [Op.lte]: dayEnd },
        status: 'confirmed'
      }
    });

    // Calculate available slots for each rule
    const allSlots = [];

    // Use forEach instead of for...of
    rules.forEach((rule) => {
      // Parse rule times
      const ruleStartTime = parse(rule.start_time, 'HH:mm:ss', new Date());
      const ruleEndTime = parse(rule.end_time, 'HH:mm:ss', new Date());

      // Create slots with specified duration
      let slotStart = set(targetDate, {
        hours: getHours(ruleStartTime),
        minutes: getMinutes(ruleStartTime),
        seconds: 0
      });
      const ruleEnd = set(targetDate, {
        hours: getHours(ruleEndTime),
        minutes: getMinutes(ruleEndTime),
        seconds: 0
      });

      while (isSameOrBefore(addMinutes(slotStart, slotDuration), ruleEnd)) {
        const slotEnd = addMinutes(slotStart, slotDuration);
        const slot = {
          start: slotStart.toISOString(),
          end: slotEnd.toISOString()
        };

        // Check if slot conflicts with any booking
        const isConflict = bookings.some((booking) => {
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);

          // Check for overlap
          const slotStartWithBuffer = addMinutes(new Date(slot.start), -rule.buffer_minutes);
          const slotEndWithBuffer = addMinutes(new Date(slot.end), rule.buffer_minutes);
          
          return (
            (isBefore(new Date(slot.start), bookingEnd) && isAfter(new Date(slot.end), bookingStart))
            || (isBefore(slotStartWithBuffer, bookingEnd) && isAfter(slotEndWithBuffer, bookingStart))
          );
        });

        // Add slot if no conflict
        if (!isConflict) {
          allSlots.push(slot);
        }
        
        // Move to next slot
        slotStart = slotEnd;
      }
    });

    // Sort slots by start time
    allSlots.sort((a, b) => differenceInMinutes(new Date(a.start), new Date(b.start)));

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
      customer_name: customerName,
      customer_email: customerEmail,
      start_time: startTime,
      end_time: endTime
    } = req.body;

    // Find user by username
    const user = await User.findOne({
      where: {
        [Op.or]: [
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
    const startDate = parseISO(startTime);
    const endDate = parseISO(endTime);
    if (!isValid(startDate) || !isValid(endDate)
        || isAfter(startDate, endDate) || isEqual(startDate, endDate)) {
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
        [Op.or]: [
          {
            start_time: {
              [Op.lt]: endTime,
              [Op.gte]: startTime
            }
          },
          {
            end_time: {
              [Op.lte]: endTime,
              [Op.gt]: startTime
            }
          },
          {
            start_time: {
              [Op.lte]: startTime
            },
            end_time: {
              [Op.gte]: endTime
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
      customer_name: customerName,
      customer_email: customerEmail,
      start_time: startTime,
      end_time: endTime,
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
        customer_name: customerName,
        customer_email: customerEmail,
        start_time: startTime,
        end_time: endTime
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

/**
 * Reschedule booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rescheduleBooking = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      start_time: startTime,
      end_time: endTime
    } = req.body;

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
          message: 'Cannot reschedule a cancelled booking'
        }
      });
    }

    // Validate datetime format
    if (!isValid(parseISO(startTime)) || !isValid(parseISO(endTime))) {
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
    const startDateValidation = parseISO(startTime);
    const endDateValidation = parseISO(endTime);
    if (isAfter(startDateValidation, endDateValidation) || isEqual(startDateValidation, endDateValidation)) {
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

    // Check for overlapping bookings (excluding current booking)
    const overlappingBookings = await Booking.findOne({
      where: {
        user_id: userId,
        id: { [Op.ne]: id }, // Exclude current booking
        status: 'confirmed',
        [Op.or]: [
          {
            start_time: {
              [Op.lt]: endTime,
              [Op.gte]: startTime
            }
          },
          {
            end_time: {
              [Op.lte]: endTime,
              [Op.gt]: startTime
            }
          },
          {
            start_time: {
              [Op.lte]: startTime
            },
            end_time: {
              [Op.gte]: endTime
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

    // Store old times for audit log
    const oldStartTime = booking.start_time;
    const oldEndTime = booking.end_time;

    // Update booking times
    booking.start_time = startTime;
    booking.end_time = endTime;
    await booking.save({ transaction });

    // Create reschedule notification
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
      action: 'booking.reschedule',
      metadata: {
        bookingId: id,
        old_start_time: oldStartTime,
        old_end_time: oldEndTime,
        new_start_time: startTime,
        new_end_time: endTime
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log reschedule
    logger.info(`Booking rescheduled: ${id}`);

    // Queue email notification job for reschedule
    await notificationService.queueNotification(id, 'email');

    // Update calendar event if user has calendar integration
    try {
      await calendarService.createCalendarEvent(booking);
    } catch (calendarError) {
      logger.error(`Failed to update calendar event for rescheduled booking ${id}:`, calendarError);
      // Non-critical error, don't fail the reschedule
    }

    return res.status(200).json(booking);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error rescheduling booking:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to reschedule booking'
      }
    });
  }
};

/**
 * Bulk cancel bookings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const bulkCancelBookings = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { booking_ids: bookingIds } = req.body;

    // Validate input
    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Booking IDs are required',
          params: [
            {
              param: 'booking_ids',
              message: 'Must be a non-empty array of booking IDs'
            }
          ]
        }
      });
    }

    // Limit bulk operations to 100 bookings
    if (bookingIds.length > 100) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Cannot cancel more than 100 bookings at once',
          params: [
            {
              param: 'booking_ids',
              message: 'Array must contain 100 or fewer booking IDs'
            }
          ]
        }
      });
    }

    // Find all bookings to cancel
    const bookings = await Booking.findAll({
      where: {
        id: { [Op.in]: bookingIds },
        user_id: userId,
        status: { [Op.ne]: 'cancelled' } // Only non-cancelled bookings
      }
    });

    if (bookings.length === 0) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'No valid bookings found to cancel'
        }
      });
    }

    // Cancel each booking
    const cancelledBookings = [];
    const notifications = [];
    const auditLogs = [];

    for (const booking of bookings) {
      booking.status = 'cancelled';
      await booking.save({ transaction });
      
      cancelledBookings.push(booking.id);

      // Prepare notification
      notifications.push({
        id: uuidv4(),
        booking_id: booking.id,
        type: 'email',
        status: 'pending'
      });

      // Prepare audit log
      auditLogs.push({
        id: uuidv4(),
        user_id: userId,
        action: 'booking.bulk_cancel',
        metadata: {
          bookingId: booking.id,
          bulk_operation: true
        }
      });
    }

    // Create all notifications
    await Notification.bulkCreate(notifications, { transaction });

    // Create all audit logs
    await AuditLog.bulkCreate(auditLogs, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log bulk cancellation
    logger.info(`Bulk booking cancellation: ${cancelledBookings.length} bookings cancelled`);

    // Queue email notifications for all cancelled bookings - batch operation
    try {
      await Promise.allSettled(
        cancelledBookings.map(bookingId => notificationService.queueNotification(bookingId, 'email'))
      );
    } catch (error) {
      logger.error('Error queuing bulk notifications:', error);
      // Non-critical error, don't fail the cancellation
    }

    // Update calendar events if user has calendar integration - parallel processing
    const calendarUpdates = bookings.map(async (booking) => {
      try {
        booking.description = `CANCELLED: ${booking.description || ''}`;
        await calendarService.createCalendarEvent(booking);
      } catch (calendarError) {
        logger.error(`Failed to update calendar event for cancelled booking ${booking.id}:`, calendarError);
        // Non-critical error, continue with other bookings
      }
    });

    try {
      await Promise.allSettled(calendarUpdates);
    } catch (error) {
      logger.error('Error updating calendar events:', error);
      // Non-critical error, don't fail the cancellation
    }

    return res.status(200).json({
      cancelled_count: cancelledBookings.length,
      cancelled_booking_ids: cancelledBookings,
      message: `Successfully cancelled ${cancelledBookings.length} bookings`
    });
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error bulk cancelling bookings:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to cancel bookings'
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
  createPublicBooking,
  rescheduleBooking,
  bulkCancelBookings
};
