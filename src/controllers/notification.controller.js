/**
 * Notification controller
 *
 * Handles notification management (history, status, test delivery)
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const { isValid, parseISO, addDays, addHours } = require('date-fns');
const logger = require('../config/logger');
const { Notification, Booking, User, AuditLog } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const notificationService = require('../services/notification.service');

/**
 * Get notification history for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getNotificationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 100, offset = 0, order = 'sent_at', dir = 'desc',
      type, status, start_date: startDate, end_date: endDate
    } = req.query;

    // Build where clause
    const whereClause = {};
    
    // Filter by type
    if (type && ['email', 'sms'].includes(type)) {
      whereClause.type = type;
    }

    // Filter by status
    if (status && ['pending', 'sent', 'failed'].includes(status)) {
      whereClause.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      whereClause.sent_at = {};
      if (startDate && isValid(parseISO(startDate))) {
        whereClause.sent_at[Op.gte] = parseISO(startDate);
      }
      if (endDate && isValid(parseISO(endDate))) {
        whereClause.sent_at[Op.lte] = parseISO(endDate);
      }
    }

    // Find all notifications for user's bookings
    const notifications = await Notification.findAndCountAll({
      where: whereClause,
      include: [{
        model: Booking,
        required: true,
        where: { user_id: userId },
        attributes: ['id', 'customer_name', 'customer_email', 'start_time', 'end_time']
      }],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [[order, dir]]
    });

    // Set pagination headers
    res.set({
      'X-Total-Count': notifications.count,
      'X-Total-Pages': Math.ceil(notifications.count / limit),
      'X-Per-Page': limit,
      'X-Current-Page': Math.floor(offset / limit) + 1
    });

    return res.status(200).json({
      notifications: notifications.rows
    });
  } catch (error) {
    logger.error('Error getting notification history:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get notification history'
      }
    });
  }
};

/**
 * Get notification statistics for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date: startDate, end_date: endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate && isValid(parseISO(startDate))) {
      dateFilter[Op.gte] = parseISO(startDate);
    }
    if (endDate && isValid(parseISO(endDate))) {
      dateFilter[Op.lte] = parseISO(endDate);
    }

    // Get statistics
    const stats = await Notification.findAll({
      attributes: [
        'type',
        'status',
        [sequelize.fn('COUNT', sequelize.col('Notification.id')), 'count']
      ],
      include: [{
        model: Booking,
        required: true,
        where: { user_id: userId },
        attributes: []
      }],
      where: Object.keys(dateFilter).length > 0 ? { sent_at: dateFilter } : {},
      group: ['type', 'status'],
      raw: true
    });

    // Format statistics
    const formattedStats = {
      email: {
        pending: 0,
        sent: 0,
        failed: 0,
        total: 0
      },
      sms: {
        pending: 0,
        sent: 0,
        failed: 0,
        total: 0
      },
      total: {
        pending: 0,
        sent: 0,
        failed: 0,
        total: 0
      }
    };

    // Process raw stats
    stats.forEach((stat) => {
      const count = parseInt(stat.count, 10);
      formattedStats[stat.type][stat.status] = count;
      formattedStats[stat.type].total += count;
      formattedStats.total[stat.status] += count;
      formattedStats.total.total += count;
    });

    return res.status(200).json({
      statistics: formattedStats,
      period: {
        start_date: startDate || null,
        end_date: endDate || null
      }
    });
  } catch (error) {
    logger.error('Error getting notification statistics:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get notification statistics'
      }
    });
  }
};

/**
 * Mark notification as read/acknowledged
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const markNotificationRead = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find notification with user validation
    const notification = await Notification.findOne({
      where: { id },
      include: [{
        model: Booking,
        required: true,
        where: { user_id: userId }
      }]
    });

    if (!notification) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Notification not found'
        }
      });
    }

    // Add read timestamp (using error_message field as we don't have a dedicated read field)
    // In a real system, we'd add a proper read_at field
    const readInfo = JSON.parse(notification.error_message || '{}');
    readInfo.read_at = new Date();
    notification.error_message = JSON.stringify(readInfo);
    await notification.save({ transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'notification.read',
      metadata: {
        notification_id: id,
        booking_id: notification.booking_id
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    logger.info(`Notification marked as read: ${id}`);

    return res.status(200).json({
      message: 'Notification marked as read',
      notification: {
        id: notification.id,
        read_at: readInfo.read_at
      }
    });
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error marking notification as read:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to mark notification as read'
      }
    });
  }
};

/**
 * Send test notification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendTestNotification = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { type, booking_id: bookingId } = req.body;

    // Validate notification type
    if (!type || !['email', 'sms'].includes(type)) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Valid notification type is required (email or sms)',
          params: [
            {
              param: 'type',
              message: 'Must be either "email" or "sms"'
            }
          ]
        }
      });
    }

    // If booking_id provided, validate it belongs to user
    let booking = null;
    if (bookingId) {
      booking = await Booking.findOne({
        where: { 
          id: bookingId,
          user_id: userId
        }
      });

      if (!booking) {
        return res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Booking not found'
          }
        });
      }
    } else {
      // Create a test booking for the notification
      const user = await User.findByPk(userId);
      booking = await Booking.create({
        id: uuidv4(),
        user_id: userId,
        customer_name: 'Test Customer',
        customer_email: user.email, // Send test to user's own email
        start_time: addDays(new Date(), 1),
        end_time: addHours(addDays(new Date(), 1), 1),
        status: 'confirmed',
        description: 'TEST NOTIFICATION - This is a test booking'
      }, { transaction });
    }

    // Create test notification
    const notification = await Notification.create({
      id: uuidv4(),
      booking_id: booking.id,
      type,
      status: 'pending'
    }, { transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'notification.test_send',
      metadata: {
        notification_id: notification.id,
        booking_id: booking.id,
        type,
        test_booking: !bookingId
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Queue the notification for processing
    try {
      await notificationService.queueNotification(booking.id, type);
      
      // Process immediately for test notifications
      await notificationService.processNotificationQueue();

      logger.info(`Test notification sent: ${notification.id}`);

      return res.status(200).json({
        message: `Test ${type} notification queued successfully`,
        notification: {
          id: notification.id,
          type: notification.type,
          booking_id: booking.id,
          test_booking: !bookingId
        }
      });
    } catch (sendError) {
      logger.error('Error sending test notification:', sendError);
      
      return res.status(500).json({
        error: {
          code: 'internal_server_error',
          message: `Failed to send test ${type} notification`
        }
      });
    }
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error creating test notification:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to create test notification'
      }
    });
  }
};

/**
 * Resend failed notification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resendNotification = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find notification with user validation
    const notification = await Notification.findOne({
      where: { 
        id,
        status: 'failed' // Only allow resending failed notifications
      },
      include: [{
        model: Booking,
        required: true,
        where: { user_id: userId }
      }]
    });

    if (!notification) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Failed notification not found'
        }
      });
    }

    // Reset notification status
    notification.status = 'pending';
    notification.error_message = null;
    await notification.save({ transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'notification.resend',
      metadata: {
        notification_id: id,
        booking_id: notification.booking_id,
        type: notification.type
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Queue the notification for reprocessing
    try {
      await notificationService.queueNotification(notification.booking_id, notification.type);
      
      logger.info(`Notification queued for resend: ${id}`);

      return res.status(200).json({
        message: 'Notification queued for resend',
        notification: {
          id: notification.id,
          type: notification.type,
          status: notification.status
        }
      });
    } catch (queueError) {
      logger.error('Error queueing notification for resend:', queueError);
      
      return res.status(500).json({
        error: {
          code: 'internal_server_error',
          message: 'Failed to queue notification for resend'
        }
      });
    }
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error resending notification:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to resend notification'
      }
    });
  }
};

module.exports = {
  getNotificationHistory,
  getNotificationStats,
  markNotificationRead,
  sendTestNotification,
  resendNotification
};