/**
 * ICS (iCalendar) file generation utility
 *
 * Generates ICS calendar files for meeting invites
 *
 * @author meetabl Team
 */

const { createEvent } = require('ics');
const logger = require('../config/logger');

/**
 * Generate ICS file for a booking
 * @param {Object} booking - Booking instance with meeting details
 * @param {Object} host - Host user information
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} ICS file data and metadata
 */
const generateBookingICS = async (booking, host, options = {}) => {
  try {
    // Validate input data first
    validateBookingData(booking, host);

    const {
      includeLocation = true,
      includeDescription = true,
      organizerEmail = null
    } = options;

    // Convert ISO strings to Date objects - handle both camelCase and snake_case field names
    const startTime = booking.startTime || booking.start_time;
    const endTime = booking.endTime || booking.end_time;
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Format dates for ICS (array format: [year, month, day, hour, minute])
    const startArray = [
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + 1, // Month is 0-indexed in JS but 1-indexed in ICS
      startDate.getUTCDate(),
      startDate.getUTCHours(),
      startDate.getUTCMinutes()
    ];

    const endArray = [
      endDate.getUTCFullYear(),
      endDate.getUTCMonth() + 1,
      endDate.getUTCDate(),
      endDate.getUTCHours(),
      endDate.getUTCMinutes()
    ];

    // Build event title
    const title = `Meeting with ${host.firstName} ${host.lastName}`;

    // Build description
    let description = '';
    if (includeDescription) {
      description = `Meeting with ${host.firstName} ${host.lastName}`;
      if (booking.notes) {
        description += `\n\nNotes: ${booking.notes}`;
      }
      description += `\n\nBooking ID: ${booking.id}`;
      description += `\n\nPowered by Meetabl - https://meetabl.com`;
    }

    // Build location (can be virtual meeting URL or physical location)
    let location = '';
    if (includeLocation) {
      // If there's a meeting URL or location in booking data, use it
      if (booking.meetingUrl) {
        location = booking.meetingUrl;
      } else if (booking.location) {
        location = booking.location;
      } else {
        // Default to virtual meeting indication
        location = 'Virtual Meeting (details to be provided)';
      }
    }

    // Set organizer information
    const organizer = {
      name: `${host.firstName} ${host.lastName}`,
      email: organizerEmail || host.email
    };

    // Set attendees - handle both camelCase and snake_case field names
    const customerName = booking.customerName || booking.customer_name;
    const customerEmail = booking.customerEmail || booking.customer_email;
    
    const attendees = [
      {
        name: customerName,
        email: customerEmail,
        rsvp: true,
        partstat: 'NEEDS-ACTION',
        role: 'REQ-PARTICIPANT'
      }
    ];

    // Create the event
    const event = {
      title,
      description,
      location,
      start: startArray,
      end: endArray,
      organizer,
      attendees,
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      classification: 'PUBLIC',
      created: [
        new Date().getUTCFullYear(),
        new Date().getUTCMonth() + 1,
        new Date().getUTCDate(),
        new Date().getUTCHours(),
        new Date().getUTCMinutes()
      ],
      lastModified: [
        new Date().getUTCFullYear(),
        new Date().getUTCMonth() + 1,
        new Date().getUTCDate(),
        new Date().getUTCHours(),
        new Date().getUTCMinutes()
      ],
      uid: `meetabl-booking-${booking.id}@meetabl.com`,
      productId: 'meetabl.com'
    };

    // Generate the ICS file
    const { error, value } = createEvent(event);

    if (error) {
      logger.error('Error generating ICS file:', error);
      throw new Error(`Failed to generate ICS file: ${error.message}`);
    }

    // Generate filename
    const dateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = startDate.toISOString().split('T')[1].split(':').slice(0, 2).join('-'); // HH-MM
    const filename = `meetabl-meeting-${dateStr}-${timeStr}.ics`;

    logger.info(`Generated ICS file for booking ${booking.id}`);

    return {
      icsContent: value,
      filename,
      mimeType: 'text/calendar',
      charset: 'utf-8',
      metadata: {
        bookingId: booking.id,
        customerEmail,
        hostEmail: host.email,
        startTime,
        endTime,
        title
      }
    };
  } catch (error) {
    logger.error(`Error generating ICS file for booking ${booking.id}:`, error);
    throw error;
  }
};

/**
 * Generate ICS file for a cancelled booking
 * @param {Object} booking - Cancelled booking instance
 * @param {Object} host - Host user information
 * @returns {Promise<Object>} ICS file data for cancellation
 */
const generateCancellationICS = async (booking, host) => {
  try {
    // Generate the same event but with CANCELLED status
    const result = await generateBookingICS(booking, host, {
      includeLocation: true,
      includeDescription: true
    });

    // Modify the ICS content to include cancellation status
    let icsContent = result.icsContent;
    
    // Replace STATUS:CONFIRMED with STATUS:CANCELLED
    icsContent = icsContent.replace(/STATUS:CONFIRMED/g, 'STATUS:CANCELLED');
    
    // Add cancellation note to description
    icsContent = icsContent.replace(
      /DESCRIPTION:/g,
      'DESCRIPTION:CANCELLED - This meeting has been cancelled. '
    );

    // Update filename to indicate cancellation
    const filename = result.filename.replace('.ics', '-CANCELLED.ics');

    logger.info(`Generated cancellation ICS file for booking ${booking.id}`);

    return {
      ...result,
      icsContent,
      filename,
      metadata: {
        ...result.metadata,
        status: 'CANCELLED'
      }
    };
  } catch (error) {
    logger.error(`Error generating cancellation ICS file for booking ${booking.id}:`, error);
    throw error;
  }
};

/**
 * Generate ICS file for a rescheduled booking
 * @param {Object} booking - Rescheduled booking instance
 * @param {Object} host - Host user information
 * @param {Object} originalTimes - Original booking times for reference
 * @returns {Promise<Object>} ICS file data for rescheduled meeting
 */
const generateRescheduleICS = async (booking, host, originalTimes = {}) => {
  try {
    const result = await generateBookingICS(booking, host, {
      includeLocation: true,
      includeDescription: true
    });

    // Add rescheduling note to description
    let icsContent = result.icsContent;
    
    if (originalTimes.startTime && originalTimes.endTime) {
      const originalStart = new Date(originalTimes.startTime);
      const originalEnd = new Date(originalTimes.endTime);
      
      const rescheduleNote = `\n\nThis meeting has been rescheduled from: ${originalStart.toLocaleString()} - ${originalEnd.toLocaleString()}`;
      
      icsContent = icsContent.replace(
        /DESCRIPTION:(.+?)(?=\r?\n[A-Z])/s,
        `DESCRIPTION:$1${rescheduleNote.replace(/\n/g, '\\n')}`
      );
    }

    // Update filename to indicate rescheduling
    const filename = result.filename.replace('.ics', '-RESCHEDULED.ics');

    logger.info(`Generated reschedule ICS file for booking ${booking.id}`);

    return {
      ...result,
      icsContent,
      filename,
      metadata: {
        ...result.metadata,
        status: 'RESCHEDULED',
        originalTimes
      }
    };
  } catch (error) {
    logger.error(`Error generating reschedule ICS file for booking ${booking.id}:`, error);
    throw error;
  }
};

/**
 * Validate booking data for ICS generation
 * @param {Object} booking - Booking instance
 * @param {Object} host - Host user information
 * @returns {boolean} True if valid, throws error if invalid
 */
const validateBookingData = (booking, host) => {
  const requiredHostFields = ['firstName', 'lastName', 'email'];

  // Check booking fields - handle both naming conventions
  if (!booking.id) {
    throw new Error('Missing required booking field: id');
  }
  
  const customerName = booking.customerName || booking.customer_name;
  const customerEmail = booking.customerEmail || booking.customer_email;
  const startTime = booking.startTime || booking.start_time;
  const endTime = booking.endTime || booking.end_time;
  
  if (!customerName) {
    throw new Error('Missing required booking field: customerName/customer_name');
  }
  if (!customerEmail) {
    throw new Error('Missing required booking field: customerEmail/customer_email');
  }
  if (!startTime) {
    throw new Error('Missing required booking field: startTime/start_time');
  }
  if (!endTime) {
    throw new Error('Missing required booking field: endTime/end_time');
  }

  // Check host fields
  for (const field of requiredHostFields) {
    if (!host[field]) {
      throw new Error(`Missing required host field: ${field}`);
    }
  }

  // Validate dates
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format in booking times');
  }

  if (startDate >= endDate) {
    throw new Error('Start time must be before end time');
  }

  return true;
};

module.exports = {
  generateBookingICS,
  generateCancellationICS,
  generateRescheduleICS,
  validateBookingData
};