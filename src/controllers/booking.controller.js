/**
 * Booking controller
 *
 * Handles meeting/appointment bookings
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { generateTokenWithExpiration } = require('../utils/crypto');
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
  differenceInMinutes
} = require('date-fns');
const logger = require('../config/logger');
const {
  Booking, BookingRequest, User, Notification, AuditLog, AvailabilityRule, UserSettings
} = require('../models');
const { sequelize, Op } = require('../config/database');
const notificationService = require('../services/notification.service');
const calendarService = require('../services/calendar.service');
const {
  asyncHandler,
  successResponse,
  paginatedResponse,
  validationError,
  notFoundError,
  conflictError
} = require('../utils/error-response');

// Helper functions for date-fns
const isSameOrBefore = (date1, date2) => isEqual(date1, date2) || isBefore(date1, date2);

/**
 * Get all bookings for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserBookings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  logger.info(`Getting bookings for user ${userId}`);
  const {
    limit = 100, offset = 0, order = 'start_time', dir = 'desc'
  } = req.query;

    // Find all bookings for this user with optimized includes to prevent N+1 queries
    const bookings = await Booking.findAndCountAll({
      where: { userId: userId },
      limit,
      offset,
      order: [[order, dir]],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'timezone'],
          required: true
        },
        {
          model: Notification,
          as: 'notifications',
          required: false,
          attributes: ['id', 'type', 'status', 'sent_at']
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

    logger.info(`Found ${bookings.count} bookings for user ${userId}`);
    
    return paginatedResponse(res, bookings.rows, {
      page: Math.floor(offset / limit) + 1,
      limit: parseInt(limit),
      total: bookings.count
    }, 'Bookings retrieved successfully');
});

/**
 * Create a new booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createBooking = asyncHandler(async (req, res) => {
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
      throw validationError([
        { field: 'start_time', message: 'Start time must be a valid ISO 8601 date-time' },
        { field: 'end_time', message: 'End time must be a valid ISO 8601 date-time' }
      ]);
    }

    // Validate time range
    const startDate = parseISO(startTime);
    const endDate = parseISO(endTime);
    if (isAfter(startDate, endDate) || isEqual(startDate, endDate)) {
      throw validationError([{
        field: 'end_time',
        message: 'End time must be after start time'
      }]);
    }

    // Check for overlapping bookings
    const overlappingBookings = await Booking.findOne({
      where: {
        userId: userId,
        status: 'confirmed',
        [Op.or]: [
          {
            // Starts during another booking
            startTime: {
              [Op.lt]: endTime,
              [Op.gte]: startTime
            }
          },
          {
            // Ends during another booking
            endTime: {
              [Op.lte]: endTime,
              [Op.gt]: startTime
            }
          },
          {
            // Completely overlaps another booking
            startTime: {
              [Op.lte]: startTime
            },
            endTime: {
              [Op.gte]: endTime
            }
          }
        ]
      }
    });

    if (overlappingBookings) {
      throw conflictError('Time slot is not available');
    }

    // Create booking
    const bookingId = uuidv4();
    const booking = await Booking.create({
      id: bookingId,
      userId: userId,
      customerName: customerName,
      customerEmail: customerEmail,
      startTime: startTime,
      endTime: endTime,
      status: 'confirmed'
    }, { transaction });

    // Create email notification
    await Notification.create({
      id: uuidv4(),
      bookingId: bookingId,
      type: 'email',
      status: 'pending'
    }, { transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
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

    return successResponse(res, booking, 'Booking created successfully', 201);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get booking by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBooking = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  // Find booking with optimized includes to prevent N+1 queries
  const booking = await Booking.findOne({
    where: { id, userId: userId },
    include: [
      {
        model: User,
        attributes: ['id', 'firstName', 'lastName', 'email', 'timezone'],
        required: true
      },
      {
        model: Notification,
        as: 'notifications',
        required: false,
        attributes: ['id', 'type', 'status', 'scheduled_for', 'sent_at']
      }
    ]
  });

  if (!booking) {
    throw notFoundError('Booking');
  }

  return successResponse(res, booking, 'Booking retrieved successfully');
});

/**
 * Cancel booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const cancelBooking = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find booking
    const booking = await Booking.findOne({
      where: { id, userId: userId }
    });

    if (!booking) {
      throw notFoundError('Booking');
    }

    // Check if booking is already cancelled
    if (booking.status === 'cancelled') {
      throw validationError([{
        field: 'status',
        message: 'Booking is already cancelled'
      }]);
    }

    // Update booking status
    booking.status = 'cancelled';
    await booking.save({ transaction });

    // Create cancellation notification
    await Notification.create({
      id: uuidv4(),
      bookingId: id,
      type: 'email',
      status: 'pending'
    }, { transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
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

    return successResponse(res, booking, 'Booking cancelled successfully');
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get public bookings for a user (by username or ID)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPublicBookings = asyncHandler(async (req, res) => {
  const { username } = req.params;

  // Find user by username with settings
  const user = await User.findOne({
    where: {
      [Op.or]: [
        { username: username }, // Check if username matches username field
        { id: username } // Check if username matches ID
      ]
    },
    include: [{ model: UserSettings, as: 'settings' }]
  });

  if (!user) {
    throw notFoundError('User');
  }

    const userId = user.id;
    const { date, duration = 60 } = req.query;

    // Validate date
    const parsedDate = date ? parse(date, 'yyyy-MM-dd', new Date()) : null;
    if (!date || !isValid(parsedDate)) {
      throw validationError([{
        field: 'date',
        message: 'Valid date is required (YYYY-MM-DD)'
      }]);
    }

    // Parse date and get day of week (0 = Sunday, 6 = Saturday)
    const targetDate = parse(date, 'yyyy-MM-dd', new Date());
    const dayOfWeek = getDay(targetDate);

    // Check booking horizon
    const today = new Date();
    const daysDifference = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    const bookingHorizon = user.settings?.bookingHorizon || 30; // Default 30 days
    
    if (daysDifference > bookingHorizon) {
      throw validationError([{
        field: 'date',
        message: `Bookings can only be made up to ${bookingHorizon} days in advance`
      }]);
    }
    
    if (daysDifference < 0) {
      throw validationError([{
        field: 'date',
        message: 'Cannot book dates in the past'
      }]);
    }

    // Use user's preferred meeting duration from settings, or duration query param, or default to 60 minutes
    const userPreferredDuration = user.settings?.meetingDuration;
    const requestedDuration = parseInt(duration, 10);
    const slotDuration = userPreferredDuration || requestedDuration || 60;
    
    if (slotDuration < 15 || slotDuration > 240) {
      throw validationError([{
        field: 'duration',
        message: 'Duration must be between 15 and 240 minutes'
      }]);
    }

    // Get availability rules for this day of week
    const rules = await AvailabilityRule.findAll({
      where: { userId: userId, dayOfWeek: dayOfWeek }
    });

    if (rules.length === 0) {
      return successResponse(res, {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName
        },
        date,
        available_slots: []
      }, 'No availability rules found for this day');
    }

    // Get bookings for this date
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    const bookings = await Booking.findAll({
      where: {
        userId: userId,
        [Op.and]: [
          {
            startTime: { [Op.lt]: dayEnd }
          },
          {
            endTime: { [Op.gt]: dayStart }
          }
        ],
        status: 'confirmed'
      }
    });

    // Debug logging
    logger.info(`Found ${bookings.length} bookings for user ${userId} on ${date}:`, {
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      bookings: bookings.map(b => ({
        id: b.id,
        start: b.startTime,
        end: b.endTime,
        status: b.status
      }))
    });

    // Get busy times from integrated calendars
    let calendarBusyTimes = [];
    try {
      calendarBusyTimes = await calendarService.getAllBusyTimes(userId, dayStart, dayEnd);
    } catch (error) {
      logger.warn(`Failed to fetch calendar busy times for user ${userId}:`, error);
      // Continue without calendar integration - don't fail the request
    }

    // Calculate available slots for each rule
    const allSlots = [];

    // Use forEach instead of for...of
    rules.forEach((rule) => {
      // Parse rule times
      const ruleStartTime = parse(rule.startTime, 'HH:mm:ss', new Date());
      const ruleEndTime = parse(rule.endTime, 'HH:mm:ss', new Date());

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

        // Check if slot conflicts with any booking or calendar event
        const isBookingConflict = bookings.some((booking) => {
          const bookingStart = new Date(booking.startTime);
          const bookingEnd = new Date(booking.endTime);
          const slotStart = new Date(slot.start);
          const slotEnd = new Date(slot.end);
          
          // Check if dates are valid
          if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
            logger.error(`Invalid booking dates for ${booking.id}:`, {
              startTime: booking.startTime,
              endTime: booking.endTime
            });
            return false; // Skip invalid dates
          }

          // Check for overlap with buffer time
          const slotStartWithBuffer = addMinutes(slotStart, -rule.buffer_minutes);
          const slotEndWithBuffer = addMinutes(slotEnd, rule.buffer_minutes);
          
          const basicOverlap = (isBefore(slotStart, bookingEnd) && isAfter(slotEnd, bookingStart));
          const bufferOverlap = (isBefore(slotStartWithBuffer, bookingEnd) && isAfter(slotEndWithBuffer, bookingStart));
          
          return basicOverlap || bufferOverlap;
        });

        // Check if slot conflicts with any calendar events
        const isCalendarConflict = calendarBusyTimes.some((busyTime) => {
          // Check for overlap with buffer time
          const slotStartWithBuffer = addMinutes(new Date(slot.start), -rule.buffer_minutes);
          const slotEndWithBuffer = addMinutes(new Date(slot.end), rule.buffer_minutes);
          
          return (
            (isBefore(new Date(slot.start), busyTime.end) && isAfter(new Date(slot.end), busyTime.start))
            || (isBefore(slotStartWithBuffer, busyTime.end) && isAfter(slotEndWithBuffer, busyTime.start))
          );
        });

        const isConflict = isBookingConflict || isCalendarConflict;

        // Add slot if no conflict
        if (!isConflict) {
          allSlots.push(slot);
        }
        
        // Move to next slot with buffer time
        // Get buffer time from user settings or availability rule
        const bufferMinutes = user.settings?.bufferMinutes || rule.buffer_minutes || 0;
        slotStart = addMinutes(slotEnd, bufferMinutes);
      }
    });

    // Sort slots by start time
    allSlots.sort((a, b) => differenceInMinutes(new Date(a.start), new Date(b.start)));

    return successResponse(res, {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username
      },
      settings: {
        googleAnalyticsId: user.settings?.googleAnalyticsId || null,
        bookingPageTitle: user.settings?.bookingPageTitle || null,
        bookingPageDescription: user.settings?.bookingPageDescription || null,
        brandingColor: user.settings?.brandingColor || '#000000',
        meetingDuration: user.settings?.meetingDuration || 60,
        bufferMinutes: user.settings?.bufferMinutes || 0
      },
      date,
      available_slots: allSlots
    }, 'Available booking slots retrieved successfully');
});

/**
 * Create public booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createPublicBooking = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { username } = req.params;
    const {
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      start_time: startTime,
      end_time: endTime,
      notes,
      event_type_id: eventTypeId
    } = req.body;

    // Find user by username
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { username: username }, // Check if username matches username field
          { id: username } // Check if username matches ID
        ]
      }
    });

    if (!user) {
      throw notFoundError('User');
    }

    const userId = user.id;

    // Validate datetime format and range
    const startDate = parseISO(startTime);
    const endDate = parseISO(endTime);
    if (!isValid(startDate) || !isValid(endDate)
        || isAfter(startDate, endDate) || isEqual(startDate, endDate)) {
      throw validationError([
        {
          field: 'start_time',
          message: 'Start time must be a valid ISO 8601 date-time'
        },
        {
          field: 'end_time',
          message: 'End time must be after start time'
        }
      ]);
    }

    // Check for overlapping confirmed bookings
    const overlappingBookings = await Booking.findOne({
      where: {
        userId: userId,
        status: 'confirmed',
        [Op.and]: [
          {
            startTime: { [Op.lt]: endTime }
          },
          {
            endTime: { [Op.gt]: startTime }
          }
        ]
      }
    });

    if (overlappingBookings) {
      throw conflictError('Time slot is not available');
    }

    // Check for overlapping pending booking requests
    const overlappingRequests = await BookingRequest.findOne({
      where: {
        userId: userId,
        status: 'pending',
        expiresAt: { [Op.gt]: new Date() },
        [Op.and]: [
          {
            startTime: { [Op.lt]: endTime }
          },
          {
            endTime: { [Op.gt]: startTime }
          }
        ]
      }
    });

    if (overlappingRequests) {
      throw conflictError('Time slot has a pending booking request. Please try another time.');
    }

    // Generate confirmation token and expiration time
    const { token: confirmationToken, expiresAt } = generateTokenWithExpiration(32, 30);

    // Create booking request
    const bookingRequestId = uuidv4();
    const bookingRequest = await BookingRequest.create({
      id: bookingRequestId,
      userId: userId,
      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      startTime: startTime,
      endTime: endTime,
      notes: notes,
      eventTypeId: eventTypeId,
      confirmationToken: confirmationToken,
      status: 'pending',
      expiresAt: expiresAt
    }, { transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'booking.request.create',
      metadata: {
        bookingRequestId,
        customer_name: customerName,
        customer_email: customerEmail,
        start_time: startTime,
        end_time: endTime
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log booking request creation
    logger.info(`Public booking request created: ${bookingRequestId}`);

    // Send confirmation email to customer
    const confirmationUrl = `${process.env.FRONTEND_URL}/booking/confirm/${confirmationToken}`;
    
    try {
      await notificationService.sendBookingConfirmationRequest({
        to: customerEmail,
        customerName: customerName,
        hostName: `${user.firstName} ${user.lastName}`,
        startTime: startTime,
        endTime: endTime,
        confirmationUrl: confirmationUrl,
        expiresAt: expiresAt
      });
    } catch (emailError) {
      logger.error(`Failed to send confirmation email for booking request ${bookingRequestId}:`, emailError);
      // Don't fail the request creation, but log the error
    }

    return successResponse(res, {
      message: 'Booking request created. Please check your email to confirm your booking.',
      expiresAt: expiresAt
    }, 'Booking request created successfully', 201);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Reschedule booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rescheduleBooking = asyncHandler(async (req, res) => {
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
      where: { id, userId: userId }
    });

    if (!booking) {
      throw notFoundError('Booking');
    }

    // Check if booking is already cancelled
    if (booking.status === 'cancelled') {
      throw validationError([{
        field: 'status',
        message: 'Cannot reschedule a cancelled booking'
      }]);
    }

    // Validate datetime format
    if (!isValid(parseISO(startTime)) || !isValid(parseISO(endTime))) {
      throw validationError([
        {
          field: 'start_time',
          message: 'Start time must be a valid ISO 8601 date-time'
        },
        {
          field: 'end_time',
          message: 'End time must be a valid ISO 8601 date-time'
        }
      ]);
    }

    // Validate time range
    const startDateValidation = parseISO(startTime);
    const endDateValidation = parseISO(endTime);
    if (isAfter(startDateValidation, endDateValidation) || isEqual(startDateValidation, endDateValidation)) {
      throw validationError([{
        field: 'end_time',
        message: 'End time must be after start time'
      }]);
    }

    // Check for overlapping bookings (excluding current booking)
    const overlappingBookings = await Booking.findOne({
      where: {
        userId: userId,
        id: { [Op.ne]: id }, // Exclude current booking
        status: 'confirmed',
        [Op.or]: [
          {
            startTime: {
              [Op.lt]: endTime,
              [Op.gte]: startTime
            }
          },
          {
            endTime: {
              [Op.lte]: endTime,
              [Op.gt]: startTime
            }
          },
          {
            startTime: {
              [Op.lte]: startTime
            },
            endTime: {
              [Op.gte]: endTime
            }
          }
        ]
      }
    });

    if (overlappingBookings) {
      throw conflictError('Time slot is not available');
    }

    // Store old times for audit log
    const oldStartTime = booking.startTime;
    const oldEndTime = booking.endTime;

    // Update booking times
    booking.startTime = startTime;
    booking.endTime = endTime;
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
      userId: userId,
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

    return successResponse(res, booking, 'Booking rescheduled successfully');
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Bulk cancel bookings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const bulkCancelBookings = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { booking_ids: bookingIds } = req.body;

    // Validate input
    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      throw validationError([{
        field: 'booking_ids',
        message: 'Must be a non-empty array of booking IDs'
      }]);
    }

    // Limit bulk operations to 100 bookings
    if (bookingIds.length > 100) {
      throw validationError([{
        field: 'booking_ids',
        message: 'Array must contain 100 or fewer booking IDs'
      }]);
    }

    // Find all bookings to cancel
    const bookings = await Booking.findAll({
      where: {
        id: { [Op.in]: bookingIds },
        userId: userId,
        status: { [Op.ne]: 'cancelled' } // Only non-cancelled bookings
      }
    });

    if (bookings.length === 0) {
      throw notFoundError('No valid bookings found to cancel');
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
        userId: userId,
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

    return successResponse(res, {
      cancelled_count: cancelledBookings.length,
      cancelled_booking_ids: cancelledBookings
    }, `Successfully cancelled ${cancelledBookings.length} bookings`);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Confirm booking request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const confirmBookingRequest = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { token } = req.params;

    // Find the booking request by token
    const bookingRequest = await BookingRequest.findOne({
      where: {
        confirmationToken: token,
        status: 'pending'
      },
      include: [{
        model: User,
        attributes: ['id', 'firstName', 'lastName', 'email', 'timezone']
      }]
    });

    if (!bookingRequest) {
      throw notFoundError('Invalid or expired confirmation link');
    }

    // Check if request has expired
    if (new Date() > new Date(bookingRequest.expiresAt)) {
      // Update status to expired
      bookingRequest.status = 'expired';
      await bookingRequest.save({ transaction });
      await transaction.commit();
      
      throw validationError([{
        field: 'token',
        message: 'This booking confirmation link has expired. Please request a new booking.'
      }]);
    }

    // Check for race condition - another booking might have been confirmed for this time slot
    const overlappingBookings = await Booking.findOne({
      where: {
        userId: bookingRequest.userId,
        status: 'confirmed',
        [Op.and]: [
          {
            startTime: { [Op.lt]: bookingRequest.endTime }
          },
          {
            endTime: { [Op.gt]: bookingRequest.startTime }
          }
        ]
      }
    });

    if (overlappingBookings) {
      // Update status to cancelled due to conflict
      bookingRequest.status = 'cancelled';
      await bookingRequest.save({ transaction });
      await transaction.commit();
      
      return res.status(409).json({
        success: false,
        error: {
          code: 'time_slot_taken',
          message: 'Sorry, this time slot is no longer available. Someone else has booked it.',
          data: {
            userId: bookingRequest.userId,
            date: bookingRequest.startTime,
            suggestAlternative: true
          }
        }
      });
    }

    // Create the actual booking
    const bookingId = uuidv4();
    const booking = await Booking.create({
      id: bookingId,
      userId: bookingRequest.userId,
      customerName: bookingRequest.customerName,
      customerEmail: bookingRequest.customerEmail,
      customerPhone: bookingRequest.customerPhone,
      startTime: bookingRequest.startTime,
      endTime: bookingRequest.endTime,
      notes: bookingRequest.notes,
      status: 'confirmed'
    }, { transaction });

    // Update booking request status
    bookingRequest.status = 'confirmed';
    bookingRequest.confirmedAt = new Date();
    await bookingRequest.save({ transaction });

    // Create notifications for both parties
    const notifications = [
      {
        id: uuidv4(),
        bookingId: bookingId,
        type: 'email',
        recipientType: 'host',
        recipientEmail: bookingRequest.User.email,
        status: 'pending'
      },
      {
        id: uuidv4(),
        bookingId: bookingId,
        type: 'email',
        recipientType: 'customer',
        recipientEmail: bookingRequest.customerEmail,
        status: 'pending'
      }
    ];

    await Notification.bulkCreate(notifications, { transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: bookingRequest.userId,
      action: 'booking.confirm',
      metadata: {
        bookingId,
        bookingRequestId: bookingRequest.id,
        customer_email: bookingRequest.customerEmail
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log booking confirmation
    logger.info(`Booking confirmed: ${bookingId} from request ${bookingRequest.id}`);

    // Send notification emails
    try {
      // Send confirmation to customer
      await notificationService.sendBookingConfirmationToCustomer({
        booking,
        host: bookingRequest.User
      });

      // Send notification to host
      await notificationService.sendBookingNotificationToHost({
        booking,
        host: bookingRequest.User
      });
    } catch (emailError) {
      logger.error(`Failed to send confirmation emails for booking ${bookingId}:`, emailError);
      // Don't fail the confirmation, emails can be retried
    }

    // Create calendar event if user has calendar integration
    try {
      await calendarService.createCalendarEvent(booking);
    } catch (calendarError) {
      logger.error(`Failed to create calendar event for confirmed booking ${bookingId}:`, calendarError);
      // Non-critical error, don't fail the confirmation
    }

    return successResponse(res, {
      booking: {
        id: booking.id,
        customerName: booking.customerName,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status
      },
      host: {
        name: `${bookingRequest.User.firstName} ${bookingRequest.User.lastName}`,
        email: bookingRequest.User.email
      }
    }, 'Booking confirmed successfully');
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

module.exports = {
  getUserBookings,
  createBooking,
  getBooking,
  cancelBooking,
  getPublicBookings,
  createPublicBooking,
  confirmBookingRequest,
  rescheduleBooking,
  bulkCancelBookings
};
