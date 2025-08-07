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
const { Notification, Booking, User, Poll, PollTimeSlot } = require('../models');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  if (process.env.NODE_ENV === 'test') {
    // Return a mock transporter for tests
    return {
      sendMail: async () => ({ messageId: 'test-message-id' })
    };
  }

  return nodemailer.createTransport({
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
        as: 'booking',
        required: true,
        include: [{
          model: User,
          as: 'user',
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

    // Get display name for the provider
    const providerName = user.firstName ? 
      `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : 
      user.email;

    // Determine template based on booking status
    let templateName = 'booking-confirmation.html';
    let subject = `Booking Confirmation with ${providerName}`;
    
    if (booking.status === 'cancelled') {
      templateName = 'booking-cancelled.html';
      subject = `Booking Cancelled with ${providerName}`;
    }

    // Load email template
    const templatePath = path.join(__dirname, '..', 'config', 'templates', templateName);
    let emailTemplate = await fs.readFile(templatePath, 'utf8');

    // Replace template variables
    emailTemplate = emailTemplate
      .replace(/{{customerName}}/g, booking.customer_name)
      .replace(/{{providerName}}/g, providerName)
      .replace(/{{startTime}}/g, new Date(booking.start_time).toLocaleString())
      .replace(/{{endTime}}/g, new Date(booking.end_time).toLocaleString())
      .replace(/{{status}}/g, booking.status);

    // Add Meetabl branding for free plan users
    if (!user.can_remove_branding) {
      const brandingHtml = `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #666;">
          <p>Powered by <a href="https://meetabl.com" style="color: #003b49; text-decoration: none;">Meetabl</a> - Schedule meetings effortlessly</p>
        </div>
      `;
      
      // Add branding before closing body tag
      emailTemplate = emailTemplate.replace('</body>', brandingHtml + '</body>');
    }

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
      bookingId: bookingId,
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

    // Determine the name to use in the greeting
    // Use firstName if available, otherwise fall back to email
    const displayName = user.firstName || user.email;

    // Replace template variables
    emailTemplate = emailTemplate
      .replace(/{{name}}/g, displayName)
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

    // Determine the name to use in the greeting
    // Use firstName if available, otherwise fall back to email
    const displayName = user.firstName || user.email;

    // Replace template variables
    emailTemplate = emailTemplate
      .replace(/{{name}}/g, displayName)
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

/**
 * Send booking confirmation request email
 * @param {Object} params - Email parameters
 * @returns {Promise<void>}
 */
const sendBookingConfirmationRequest = async (params) => {
  try {
    const {
      to,
      customerName,
      hostName,
      startTime,
      endTime,
      confirmationUrl,
      expiresAt
    } = params;

    const transporter = createTransporter();

    // Format date and time
    const startDate = new Date(startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedStartTime = startDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedEndTime = new Date(endTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Create HTML email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #005a8b; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: bold; font-size: 16px; border: 2px solid transparent; }
          .button:hover { background-color: #004066; text-decoration: underline; }
          .button:focus { outline: 3px solid #005a8b; outline-offset: 2px; border-color: white; }
          .details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .warning { color: #dc3545; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Confirm Your Booking</h1>
          </div>
          <div class="content">
            <p>Hi ${customerName},</p>
            <p>You're almost done! Please confirm your booking request with ${hostName}.</p>
            
            <div class="details">
              <h3>Booking Details:</h3>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
              <p><strong>With:</strong> ${hostName}</p>
            </div>
            
            <p style="text-align: center;">
              <a href="${confirmationUrl}" class="button">Confirm Booking</a>
            </p>
            
            <p class="warning">This link expires in 30 minutes. If you don't confirm in time, you'll need to request a new booking.</p>
            
            <p>If you didn't request this booking, you can safely ignore this email.</p>
            
            <p>Best regards,<br>The Meetabl Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"Meetabl" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: to,
      subject: `Action Required: Confirm your booking with ${hostName}`,
      html: emailHtml
    });

    logger.info(`Booking confirmation request sent to ${to}: ${info.messageId}`);
  } catch (error) {
    logger.error('Error sending booking confirmation request:', error);
    throw error;
  }
};

/**
 * Send booking confirmation to customer
 * @param {Object} params - Parameters with booking and host
 * @returns {Promise<void>}
 */
const sendBookingConfirmationToCustomer = async (params) => {
  try {
    const { booking, host } = params;
    const transporter = createTransporter();

    // Format date and time
    const startDate = new Date(booking.startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedStartTime = startDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedEndTime = new Date(booking.endTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hi ${booking.customerName},</p>
            <p>Great news! Your booking has been confirmed.</p>
            
            <div class="details">
              <h3>Booking Details:</h3>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
              <p><strong>With:</strong> ${host.firstName} ${host.lastName}</p>
              ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
            </div>
            
            <p>We've sent this information to ${host.firstName} as well. They may contact you if they need any additional information.</p>
            
            <p>Add this event to your calendar so you don't forget!</p>
            
            <p>Best regards,<br>The Meetabl Team</p>
          </div>
          <div class="footer">
            <p>Need to cancel? Contact ${host.firstName} directly at ${host.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"Meetabl" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: booking.customerEmail,
      subject: `Booking Confirmed with ${host.firstName} ${host.lastName}`,
      html: emailHtml
    });

    logger.info(`Booking confirmation sent to customer ${booking.customerEmail}: ${info.messageId}`);
  } catch (error) {
    logger.error('Error sending booking confirmation to customer:', error);
    throw error;
  }
};

/**
 * Send booking notification to host
 * @param {Object} params - Parameters with booking and host
 * @returns {Promise<void>}
 */
const sendBookingNotificationToHost = async (params) => {
  try {
    const { booking, host } = params;
    const transporter = createTransporter();

    // Format date and time
    const startDate = new Date(booking.startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedStartTime = startDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedEndTime = new Date(booking.endTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #004085; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Booking Confirmed</h1>
          </div>
          <div class="content">
            <p>Hi ${host.firstName},</p>
            <p>You have a new confirmed booking!</p>
            
            <div class="details">
              <h3>Booking Details:</h3>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
              <p><strong>Customer:</strong> ${booking.customerName}</p>
              <p><strong>Email:</strong> ${booking.customerEmail}</p>
              ${booking.customerPhone ? `<p><strong>Phone:</strong> ${booking.customerPhone}</p>` : ''}
              ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
            </div>
            
            <p>This booking has been added to your calendar. The customer has received a confirmation email.</p>
            
            <p>Best regards,<br>The Meetabl Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"Meetabl" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: host.email,
      subject: `New Booking: ${booking.customerName} on ${formattedDate}`,
      html: emailHtml
    });

    logger.info(`Booking notification sent to host ${host.email}: ${info.messageId}`);
  } catch (error) {
    logger.error('Error sending booking notification to host:', error);
    throw error;
  }
};

/**
 * Send poll vote notification to poll owner
 * @param {string} pollId - Poll ID
 * @param {Object} voteData - Vote information
 * @returns {Promise<void>}
 */
const sendPollVoteNotification = async (pollId, voteData) => {
  try {
    const transporter = createTransporter();

    // Get poll and owner information
    const poll = await Poll.findByPk(pollId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email']
        }
      ]
    });

    if (!poll || !poll.user) {
      throw new Error('Poll or poll owner not found');
    }

    const owner = poll.user;
    const pollUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/polls/${pollId}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4a90e2; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 24px; background: #4a90e2; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Poll Vote Received</h1>
          </div>
          <div class="content">
            <p>Hi ${owner.firstName},</p>
            <p>Someone has voted on your poll!</p>
            
            <div class="details">
              <h3>Poll Details:</h3>
              <p><strong>Poll Title:</strong> ${poll.title}</p>
              <p><strong>Participant:</strong> ${voteData.participantName}</p>
              ${voteData.participantEmail !== '[Anonymous]' ? `<p><strong>Email:</strong> ${voteData.participantEmail}</p>` : ''}
              <p><strong>Number of Votes:</strong> ${voteData.voteCount}</p>
            </div>
            
            <p>
              <a href="${pollUrl}" class="button">View Poll Results</a>
            </p>
            
            <p>Best regards,<br>The Meetabl Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"Meetabl" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: owner.email,
      subject: `New vote on your poll: ${poll.title}`,
      html: emailHtml
    });

    logger.info(`Poll vote notification sent to ${owner.email}: ${info.messageId}`);
  } catch (error) {
    logger.error('Error sending poll vote notification:', error);
    throw error;
  }
};

/**
 * Send poll finalization notification to all participants
 * @param {string} pollId - Poll ID
 * @param {Object} selectedTimeSlot - Selected time slot
 * @returns {Promise<void>}
 */
const sendPollFinalizationNotification = async (pollId, selectedTimeSlot) => {
  try {
    const transporter = createTransporter();

    // Get poll, owner, and votes information
    const poll = await Poll.findByPk(pollId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email']
        },
        {
          model: PollVote,
          as: 'votes',
          attributes: ['participantName', 'participantEmail']
        }
      ]
    });

    if (!poll || !poll.user) {
      throw new Error('Poll or poll owner not found');
    }

    const owner = poll.user;
    
    // Get unique participants
    const participants = {};
    poll.votes.forEach(vote => {
      participants[vote.participantEmail] = vote.participantName;
    });

    const formattedStartTime = new Date(selectedTimeSlot.startTime).toLocaleString();
    const formattedEndTime = new Date(selectedTimeSlot.endTime).toLocaleTimeString();

    const emailPromises = Object.entries(participants).map(([email, name]) => {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
            .time-slot { background: #e8f5e8; padding: 15px; border-left: 5px solid #28a745; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Meeting Time Selected!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Great news! ${owner.firstName} ${owner.lastName} has selected the final time for the meeting poll you participated in.</p>
              
              <div class="details">
                <h3>Meeting Details:</h3>
                <p><strong>Title:</strong> ${poll.title}</p>
                ${poll.description ? `<p><strong>Description:</strong> ${poll.description}</p>` : ''}
                <p><strong>Host:</strong> ${owner.firstName} ${owner.lastName}</p>
                <p><strong>Duration:</strong> ${poll.durationMinutes} minutes</p>
              </div>

              <div class="time-slot">
                <h3>Selected Time:</h3>
                <p><strong>Date & Time:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
                <p><strong>Timezone:</strong> ${poll.timezone}</p>
              </div>
              
              <p>Please mark this time in your calendar. You should receive a calendar invitation shortly.</p>
              
              <p>Best regards,<br>The Meetabl Team</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return transporter.sendMail({
        from: `"Meetabl" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: email,
        subject: `Meeting time selected: ${poll.title}`,
        html: emailHtml
      });
    });

    const results = await Promise.all(emailPromises);
    
    logger.info(`Poll finalization notifications sent to ${results.length} participants`);
  } catch (error) {
    logger.error('Error sending poll finalization notifications:', error);
    throw error;
  }
};

module.exports = {
  processNotificationQueue,
  queueNotification,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendBookingConfirmationRequest,
  sendBookingConfirmationToCustomer,
  sendBookingNotificationToHost,
  sendPollVoteNotification,
  sendPollFinalizationNotification
};
