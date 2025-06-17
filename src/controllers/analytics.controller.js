/**
 * Analytics controller
 *
 * Handles analytics and reporting for bookings and user activity
 *
 * @author meetabl Team
 */

const { 
  isValid, 
  parseISO, 
  subMonths, 
  format, 
  differenceInDays, 
  differenceInMinutes,
  startOfDay
} = require('date-fns');
const logger = require('../config/logger');

// Try to load json2csv, but handle if not installed
let Parser;
try {
  const json2csv = require('json2csv');
  Parser = json2csv.Parser;
} catch (error) {
  logger.warn('json2csv not installed - CSV export will not be available');
}
const { Booking, User, Notification, AuditLog } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

/**
 * Get booking statistics for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBookingStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date: startDate, end_date: endDate, group_by: groupBy = 'month' } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate && isValid(parseISO(startDate))) {
      dateFilter[Op.gte] = parseISO(startDate);
    } else {
      // Default to last 12 months
      dateFilter[Op.gte] = subMonths(new Date(), 12);
    }
    if (endDate && isValid(parseISO(endDate))) {
      dateFilter[Op.lte] = parseISO(endDate);
    }

    // Get basic statistics
    const totalBookings = await Booking.count({
      where: {
        user_id: userId,
        start_time: dateFilter
      }
    });

    const confirmedBookings = await Booking.count({
      where: {
        user_id: userId,
        status: 'confirmed',
        start_time: dateFilter
      }
    });

    const cancelledBookings = await Booking.count({
      where: {
        user_id: userId,
        status: 'cancelled',
        start_time: dateFilter
      }
    });

    // Get average booking duration
    const bookingDurations = await Booking.findAll({
      attributes: [
        [sequelize.fn('AVG', 
          sequelize.literal('TIMESTAMPDIFF(MINUTE, start_time, end_time)')
        ), 'avg_duration']
      ],
      where: {
        user_id: userId,
        status: 'confirmed',
        start_time: dateFilter
      },
      raw: true
    });

    const avgDuration = bookingDurations[0]?.avg_duration || 0;

    // Get time-based grouping
    let groupByClause;
    let dateFormat;
    
    switch (groupBy) {
      case 'day':
        groupByClause = sequelize.fn('DATE', sequelize.col('start_time'));
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        groupByClause = sequelize.fn('YEARWEEK', sequelize.col('start_time'));
        dateFormat = 'YYYY-[W]WW';
        break;
      case 'month':
      default:
        groupByClause = sequelize.fn('DATE_FORMAT', sequelize.col('start_time'), '%Y-%m');
        dateFormat = 'YYYY-MM';
        break;
    }

    // Get bookings over time
    const bookingsOverTime = await Booking.findAll({
      attributes: [
        [groupByClause, 'period'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('COUNT', 
          sequelize.literal("CASE WHEN status = 'confirmed' THEN 1 END")
        ), 'confirmed'],
        [sequelize.fn('COUNT', 
          sequelize.literal("CASE WHEN status = 'cancelled' THEN 1 END")
        ), 'cancelled']
      ],
      where: {
        user_id: userId,
        start_time: dateFilter
      },
      group: [groupByClause],
      order: [[groupByClause, 'ASC']],
      raw: true
    });

    // Get popular time slots
    const popularTimeSlots = await Booking.findAll({
      attributes: [
        [sequelize.fn('HOUR', sequelize.col('start_time')), 'hour'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        user_id: userId,
        status: 'confirmed',
        start_time: dateFilter
      },
      group: [sequelize.fn('HOUR', sequelize.col('start_time'))],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5,
      raw: true
    });

    // Get repeat customers
    const repeatCustomers = await Booking.findAll({
      attributes: [
        'customer_email',
        [sequelize.fn('COUNT', sequelize.col('id')), 'booking_count']
      ],
      where: {
        user_id: userId,
        status: 'confirmed',
        start_time: dateFilter
      },
      group: ['customer_email'],
      having: sequelize.literal('COUNT(id) > 1'),
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10,
      raw: true
    });

    return res.status(200).json({
      statistics: {
        total_bookings: totalBookings,
        confirmed_bookings: confirmedBookings,
        cancelled_bookings: cancelledBookings,
        cancellation_rate: totalBookings > 0 ? (cancelledBookings / totalBookings * 100).toFixed(2) : 0,
        average_duration_minutes: Math.round(avgDuration),
        repeat_customer_count: repeatCustomers.length
      },
      bookings_over_time: bookingsOverTime.map(item => ({
        period: item.period,
        total: parseInt(item.count, 10),
        confirmed: parseInt(item.confirmed, 10),
        cancelled: parseInt(item.cancelled, 10)
      })),
      popular_time_slots: popularTimeSlots.map(slot => ({
        hour: parseInt(slot.hour, 10),
        count: parseInt(slot.count, 10)
      })),
      top_repeat_customers: repeatCustomers.map(customer => ({
        email: customer.customer_email,
        bookings: parseInt(customer.booking_count, 10)
      })),
      period: {
        start_date: startDate || format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
        end_date: endDate || format(new Date(), 'yyyy-MM-dd'),
        group_by: groupBy
      }
    });
  } catch (error) {
    logger.error('Error getting booking statistics:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get booking statistics'
      }
    });
  }
};

/**
 * Get usage analytics for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    const startDate = startOfDay(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

    // Get login activity from audit logs
    const loginActivity = await AuditLog.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        user_id: userId,
        action: 'user.login',
        createdAt: { [Op.gte]: startDate }
      },
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // Get booking creation activity
    const bookingActivity = await AuditLog.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        user_id: userId,
        action: 'booking.create',
        createdAt: { [Op.gte]: startDate }
      },
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // Get all user actions summary
    const actionsSummary = await AuditLog.findAll({
      attributes: [
        'action',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        user_id: userId,
        createdAt: { [Op.gte]: startDate }
      },
      group: ['action'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true
    });

    // Get calendar integration status
    const user = await User.findByPk(userId, {
      attributes: ['calendar_provider', 'email_verified', 'created']
    });

    // Calculate account age
    const accountAgeDays = differenceInDays(new Date(), new Date(user.created));

    // Get notification delivery stats with optimized query
    const notificationStats = await sequelize.query(`
      SELECT 
        n.type,
        n.status,
        COUNT(n.id) as count
      FROM Notifications n
      INNER JOIN Bookings b ON n.booking_id = b.id
      WHERE b.user_id = :userId 
        AND n.sent_at >= :startDate
      GROUP BY n.type, n.status
    `, {
      replacements: { userId, startDate },
      type: sequelize.QueryTypes.SELECT
    });

    // Format notification stats using reduce for better performance
    const notificationSummary = notificationStats.reduce((summary, stat) => {
      if (!summary[stat.type]) {
        summary[stat.type] = { sent: 0, failed: 0, pending: 0 };
      }
      summary[stat.type][stat.status] = parseInt(stat.count, 10);
      return summary;
    }, {
      email: { sent: 0, failed: 0, pending: 0 },
      sms: { sent: 0, failed: 0, pending: 0 }
    });

    return res.status(200).json({
      account_info: {
        account_age_days: accountAgeDays,
        calendar_integrated: !!user.calendar_provider,
        calendar_provider: user.calendar_provider,
        email_verified: user.email_verified
      },
      activity: {
        login_activity: loginActivity.map(item => ({
          date: item.date,
          logins: parseInt(item.count, 10)
        })),
        booking_activity: bookingActivity.map(item => ({
          date: item.date,
          bookings_created: parseInt(item.count, 10)
        })),
        actions_summary: actionsSummary.map(item => ({
          action: item.action,
          count: parseInt(item.count, 10)
        }))
      },
      notifications: notificationSummary,
      period: {
        days: parseInt(days, 10),
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd')
      }
    });
  } catch (error) {
    logger.error('Error getting user analytics:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get user analytics'
      }
    });
  }
};

/**
 * Export bookings data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const exportBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      format = 'csv', 
      start_date: startDate, 
      end_date: endDate,
      status
    } = req.query;

    // Build filters
    const where = { user_id: userId };
    
    if (startDate && isValid(parseISO(startDate))) {
      where.start_time = where.start_time || {};
      where.start_time[Op.gte] = parseISO(startDate);
    }
    
    if (endDate && isValid(parseISO(endDate))) {
      where.start_time = where.start_time || {};
      where.start_time[Op.lte] = parseISO(endDate);
    }
    
    if (status && ['confirmed', 'cancelled'].includes(status)) {
      where.status = status;
    }

    // Get bookings
    const bookings = await Booking.findAll({
      where,
      order: [['start_time', 'DESC']],
      raw: true
    });

    // Format data for export
    const exportData = bookings.map(booking => ({
      id: booking.id,
      customer_name: booking.customer_name,
      customer_email: booking.customer_email,
      start_time: format(new Date(booking.start_time), 'yyyy-MM-dd HH:mm:ss'),
      end_time: format(new Date(booking.end_time), 'yyyy-MM-dd HH:mm:ss'),
      duration_minutes: differenceInMinutes(new Date(booking.end_time), new Date(booking.start_time)),
      status: booking.status,
      created_at: format(new Date(booking.created), 'yyyy-MM-dd HH:mm:ss'),
      description: booking.description || ''
    }));

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="bookings.json"');
      return res.json(exportData);
    }

    // Default to CSV
    if (!Parser) {
      return res.status(400).json({
        error: {
          code: 'csv_export_unavailable',
          message: 'CSV export is not available. Please use format=json instead.'
        }
      });
    }

    const fields = [
      'id', 'customer_name', 'customer_email', 'start_time', 
      'end_time', 'duration_minutes', 'status', 'created_at', 'description'
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(exportData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');
    
    return res.send(csv);
  } catch (error) {
    logger.error('Error exporting bookings:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to export bookings'
      }
    });
  }
};

/**
 * Get revenue analytics (for paid bookings)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRevenueAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date: startDate, end_date: endDate, group_by: groupBy = 'month' } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate && isValid(parseISO(startDate))) {
      dateFilter[Op.gte] = parseISO(startDate);
    } else {
      // Default to last 12 months
      dateFilter[Op.gte] = subMonths(new Date(), 12);
    }
    if (endDate && isValid(parseISO(endDate))) {
      dateFilter[Op.lte] = parseISO(endDate);
    }

    // Note: Since we don't have payment data in the current schema,
    // this is a placeholder that returns mock data structure
    // In a real implementation, this would query payment/invoice tables

    return res.status(200).json({
      revenue: {
        total_revenue: 0,
        total_paid_bookings: 0,
        average_booking_value: 0,
        currency: 'USD'
      },
      revenue_over_time: [],
      top_services: [],
      payment_methods: {
        credit_card: 0,
        paypal: 0,
        other: 0
      },
      period: {
        start_date: startDate || format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
        end_date: endDate || format(new Date(), 'yyyy-MM-dd'),
        group_by: groupBy
      },
      note: 'Payment integration not yet implemented'
    });
  } catch (error) {
    logger.error('Error getting revenue analytics:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get revenue analytics'
      }
    });
  }
};

module.exports = {
  getBookingStats,
  getUserAnalytics,
  exportBookings,
  getRevenueAnalytics
};