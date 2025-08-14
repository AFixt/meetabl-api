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
const { toZonedTime, fromZonedTime } = require('date-fns-tz');
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

    // Find all confirmed bookings for this user
    const bookings = await Booking.findAll({
      where: { userId: userId },
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

    // Find all pending booking requests for this user
    const bookingRequests = await BookingRequest.findAll({
      where: { 
        userId: userId,
        status: ['pending', 'pending_host_approval'],
        expiresAt: { [Op.gt]: new Date() } // Only non-expired requests
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'timezone'],
          required: true
        }
      ]
    });

    // Transform booking requests to match booking format
    const transformedRequests = bookingRequests.map(req => ({
      id: req.id,
      userId: req.userId,
      customerName: req.customerName,
      customerEmail: req.customerEmail,
      customerPhone: req.customerPhone,
      startTime: req.startTime,
      endTime: req.endTime,
      status: req.status,
      notes: req.notes,
      meetingUrl: null,
      calendarEventId: null,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      user: req.user,
      notifications: [], // Booking requests don't have notifications yet
      // Add additional fields to distinguish booking requests
      isBookingRequest: true,
      confirmationToken: req.confirmationToken,
      expiresAt: req.expiresAt,
      confirmedAt: req.confirmedAt
    }));

    // Combine bookings and booking requests
    const allBookings = [...bookings.map(b => ({ ...b.toJSON(), isBookingRequest: false })), ...transformedRequests];
    
    // Sort combined results
    allBookings.sort((a, b) => {
      if (order === 'start_time') {
        const comparison = new Date(b.startTime) - new Date(a.startTime);
        return dir === 'desc' ? comparison : -comparison;
      }
      return 0;
    });

    // Apply pagination
    const total = allBookings.length;
    const paginatedBookings = allBookings.slice(offset, offset + parseInt(limit));

    // Set pagination headers
    res.set({
      'X-Total-Count': total,
      'X-Total-Pages': Math.ceil(total / limit),
      'X-Per-Page': limit,
      'X-Current-Page': Math.floor(offset / limit) + 1
    });

    logger.info(`Found ${bookings.length} confirmed bookings and ${bookingRequests.length} pending requests for user ${userId}`);
    
    return paginatedResponse(res, paginatedBookings, {
      page: Math.floor(offset / limit) + 1,
      limit: parseInt(limit),
      total: total
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
      customer_phone: customerPhone,
      start_time: startTime,
      end_time: endTime,
      notes
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
      customerPhone: customerPhone || null,
      startTime: startTime,
      endTime: endTime,
      notes: notes || null,
      status: 'confirmed'
    }, { transaction });

    // Create email notification
    await Notification.create({
      id: uuidv4(),
      bookingId: bookingId,
      type: 'booking_created',
      channel: 'email',
      recipient: customerEmail,
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
        customer_phone: customerPhone,
        start_time: startTime,
        end_time: endTime,
        notes: notes
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log booking creation
    logger.info(`Booking created: ${bookingId}`);

    // Queue email notification job
    await notificationService.queueNotification(bookingId, 'email');

    // Schedule reminder notifications
    try {
      await notificationService.scheduleReminders(bookingId);
    } catch (reminderError) {
      logger.error(`Failed to schedule reminders for booking ${bookingId}:`, reminderError);
      // Non-critical error, don't fail the booking creation
    }

    // Create calendar event if user has calendar integration
    try {
      await calendarService.createCalendarEvent(booking);
    } catch (calendarError) {
      logger.error(`Failed to create calendar event for booking ${bookingId}:`, calendarError);
      // Non-critical error, don't fail the booking creation
    }

    return successResponse(res, booking, 'Booking created successfully', 201);
  } catch (error) {
    // Rollback transaction only if it hasn't been committed
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
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
  let transaction;

  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { id } = req.params;

    // Find booking - allow cancellation if user is either the host or the attendee
    const booking = await Booking.findOne({
      where: { 
        id,
        [Op.or]: [
          { userId: userId }, // User is the host
          { customerEmail: userEmail } // User is the attendee
        ]
      }
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

    // Start transaction after validation
    transaction = await sequelize.transaction();

    // Update booking status
    booking.status = 'cancelled';
    await booking.save({ transaction });

    // Create cancellation notification
    await Notification.create({
      id: uuidv4(),
      bookingId: id,
      type: 'booking_cancelled',
      channel: 'email',
      recipient: booking.customerEmail,
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
    transaction = null; // Mark as committed

    // Log cancellation
    logger.info(`Booking cancelled: ${id}`);

    // Queue email notification job for cancellation
    try {
      await notificationService.queueNotification(id, 'email');
    } catch (notificationError) {
      logger.error(`Failed to queue notification for booking ${id}:`, notificationError);
      // Non-critical error, don't fail the cancellation
    }

    // Cancel any scheduled reminder notifications
    try {
      await notificationService.cancelReminders(id);
    } catch (reminderError) {
      logger.error(`Failed to cancel reminders for booking ${id}:`, reminderError);
      // Non-critical error, don't fail the cancellation
    }

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
    // Rollback transaction only if it exists and hasn't been committed
    if (transaction) {
      await transaction.rollback();
    }
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
    const { date, duration = 60, event_type_id } = req.query;

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

    // Get event type duration if event_type_id is provided
    let slotDuration = 60; // Default duration
    let eventType = null;
    
    if (event_type_id) {
      const EventType = require('../models/event-type.model');
      eventType = await EventType.findOne({
        where: { 
          id: event_type_id,
          user_id: userId,
          is_active: true
        }
      });
      
      if (eventType) {
        slotDuration = eventType.duration || 60;
        logger.info(`Using event type duration: ${slotDuration} minutes for event type ${event_type_id}`);
      }
    } else {
      // Fall back to user settings or query parameter
      const userPreferredDuration = user.settings?.meetingDuration;
      const requestedDuration = parseInt(duration, 10);
      slotDuration = requestedDuration || userPreferredDuration || 60;
    }
    
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
          lastName: user.lastName,
          username: user.username,
          timezone: user.timezone
        },
        date,
        available_slots: []
      }, 'No availability rules found for this day');
    }

    // Get bookings for this date in the user's timezone
    const userTimezone = user.timezone || 'America/New_York';
    
    // Parse the date string and create Date objects for start/end of day
    // The date string "2025-08-07" represents August 7 in the user's timezone
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(5, 7)) - 1; // Month is 0-indexed
    const day = parseInt(date.substring(8, 10));
    
    // Create dates at midnight and end of day in user's timezone
    const dayStartInUserTz = new Date(year, month, day, 0, 0, 0, 0);
    const dayEndInUserTz = new Date(year, month, day, 23, 59, 59, 999);
    
    // Convert from user's timezone to UTC
    const dayStart = fromZonedTime(dayStartInUserTz, userTimezone);
    const dayEnd = fromZonedTime(dayEndInUserTz, userTimezone);
    
    logger.debug(`Date range for ${date} in ${userTimezone}:`, {
      userTzStart: dayStartInUserTz.toISOString(),
      userTzEnd: dayEndInUserTz.toISOString(),
      utcStart: dayStart.toISOString(),
      utcEnd: dayEnd.toISOString()
    });

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
      logger.info(`Fetching calendar busy times for user ${userId}`, {
        userId,
        dayStart: dayStart.toISOString(),
        dayEnd: dayEnd.toISOString(),
        date
      });
      
      calendarBusyTimes = await calendarService.getAllBusyTimes(userId, dayStart, dayEnd);
      
      logger.info(`Calendar busy times fetched for user ${userId}:`, {
        count: calendarBusyTimes.length,
        busyTimes: calendarBusyTimes.map(bt => ({
          start: bt.start.toISOString(),
          end: bt.end.toISOString(),
          duration: Math.round((bt.end - bt.start) / 60000) + ' minutes'
        }))
      });
    } catch (error) {
      logger.error(`Failed to fetch calendar busy times for user ${userId}:`, {
        error: error.message,
        stack: error.stack,
        userId,
        date
      });
      // Continue without calendar integration - don't fail the request
    }

    // Calculate available slots for each rule
    const allSlots = [];

    // Use forEach instead of for...of
    rules.forEach((rule) => {
      // Parse rule times
      const ruleStartTime = parse(rule.startTime, 'HH:mm:ss', new Date());
      const ruleEndTime = parse(rule.endTime, 'HH:mm:ss', new Date());

      // Create slots with specified duration in user's timezone
      // Use the parsed date components to create slot times
      let slotStart = new Date(year, month, day, 
        getHours(ruleStartTime),
        getMinutes(ruleStartTime),
        0, 0
      );
      const ruleEnd = new Date(year, month, day,
        getHours(ruleEndTime),
        getMinutes(ruleEndTime),
        0, 0
      );

      while (isSameOrBefore(addMinutes(slotStart, slotDuration), ruleEnd)) {
        const slotEnd = addMinutes(slotStart, slotDuration);
        
        // Convert slot times from user timezone to UTC
        const slotStartUtc = fromZonedTime(slotStart, userTimezone);
        const slotEndUtc = fromZonedTime(slotEnd, userTimezone);
        
        const slot = {
          start: slotStartUtc.toISOString(),
          end: slotEndUtc.toISOString()
        };

        // Check if slot is in the past or too soon
        const now = new Date();
        const slotStartTime = new Date(slot.start);
        
        // Require at least 2 hours advance notice for bookings
        const minimumAdvanceMinutes = 120; // 2 hours
        const minimumBookingTime = addMinutes(now, minimumAdvanceMinutes);
        
        const isInPast = isBefore(slotStartTime, now);
        const isTooSoon = isBefore(slotStartTime, minimumBookingTime);
        
        if (isInPast || isTooSoon) {
          logger.debug(`Slot ${slot.start} is ${isInPast ? 'in the past' : 'too soon (less than 2 hours notice)'}, skipping`);
          slotStart = addMinutes(slotStart, slotDuration);
          continue;
        }

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
          
          const hasOverlap = (isBefore(new Date(slot.start), busyTime.end) && isAfter(new Date(slot.end), busyTime.start))
            || (isBefore(slotStartWithBuffer, busyTime.end) && isAfter(slotEndWithBuffer, busyTime.start));
          
          if (hasOverlap) {
            logger.debug(`Slot ${slot.start} conflicts with calendar event`, {
              slot: { start: slot.start, end: slot.end },
              busyTime: { 
                start: busyTime.start.toISOString(), 
                end: busyTime.end.toISOString() 
              },
              bufferMinutes: rule.buffer_minutes
            });
          }
          
          return hasOverlap;
        });

        const isConflict = isBookingConflict || isCalendarConflict;

        // Add slot if no conflict
        if (!isConflict) {
          allSlots.push(slot);
        } else if (isCalendarConflict) {
          logger.debug(`Slot ${slot.start} blocked due to calendar conflict`);
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
        username: user.username,
        timezone: user.timezone
      },
      settings: {
        googleAnalyticsId: user.settings?.googleAnalyticsId || null,
        bookingPageTitle: user.settings?.bookingPageTitle || null,
        bookingPageDescription: user.settings?.bookingPageDescription || null,
        brandingColor: user.settings?.brandingColor || '#000000',
        meetingDuration: user.settings?.meetingDuration || 60,
        bufferMinutes: user.settings?.bufferMinutes || 0,
        logoUrl: user.settings?.logoUrl || null,
        logoAltText: user.settings?.logoAltText || null
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
      bookingId: id,
      type: 'booking_updated',
      channel: 'email',
      recipient: booking.customerEmail,
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

    // Cancel scheduled reminder notifications for all cancelled bookings
    try {
      await Promise.allSettled(
        cancelledBookings.map(bookingId => notificationService.cancelReminders(bookingId))
      );
    } catch (error) {
      logger.error('Error cancelling bulk reminder notifications:', error);
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
    let bookingRequest = await BookingRequest.findOne({
      where: {
        confirmationToken: token,
        status: 'pending'
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'timezone']
      }]
    });

    // If not found with pending status, check if it's already confirmed
    if (!bookingRequest) {
      const confirmedBookingRequest = await BookingRequest.findOne({
        where: {
          confirmationToken: token,
          status: { [Op.in]: ['confirmed', 'pending_host_approval'] }
        },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }]
      });

      if (confirmedBookingRequest) {
        // Booking was already confirmed
        await transaction.commit();
        
        const isAwaitingHost = confirmedBookingRequest.status === 'pending_host_approval';
        
        return res.json({
          success: true,
          message: isAwaitingHost 
            ? 'You have already confirmed this booking. It is currently awaiting approval from the host.'
            : 'You have already confirmed this booking. No further action is needed.',
          alreadyConfirmed: true,
          status: confirmedBookingRequest.status,
          booking: {
            id: confirmedBookingRequest.id,
            customerName: confirmedBookingRequest.customerName,
            startTime: confirmedBookingRequest.startTime,
            endTime: confirmedBookingRequest.endTime,
            status: confirmedBookingRequest.status
          }
        });
      }

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

    // Check if this event type requires host confirmation
    let eventType = null;
    let requiresHostConfirmation = false;
    
    if (bookingRequest.eventTypeId) {
      const EventType = require('../models/event-type.model');
      eventType = await EventType.findOne({
        where: { 
          id: bookingRequest.eventTypeId,
          user_id: bookingRequest.userId,
          is_active: true
        }
      });
      
      requiresHostConfirmation = eventType?.requiresConfirmation || false;
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

    // Handle different flows based on whether host confirmation is required
    if (requiresHostConfirmation) {
      // Two-step confirmation: Customer confirmed, now needs host approval
      
      // Generate host approval token
      const { token: hostApprovalToken, expiresAt: hostApprovalExpires } = generateTokenWithExpiration(32, 7 * 24 * 60); // 7 days
      
      // Update booking request to pending host approval
      bookingRequest.status = 'pending_host_approval';
      bookingRequest.confirmedAt = new Date();
      bookingRequest.hostApprovalToken = hostApprovalToken;
      bookingRequest.hostApprovalTokenExpiresAt = hostApprovalExpires;
      await bookingRequest.save({ transaction });

      // Create audit log
      await AuditLog.create({
        id: uuidv4(),
        userId: bookingRequest.userId,
        action: 'booking.customer_confirmed',
        metadata: {
          bookingRequestId: bookingRequest.id,
          customer_email: bookingRequest.customerEmail,
          awaiting_host_approval: true
        }
      }, { transaction });

      // Commit transaction
      await transaction.commit();

      // Log customer confirmation
      logger.info(`Booking request ${bookingRequest.id} confirmed by customer, awaiting host approval`);

      // Send notification to host for approval
      try {
        await notificationService.sendHostApprovalRequest({
          bookingRequest,
          host: bookingRequest.user,
          eventType,
          approvalToken: hostApprovalToken
        });
      } catch (emailError) {
        logger.error(`Failed to send host approval request for booking request ${bookingRequest.id}:`, emailError);
        // Don't fail the confirmation, email can be retried
      }

      return successResponse(res, {
        message: 'Thank you for confirming your booking. Your request has been sent to the host for approval. You will receive an email once the host responds.',
        status: 'pending_host_approval',
        bookingRequestId: bookingRequest.id
      }, 'Booking confirmed by customer, pending host approval');

    } else {
      // Single-step confirmation: Create booking immediately
      
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
          recipientEmail: bookingRequest.user.email,
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
          host: bookingRequest.user
        });

        // Send notification to host
        await notificationService.sendBookingNotificationToHost({
          booking,
          host: bookingRequest.user
        });
      } catch (emailError) {
        logger.error(`Failed to send confirmation emails for booking ${bookingId}:`, emailError);
        // Don't fail the confirmation, emails can be retried
      }

      // Schedule reminder notifications
      try {
        await notificationService.scheduleReminders(bookingId);
      } catch (reminderError) {
        logger.error(`Failed to schedule reminders for confirmed booking ${bookingId}:`, reminderError);
        // Non-critical error, don't fail the confirmation
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
          name: `${bookingRequest.user.firstName} ${bookingRequest.user.lastName}`,
          email: bookingRequest.user.email
        }
      }, 'Booking confirmed successfully');
    }
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Approve booking request by host
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const approveBookingRequest = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { token } = req.params;

    // Find the booking request by host approval token
    const bookingRequest = await BookingRequest.findOne({
      where: {
        hostApprovalToken: token,
        status: 'pending_host_approval'
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'timezone']
      }]
    });

    if (!bookingRequest) {
      throw notFoundError('Invalid or expired approval link');
    }

    // Check if approval token has expired
    if (new Date() > new Date(bookingRequest.hostApprovalTokenExpiresAt)) {
      // Update status to expired
      bookingRequest.status = 'expired';
      await bookingRequest.save({ transaction });
      await transaction.commit();
      
      throw validationError([{
        field: 'token',
        message: 'This approval link has expired. The booking request is no longer valid.'
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
      bookingRequest.hostDecisionAt = new Date();
      await bookingRequest.save({ transaction });
      await transaction.commit();
      
      return res.status(409).json({
        success: false,
        error: {
          code: 'time_slot_taken',
          message: 'This time slot is no longer available. Another booking has been confirmed.',
          data: {
            userId: bookingRequest.userId,
            date: bookingRequest.startTime
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
    bookingRequest.hostDecisionAt = new Date();
    await bookingRequest.save({ transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: bookingRequest.userId,
      action: 'booking.host_approved',
      metadata: {
        bookingId,
        bookingRequestId: bookingRequest.id,
        customer_email: bookingRequest.customerEmail
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log booking approval
    logger.info(`Booking approved by host: ${bookingId} from request ${bookingRequest.id}`);

    // Send notification emails
    try {
      // Send confirmation to customer
      await notificationService.sendBookingApprovedToCustomer({
        booking,
        host: bookingRequest.user
      });

      // Send confirmation to host
      await notificationService.sendBookingConfirmationToHost({
        booking,
        host: bookingRequest.user
      });
    } catch (emailError) {
      logger.error(`Failed to send approval emails for booking ${bookingId}:`, emailError);
      // Don't fail the approval, emails can be retried
    }

    // Schedule reminder notifications
    try {
      await notificationService.scheduleReminders(bookingId);
    } catch (reminderError) {
      logger.error(`Failed to schedule reminders for approved booking ${bookingId}:`, reminderError);
      // Non-critical error, don't fail the approval
    }

    // Create calendar event if user has calendar integration
    try {
      await calendarService.createCalendarEvent(booking);
    } catch (calendarError) {
      logger.error(`Failed to create calendar event for approved booking ${bookingId}:`, calendarError);
      // Non-critical error, don't fail the approval
    }

    return successResponse(res, {
      booking: {
        id: booking.id,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status
      },
      message: 'Booking has been approved and confirmed successfully'
    }, 'Booking approved by host');
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Reject booking request by host
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rejectBookingRequest = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { token } = req.params;
    const { reason } = req.body;

    // Find the booking request by host approval token
    const bookingRequest = await BookingRequest.findOne({
      where: {
        hostApprovalToken: token,
        status: 'pending_host_approval'
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'timezone']
      }]
    });

    if (!bookingRequest) {
      throw notFoundError('Invalid or expired approval link');
    }

    // Check if approval token has expired
    if (new Date() > new Date(bookingRequest.hostApprovalTokenExpiresAt)) {
      // Update status to expired
      bookingRequest.status = 'expired';
      await bookingRequest.save({ transaction });
      await transaction.commit();
      
      throw validationError([{
        field: 'token',
        message: 'This approval link has expired. The booking request is no longer valid.'
      }]);
    }

    // Update booking request status to cancelled
    bookingRequest.status = 'cancelled';
    bookingRequest.hostDecisionAt = new Date();
    await bookingRequest.save({ transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: bookingRequest.userId,
      action: 'booking.host_rejected',
      metadata: {
        bookingRequestId: bookingRequest.id,
        customer_email: bookingRequest.customerEmail,
        rejection_reason: reason || 'No reason provided'
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log booking rejection
    logger.info(`Booking rejected by host: request ${bookingRequest.id}`);

    // Send notification to customer
    try {
      await notificationService.sendBookingRejectedToCustomer({
        bookingRequest,
        host: bookingRequest.user,
        reason: reason || null
      });
    } catch (emailError) {
      logger.error(`Failed to send rejection email for booking request ${bookingRequest.id}:`, emailError);
      // Don't fail the rejection, email can be retried
    }

    return successResponse(res, {
      message: 'Booking request has been rejected successfully',
      bookingRequestId: bookingRequest.id
    }, 'Booking rejected by host');
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
  bulkCancelBookings,
  approveBookingRequest,
  rejectBookingRequest,
  approveBookingById: approveBookingRequest,
  rejectBookingById: rejectBookingRequest
};
