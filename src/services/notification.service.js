/**
 * Notification service
 *
 * Manages sending email and SMS notifications
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { Notification, Booking, User } = require('../models');

/**
 * Process notification queue
 * @returns {Promise<void>}
 */
const processNotificationQueue = async () => {
  try {
    // Find pending notifications
    const pendingNotifications = await Notification.findAll({
      where: { status: 'pending' },
      include: [{
        model: Booking,
        required: true,
        include: [{
          model: User,
          required: true
        }]
      }]
    });

    logger.info(`Processing ${pendingNotifications.length} pending notifications`);

    for (const notification of pendingNotifications) {
      try {
        if (notification.type === 'email') {
          await sendEmailNotification(notification);
        } else if (notification.type === 'sms') {
          await sendSmsNotification(notification);
        }

        // Update notification status
        notification.status = 'sent';
        notification.sent_at = new Date();
        await notification.save();
      } catch (error) {
        logger.error(`Failed to process notification ${notification.id}:`, error);
        
        // Update notification status
        notification.status = 'failed';
        notification.error_message = error.message;
        await notification.save();
      }
    }
  } catch (error) {
    logger.error('Error processing notification queue:', error);
  }
};

/**
 * Send email notification
 * @param {Object} notification - Notification instance
 * @returns {Promise<void>}
 */
const sendEmailNotification = async (notification) => {
  // This would typically use a real email service like SendGrid, Mailgun, etc.
  // For now, we'll just log the email details
  const booking = notification.Booking;
  const user = booking.User;

  logger.info(`[MOCK EMAIL] Sending email notification for booking ${booking.id}`);
  logger.info(`[MOCK EMAIL] To: ${booking.customer_email}`);
  logger.info(`[MOCK EMAIL] Subject: Your booking with ${user.name}`);
  logger.info(`[MOCK EMAIL] Body: Your booking has been ${booking.status} for ${new Date(booking.start_time).toLocaleString()} to ${new Date(booking.end_time).toLocaleString()}`);

  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 500));
};

/**
 * Send SMS notification
 * @param {Object} notification - Notification instance
 * @returns {Promise<void>}
 */
const sendSmsNotification = async (notification) => {
  // This would typically use a real SMS service like Twilio, Nexmo, etc.
  // For now, we'll just log the SMS details
  const booking = notification.Booking;
  
  logger.info(`[MOCK SMS] Sending SMS notification for booking ${booking.id}`);
  logger.info(`[MOCK SMS] To: ${booking.customer_phone || 'No phone provided'}`);
  logger.info(`[MOCK SMS] Message: Your booking has been ${booking.status} for ${new Date(booking.start_time).toLocaleString()}`);

  // Simulate SMS sending delay
  await new Promise(resolve => setTimeout(resolve, 500));
};

/**
 * Queue notification for a booking
 * @param {string} bookingId - Booking ID
 * @param {string} type - Notification type ('email' or 'sms')
 * @returns {Promise<Object>} Created notification
 */
const queueNotification = async (bookingId, type = 'email') => {
  try {
    // Create notification record
    const notification = await Notification.create({
      id: uuidv4(),
      booking_id: bookingId,
      type,
      status: 'pending'
    });

    logger.info(`Notification queued: ${notification.id} for booking ${bookingId}`);
    return notification;
  } catch (error) {
    logger.error(`Error queueing notification for booking ${bookingId}:`, error);
    throw error;
  }
};

module.exports = {
  processNotificationQueue,
  queueNotification
};