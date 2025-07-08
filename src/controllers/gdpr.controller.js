/**
 * GDPR Compliance Controller
 * 
 * Handles GDPR-related operations including data export, deletion requests,
 * and consent management
 * 
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { User, UserSettings, AuditLog, AvailabilityRule, Booking, Notification, GdprRequest } = require('../models');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const gdprService = require('../services/gdpr.service');
const { asyncHandler, successResponse, notFoundError, validationError, createError } = require('../utils/error-response');

/**
 * Export user data for GDPR data portability
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const exportData = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { format = 'json' } = req.query;

    if (!['json', 'csv'].includes(format)) {
      throw validationError([{ field: 'format', message: 'Format must be either "json" or "csv"' }]);
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Create GDPR request record
    const gdprRequestId = uuidv4();
    await GdprRequest.create({
      id: gdprRequestId,
      user_id: userId,
      request_type: 'data_export',
      status: 'processing',
      requested_at: new Date(),
      metadata: {
        format,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      }
    });

    // Export user data using GDPR service
    const exportData = await gdprService.exportUserData(userId, { format });

    // Update GDPR request as completed
    await GdprRequest.update({
      status: 'completed',
      completed_at: new Date(),
      metadata: {
        format,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        data_size_bytes: JSON.stringify(exportData).length
      }
    }, {
      where: { id: gdprRequestId }
    });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'gdpr.data_exported',
      metadata: {
        format,
        gdpr_request_id: gdprRequestId,
        data_categories: Object.keys(exportData)
      }
    });

    logger.info(`GDPR data export completed for user ${userId} in ${format} format`);

    // Set appropriate headers for file download
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${userId}-${new Date().toISOString().split('T')[0]}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${userId}-${new Date().toISOString().split('T')[0]}.json"`);
    }

    return successResponse(res, {
      export_data: exportData,
      metadata: {
        user_id: userId,
        export_date: new Date().toISOString(),
        format,
        gdpr_request_id: gdprRequestId,
        data_categories: Object.keys(exportData).length
      }
    }, 'Data export completed successfully');
  } catch (error) {
    logger.error('Error exporting GDPR data:', error);
    throw error;
  }
});

/**
 * Request account deletion with verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAccount = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, immediate = false } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Create GDPR deletion request
    const gdprRequestId = uuidv4();
    const gracePeriodDays = immediate ? 0 : 30; // 30-day grace period unless immediate
    const scheduledDeletion = new Date();
    scheduledDeletion.setDate(scheduledDeletion.getDate() + gracePeriodDays);

    await GdprRequest.create({
      id: gdprRequestId,
      user_id: userId,
      request_type: 'data_deletion',
      status: immediate ? 'processing' : 'pending',
      requested_at: new Date(),
      scheduled_for: scheduledDeletion,
      metadata: {
        reason: reason || 'User requested account deletion',
        immediate,
        grace_period_days: gracePeriodDays,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      }
    });

    if (immediate) {
      // Process deletion immediately
      const deletionResult = await gdprService.deleteUserData(userId, {
        reason: reason || 'Immediate deletion requested',
        gdpr_request_id: gdprRequestId
      });

      // Update GDPR request as completed
      await GdprRequest.update({
        status: 'completed',
        completed_at: new Date()
      }, {
        where: { id: gdprRequestId }
      });

      return successResponse(res, {
        deletion_result: deletionResult,
        gdpr_request_id: gdprRequestId
      }, 'Account has been deleted immediately');
    } else {
      // Schedule for deletion after grace period
      return successResponse(res, {
        gdpr_request_id: gdprRequestId,
        scheduled_deletion: scheduledDeletion,
        grace_period_days: gracePeriodDays
      }, `Account deletion scheduled for ${scheduledDeletion.toDateString()}. You can cancel this request within ${gracePeriodDays} days.`);
    }
  } catch (error) {
    logger.error('Error processing account deletion request:', error);
    throw error;
  }
});

/**
 * Cancel pending account deletion
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const cancelDeletion = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { gdpr_request_id } = req.body;

    if (!gdpr_request_id) {
      throw validationError([{ field: 'gdpr_request_id', message: 'GDPR request ID is required' }]);
    }

    // Find pending deletion request
    const gdprRequest = await GdprRequest.findOne({
      where: {
        id: gdpr_request_id,
        user_id: userId,
        request_type: 'data_deletion',
        status: 'pending'
      }
    });

    if (!gdprRequest) {
      throw notFoundError('No pending deletion request found');
    }

    // Check if still within grace period
    if (new Date() >= gdprRequest.scheduled_for) {
      throw validationError([{ field: 'deletion', message: 'Grace period has expired. Deletion cannot be cancelled.' }]);
    }

    // Cancel the deletion request
    await GdprRequest.update({
      status: 'cancelled',
      completed_at: new Date(),
      metadata: {
        ...gdprRequest.metadata,
        cancelled_by: 'user',
        cancelled_at: new Date().toISOString()
      }
    }, {
      where: { id: gdpr_request_id }
    });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'gdpr.deletion_cancelled',
      metadata: {
        gdpr_request_id
      }
    });

    logger.info(`Account deletion cancelled for user ${userId}, request ${gdpr_request_id}`);

    return successResponse(res, {
      gdpr_request_id,
      status: 'cancelled'
    }, 'Account deletion has been cancelled successfully');
  } catch (error) {
    logger.error('Error cancelling account deletion:', error);
    throw error;
  }
});

/**
 * Manage consent preferences
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const manageConsent = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { marketing_consent, data_processing_consent } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    // Data processing consent is required for service functionality
    if (data_processing_consent === false) {
      throw validationError([{ 
        field: 'data_processing_consent', 
        message: 'Data processing consent is required for service functionality. To withdraw this consent, please delete your account.' 
      }]);
    }

    const updates = {};
    const consentChanges = {};

    if (typeof marketing_consent === 'boolean') {
      updates.marketing_consent = marketing_consent;
      consentChanges.marketing_consent = {
        from: user.marketing_consent,
        to: marketing_consent
      };
    }

    if (typeof data_processing_consent === 'boolean') {
      updates.data_processing_consent = data_processing_consent;
      consentChanges.data_processing_consent = {
        from: user.data_processing_consent,
        to: data_processing_consent
      };
    }

    if (Object.keys(updates).length > 0) {
      updates.consent_timestamp = new Date();
      await User.update(updates, { where: { id: userId } });

      // Create audit log
      await AuditLog.create({
        id: uuidv4(),
        user_id: userId,
        action: 'gdpr.consent_updated',
        metadata: {
          consent_changes: consentChanges
        }
      });

      logger.info(`Consent preferences updated for user ${userId}`);
    }

    // Get updated user data
    const updatedUser = await User.findByPk(userId, {
      attributes: ['marketing_consent', 'data_processing_consent', 'consent_timestamp']
    });

    return successResponse(res, {
      consent_preferences: {
        marketing_consent: updatedUser.marketing_consent,
        data_processing_consent: updatedUser.data_processing_consent,
        last_updated: updatedUser.consent_timestamp
      }
    }, 'Consent preferences updated successfully');
  } catch (error) {
    logger.error('Error updating consent preferences:', error);
    throw error;
  }
});

/**
 * Get data processing agreement
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDataProcessingAgreement = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'marketing_consent', 'data_processing_consent', 'consent_timestamp', 'created_at']
    });

    if (!user) {
      throw notFoundError('User not found');
    }

    // Get GDPR requests history
    const gdprHistory = await GdprRequest.findAll({
      where: { user_id: userId },
      attributes: ['request_type', 'status', 'requested_at', 'completed_at'],
      order: [['requested_at', 'DESC']],
      limit: 10
    });

    const agreement = {
      user_id: userId,
      email: user.email,
      account_created: user.created_at,
      current_consents: {
        marketing: user.marketing_consent,
        data_processing: user.data_processing_consent,
        last_updated: user.consent_timestamp
      },
      data_categories_processed: [
        'Personal identification (name, email)',
        'Contact information (phone, timezone)',
        'Account preferences and settings',
        'Booking and availability data',
        'Communication preferences',
        'Usage analytics and audit logs'
      ],
      legal_basis: [
        'Consent (for marketing communications)',
        'Contract performance (for service delivery)',
        'Legitimate interest (for service improvement)'
      ],
      data_retention: {
        active_account: 'Data retained while account is active',
        deleted_account: 'Personal data deleted within 30 days of account deletion',
        audit_logs: 'Audit logs retained for 7 years for compliance purposes'
      },
      your_rights: [
        'Right to access your personal data',
        'Right to rectify inaccurate data',
        'Right to erase your data',
        'Right to restrict processing',
        'Right to data portability',
        'Right to object to processing',
        'Right to withdraw consent'
      ],
      gdpr_requests_history: gdprHistory
    };

    return successResponse(res, {
      data_processing_agreement: agreement
    }, 'Data processing agreement retrieved successfully');
  } catch (error) {
    logger.error('Error retrieving data processing agreement:', error);
    throw error;
  }
});

/**
 * Get privacy settings and communication preferences
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPrivacySettings = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      include: [{
        model: UserSettings,
        as: 'settings',
        attributes: [
          'email_notifications', 'sms_notifications', 'push_notifications',
          'notification_booking_confirmed', 'notification_booking_cancelled',
          'notification_booking_reminder', 'notification_new_booking'
        ]
      }],
      attributes: ['id', 'email', 'marketing_consent', 'data_processing_consent', 'consent_timestamp']
    });

    if (!user) {
      throw notFoundError('User not found');
    }

    const privacySettings = {
      user_id: userId,
      consent_preferences: {
        marketing_consent: user.marketing_consent,
        data_processing_consent: user.data_processing_consent,
        last_updated: user.consent_timestamp
      },
      communication_preferences: user.settings ? {
        email_notifications: user.settings.email_notifications,
        sms_notifications: user.settings.sms_notifications,
        push_notifications: user.settings.push_notifications,
        booking_confirmations: user.settings.notification_booking_confirmed,
        booking_cancellations: user.settings.notification_booking_cancelled,
        booking_reminders: user.settings.notification_booking_reminder,
        new_booking_alerts: user.settings.notification_new_booking
      } : null,
      data_sharing: {
        analytics: 'Anonymous usage data for service improvement',
        third_parties: 'No personal data shared with third parties without consent',
        calendar_integrations: 'Calendar data shared only with authorized calendar providers'
      }
    };

    return successResponse(res, {
      privacy_settings: privacySettings
    }, 'Privacy settings retrieved successfully');
  } catch (error) {
    logger.error('Error retrieving privacy settings:', error);
    throw error;
  }
});

/**
 * Update privacy settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updatePrivacySettings = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const {
      marketing_consent,
      email_notifications,
      sms_notifications,
      push_notifications,
      notification_booking_confirmed,
      notification_booking_cancelled,
      notification_booking_reminder,
      notification_new_booking
    } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User not found');
    }

    const updates = {};
    const settingsUpdates = {};

    // Update consent preferences
    if (typeof marketing_consent === 'boolean') {
      updates.marketing_consent = marketing_consent;
      updates.consent_timestamp = new Date();
    }

    // Update notification preferences
    if (typeof email_notifications === 'boolean') settingsUpdates.email_notifications = email_notifications;
    if (typeof sms_notifications === 'boolean') settingsUpdates.sms_notifications = sms_notifications;
    if (typeof push_notifications === 'boolean') settingsUpdates.push_notifications = push_notifications;
    if (typeof notification_booking_confirmed === 'boolean') settingsUpdates.notification_booking_confirmed = notification_booking_confirmed;
    if (typeof notification_booking_cancelled === 'boolean') settingsUpdates.notification_booking_cancelled = notification_booking_cancelled;
    if (typeof notification_booking_reminder === 'boolean') settingsUpdates.notification_booking_reminder = notification_booking_reminder;
    if (typeof notification_new_booking === 'boolean') settingsUpdates.notification_new_booking = notification_new_booking;

    // Update user consent if needed
    if (Object.keys(updates).length > 0) {
      await User.update(updates, { where: { id: userId }, transaction });
    }

    // Update user settings if needed
    if (Object.keys(settingsUpdates).length > 0) {
      await UserSettings.update(settingsUpdates, { where: { user_id: userId }, transaction });
    }

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'gdpr.privacy_settings_updated',
      metadata: {
        consent_changes: Object.keys(updates),
        settings_changes: Object.keys(settingsUpdates)
      }
    }, { transaction });

    await transaction.commit();

    logger.info(`Privacy settings updated for user ${userId}`);

    return successResponse(res, {
      updated: true,
      consent_changes: Object.keys(updates),
      settings_changes: Object.keys(settingsUpdates)
    }, 'Privacy settings updated successfully');
  } catch (error) {
    await transaction.rollback();
    logger.error('Error updating privacy settings:', error);
    throw error;
  }
});

/**
 * Get GDPR request status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRequestStatus = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { request_id } = req.params;

    let whereClause = { user_id: userId };
    if (request_id) {
      whereClause.id = request_id;
    }

    const requests = await GdprRequest.findAll({
      where: whereClause,
      attributes: ['id', 'request_type', 'status', 'requested_at', 'scheduled_for', 'completed_at'],
      order: [['requested_at', 'DESC']]
    });

    return successResponse(res, {
      gdpr_requests: requests
    }, 'GDPR request status retrieved successfully');
  } catch (error) {
    logger.error('Error retrieving GDPR request status:', error);
    throw error;
  }
});

module.exports = {
  exportData,
  deleteAccount,
  cancelDeletion,
  manageConsent,
  getDataProcessingAgreement,
  getPrivacySettings,
  updatePrivacySettings,
  getRequestStatus
};