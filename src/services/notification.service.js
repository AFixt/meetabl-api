/**
 * Notification service
 *
 * Manages sending email and SMS notifications
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');
const { Notification, Booking, User } = require('../models');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  if (process.env.NODE_ENV === 'test') {
    // Return a mock transporter for tests
    return {
      sendMail: async () => ({ messageId: 'test-message-id' })
    };
  }

  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER || process.env.SMTP_USER,
      pass: process.env.EMAIL_PASS || process.env.SMTP_PASS
    }
  });
};

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

    // Process notifications in parallel with batch status updates
    const notificationUpdates = [];
    
    const processedNotifications = await Promise.allSettled(
      pendingNotifications.map(async (notification) => {
        try {
          if (notification.type === 'email') {
            await sendEmailNotification(notification);
          } else if (notification.type === 'sms') {
            await sendSmsNotification(notification);
          }

          // Prepare batch update data for successful notifications
          notificationUpdates.push({
            id: notification.id,
            status: 'sent',
            sent_at: new Date(),
            error_message: null
          });

          return { success: true, notificationId: notification.id };
        } catch (error) {
          logger.error(`Failed to process notification ${notification.id}:`, error);

          // Prepare batch update data for failed notifications
          notificationUpdates.push({
            id: notification.id,
            status: 'failed',
            error_message: error.message,
            sent_at: null
          });

          return { success: false, notificationId: notification.id, error };
        }
      })
    );

    // Batch update notification statuses
    if (notificationUpdates.length > 0) {
      try {
        for (const update of notificationUpdates) {
          await Notification.update(
            {
              status: update.status,
              sent_at: update.sent_at,
              error_message: update.error_message
            },
            { where: { id: update.id } }
          );
        }
        
        const successCount = processedNotifications.filter(r => r.value?.success).length;
        const failureCount = processedNotifications.length - successCount;
        
        logger.info(`Notification processing complete: ${successCount} sent, ${failureCount} failed`);
      } catch (batchError) {
        logger.error('Error updating notification statuses:', batchError);
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
  try {
    const booking = notification.Booking;
    const user = booking.User;
    const transporter = createTransporter();

    // Determine template based on booking status
    let templateName = 'booking-confirmation.html';
    let subject = `Booking Confirmation with ${user.name}`;
    
    if (booking.status === 'cancelled') {
      templateName = 'booking-cancelled.html';
      subject = `Booking Cancelled with ${user.name}`;
    }

    // Load email template
    const templatePath = path.join(__dirname, '..', 'config', 'templates', templateName);
    let emailTemplate = await fs.readFile(templatePath, 'utf8');

    // Replace template variables
    emailTemplate = emailTemplate
      .replace(/{{customerName}}/g, booking.customer_name)
      .replace(/{{providerName}}/g, user.name)
      .replace(/{{startTime}}/g, new Date(booking.start_time).toLocaleString())
      .replace(/{{endTime}}/g, new Date(booking.end_time).toLocaleString())
      .replace(/{{status}}/g, booking.status);

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Meetabl'}" <${process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@meetabl.com'}>`,
      to: booking.customer_email,
      subject,
      html: emailTemplate
    });

    logger.info(`Email sent: ${info.messageId}`);
  } catch (error) {
    logger.error('Error sending email notification:', error);
    throw error;
  }
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
  await new Promise((resolve) => setTimeout(resolve, 500));
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

/**
 * Send password reset email
 * @param {Object} user - User instance
 * @param {string} resetToken - Password reset token
 * @returns {Promise<void>}
 */
const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    logger.info(`Attempting to send password reset email to ${user.email}`);
    
    // Log configuration being used
    logger.info('Email config:', {
      host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || process.env.SMTP_PORT || 587,
      user: process.env.EMAIL_USER || process.env.SMTP_USER || 'NOT SET',
      from: process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@meetabl.com'
    });
    
    const transporter = createTransporter();
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`;

    // Load email template
    const templatePath = path.join(__dirname, '..', 'config', 'templates', 'password-reset.html');
    let emailTemplate = await fs.readFile(templatePath, 'utf8');

    // Replace template variables
    emailTemplate = emailTemplate
      .replace(/{{name}}/g, user.name)
      .replace(/{{resetUrl}}/g, resetUrl);

    // Send email
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Meetabl'}" <${process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@meetabl.com'}>`,
      to: user.email,
      subject: 'Password Reset Request - Meetabl',
      html: emailTemplate
    };
    
    logger.info('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent successfully to ${user.email}: ${info.messageId}`);
    
    return info;
  } catch (error) {
    logger.error('Error sending password reset email:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command
    });
    throw error;
  }
};

/**
 * Send email verification email
 * @param {Object} user - User instance
 * @param {string} verificationToken - Email verification token
 * @returns {Promise<void>}
 */
const sendEmailVerification = async (user, verificationToken) => {
  try {
    const transporter = createTransporter();
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${verificationToken}`;

    // Load email template
    const templatePath = path.join(__dirname, '..', 'config', 'templates', 'email-verification.html');
    let emailTemplate = await fs.readFile(templatePath, 'utf8');

    // Replace template variables
    emailTemplate = emailTemplate
      .replace(/{{name}}/g, user.name)
      .replace(/{{verificationUrl}}/g, verificationUrl);

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Meetabl'}" <${process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@meetabl.com'}>`,
      to: user.email,
      subject: 'Verify Your Email - Meetabl',
      html: emailTemplate
    });

    logger.info(`Email verification sent to ${user.email}: ${info.messageId}`);
  } catch (error) {
    logger.error('Error sending email verification:', error);
    throw error;
  }
};

module.exports = {
  processNotificationQueue,
  queueNotification,
  sendPasswordResetEmail,
  sendEmailVerification
};
