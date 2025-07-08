/**
 * GDPR Service
 * 
 * Handles GDPR compliance operations including data export,
 * deletion, consent management, and data subject rights
 */

const logger = require('../config/logger');
const { AppError } = require('../utils/errors');
const { User, Booking, AuditLog } = require('../models');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { Parser } = require('json2csv');

class GDPRService {
  /**
   * Create a GDPR request
   * @param {Object} user - User object
   * @param {string} requestType - Type of GDPR request
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} GDPR request object
   */
  async createGDPRRequest(user, requestType, options = {}) {
    try {
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      const gdprRequest = await sequelize.query(
        `INSERT INTO gdpr_requests 
         (user_id, request_type, status, verification_token, ip_address, user_agent, notes, metadata, created, updated)
         VALUES (:userId, :requestType, 'pending', :verificationToken, :ipAddress, :userAgent, :notes, :metadata, NOW(), NOW())`,
        {
          replacements: {
            userId: user.id,
            requestType,
            verificationToken,
            ipAddress: options.ipAddress || null,
            userAgent: options.userAgent || null,
            notes: options.notes || null,
            metadata: JSON.stringify(options.metadata || {})
          },
          type: QueryTypes.INSERT
        }
      );

      // Log the request
      await AuditLog.create({
        user_id: user.id,
        action: `gdpr_request_${requestType}`,
        table_name: 'gdpr_requests',
        record_id: gdprRequest[0],
        metadata: {
          request_type: requestType,
          ip_address: options.ipAddress,
          user_agent: options.userAgent
        }
      });

      // TODO: Send verification email
      logger.info(`GDPR ${requestType} request created for user ${user.id}`);

      return {
        id: gdprRequest[0],
        verificationToken,
        requestType,
        status: 'pending'
      };
    } catch (error) {
      logger.error('Failed to create GDPR request:', error);
      throw new AppError('Failed to create GDPR request', 500);
    }
  }

  /**
   * Verify GDPR request via email token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Verified request object
   */
  async verifyGDPRRequest(token) {
    try {
      const [request] = await sequelize.query(
        `SELECT id, user_id, request_type, status 
         FROM gdpr_requests 
         WHERE verification_token = :token 
         AND status = 'pending' 
         AND created > DATE_SUB(NOW(), INTERVAL 72 HOUR)`,
        {
          replacements: { token },
          type: QueryTypes.SELECT
        }
      );

      if (!request) {
        throw new AppError('Invalid or expired verification token', 400);
      }

      // Update request as verified
      await sequelize.query(
        `UPDATE gdpr_requests 
         SET status = 'processing', verified_at = NOW(), updated = NOW()
         WHERE id = :requestId`,
        {
          replacements: { requestId: request.id },
          type: QueryTypes.UPDATE
        }
      );

      // Process the request based on type
      await this.processGDPRRequest(request);

      return request;
    } catch (error) {
      logger.error('Failed to verify GDPR request:', error);
      throw error;
    }
  }

  /**
   * Process verified GDPR request
   * @param {Object} request - GDPR request object
   * @returns {Promise<void>}
   */
  async processGDPRRequest(request) {
    try {
      logger.info(`Processing GDPR ${request.request_type} request ${request.id}`);

      switch (request.request_type) {
        case 'data_export':
          await this.processDataExport(request);
          break;
        case 'data_deletion':
          await this.processDataDeletion(request);
          break;
        case 'data_rectification':
          await this.processDataRectification(request);
          break;
        case 'consent_withdrawal':
          await this.processConsentWithdrawal(request);
          break;
        case 'data_portability':
          await this.processDataPortability(request);
          break;
        case 'processing_restriction':
          await this.processProcessingRestriction(request);
          break;
        default:
          throw new AppError(`Unknown GDPR request type: ${request.request_type}`, 400);
      }

      // Mark as completed
      await sequelize.query(
        `UPDATE gdpr_requests 
         SET status = 'completed', completed_at = NOW(), updated = NOW()
         WHERE id = :requestId`,
        {
          replacements: { requestId: request.id },
          type: QueryTypes.UPDATE
        }
      );

      logger.info(`Completed GDPR ${request.request_type} request ${request.id}`);
    } catch (error) {
      // Mark as failed
      await sequelize.query(
        `UPDATE gdpr_requests 
         SET status = 'failed', updated = NOW()
         WHERE id = :requestId`,
        {
          replacements: { requestId: request.id },
          type: QueryTypes.UPDATE
        }
      );

      logger.error('Failed to process GDPR request:', error);
      throw error;
    }
  }

  /**
   * Process data export request
   * @param {Object} request - GDPR request object
   * @returns {Promise<void>}
   */
  async processDataExport(request) {
    const user = await User.findByPk(request.user_id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Collect all user data
    const userData = await this.collectUserData(user);

    // Generate export file
    const exportFormat = 'json'; // Could be configurable
    const { filePath, downloadUrl } = await this.generateExportFile(userData, exportFormat, request.id);

    // Set expiration (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Update request with download URL
    await sequelize.query(
      `UPDATE gdpr_requests 
       SET export_url = :exportUrl, export_format = :exportFormat, expires_at = :expiresAt, updated = NOW()
       WHERE id = :requestId`,
      {
        replacements: {
          requestId: request.id,
          exportUrl: downloadUrl,
          exportFormat,
          expiresAt
        },
        type: QueryTypes.UPDATE
      }
    );

    // TODO: Send download link email
    logger.info(`Data export completed for user ${user.id}, available until ${expiresAt}`);
  }

  /**
   * Process data deletion request with grace period
   * @param {Object} request - GDPR request object
   * @returns {Promise<void>}
   */
  async processDataDeletion(request) {
    const user = await User.findByPk(request.user_id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Set deletion grace period (30 days)
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    await sequelize.query(
      `UPDATE gdpr_requests 
       SET deletion_scheduled_at = :deletionDate, updated = NOW()
       WHERE id = :requestId`,
      {
        replacements: {
          requestId: request.id,
          deletionDate
        },
        type: QueryTypes.UPDATE
      }
    );

    // TODO: Send grace period notification email
    logger.info(`Account deletion scheduled for user ${user.id} on ${deletionDate}`);
  }

  /**
   * Execute scheduled account deletions
   * @returns {Promise<Object>} Deletion results
   */
  async executeScheduledDeletions() {
    try {
      const scheduledDeletions = await sequelize.query(
        `SELECT id, user_id, deletion_scheduled_at 
         FROM gdpr_requests 
         WHERE request_type = 'data_deletion' 
         AND status = 'completed'
         AND deletion_scheduled_at <= NOW()
         AND deletion_scheduled_at IS NOT NULL`,
        { type: QueryTypes.SELECT }
      );

      const results = {
        processed: 0,
        errors: 0,
        deleted_users: []
      };

      for (const deletion of scheduledDeletions) {
        try {
          await this.executeUserDeletion(deletion.user_id);
          results.processed++;
          results.deleted_users.push(deletion.user_id);

          // Update deletion request
          await sequelize.query(
            `UPDATE gdpr_requests 
             SET deletion_scheduled_at = NULL, notes = 'Account deleted', updated = NOW()
             WHERE id = :requestId`,
            {
              replacements: { requestId: deletion.id },
              type: QueryTypes.UPDATE
            }
          );
        } catch (error) {
          logger.error(`Failed to delete user ${deletion.user_id}:`, error);
          results.errors++;
        }
      }

      logger.info(`Executed ${results.processed} scheduled deletions with ${results.errors} errors`);
      return results;
    } catch (error) {
      logger.error('Failed to execute scheduled deletions:', error);
      throw new AppError('Failed to execute scheduled deletions', 500);
    }
  }

  /**
   * Execute user deletion (anonymization)
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  async executeUserDeletion(userId) {
    const transaction = await sequelize.transaction();

    try {
      // Instead of hard delete, anonymize data
      const anonymizedEmail = `deleted-${userId}-${Date.now()}@anonymized.local`;
      
      await User.update(
        {
          email: anonymizedEmail,
          first_name: 'Deleted',
          last_name: 'User',
          phone: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          is_active: false,
          email_verified: false,
          password_hash: null
        },
        {
          where: { id: userId },
          transaction
        }
      );

      // Anonymize bookings
      await sequelize.query(
        `UPDATE bookings 
         SET attendee_email = :anonymizedEmail, attendee_name = 'Deleted User'
         WHERE attendee_id = :userId`,
        {
          replacements: { userId, anonymizedEmail },
          transaction,
          type: QueryTypes.UPDATE
        }
      );

      // Log the deletion
      await AuditLog.create({
        user_id: userId,
        action: 'gdpr_account_deleted',
        table_name: 'users',
        record_id: userId,
        metadata: {
          deletion_type: 'anonymization',
          timestamp: new Date()
        }
      }, { transaction });

      await transaction.commit();
      logger.info(`User ${userId} data anonymized successfully`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Cancel scheduled deletion
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  async cancelScheduledDeletion(userId) {
    try {
      await sequelize.query(
        `UPDATE gdpr_requests 
         SET deletion_scheduled_at = NULL, 
             cancellation_reason = 'Cancelled by user',
             notes = 'Deletion cancelled',
             updated = NOW()
         WHERE user_id = :userId 
         AND request_type = 'data_deletion' 
         AND status = 'completed'
         AND deletion_scheduled_at > NOW()`,
        {
          replacements: { userId },
          type: QueryTypes.UPDATE
        }
      );

      logger.info(`Cancelled scheduled deletion for user ${userId}`);
    } catch (error) {
      logger.error('Failed to cancel scheduled deletion:', error);
      throw new AppError('Failed to cancel deletion', 500);
    }
  }

  /**
   * Collect all user data for export
   * @param {Object} user - User object
   * @returns {Promise<Object>} Complete user data
   */
  async collectUserData(user) {
    try {
      // Get user data
      const userData = user.toJSON();
      delete userData.password_hash; // Never export password
      delete userData.email_verification_token; // Remove sensitive tokens
      delete userData.password_reset_token;

      // Get related data with comprehensive collection
      const [
        userSettings,
        bookings,
        availabilityRules,
        calendarTokens,
        notifications,
        auditLogs,
        billingHistory,
        usageRecords,
        gdprRequests
      ] = await Promise.all([
        // User settings
        sequelize.query(
          `SELECT * FROM user_settings WHERE user_id = :userId`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        ),
        // Bookings (as host or attendee)
        sequelize.query(
          `SELECT * FROM bookings WHERE host_id = :userId OR attendee_id = :userId`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        ),
        // Availability rules
        sequelize.query(
          `SELECT * FROM availability_rules WHERE user_id = :userId`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        ),
        // Calendar tokens (remove sensitive data)
        sequelize.query(
          `SELECT provider, email, calendar_id, is_primary, created, updated, expires_at
           FROM calendar_tokens WHERE user_id = :userId`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        ),
        // Notifications
        sequelize.query(
          `SELECT * FROM notifications WHERE user_id = :userId ORDER BY created DESC LIMIT 500`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        ),
        // Audit logs (limited to recent entries)
        sequelize.query(
          `SELECT action, table_name, record_id, metadata, created 
           FROM audit_logs WHERE user_id = :userId ORDER BY created DESC LIMIT 1000`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        ),
        // Billing history
        sequelize.query(
          `SELECT * FROM billing_history WHERE user_id = :userId`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        ),
        // Usage records
        sequelize.query(
          `SELECT metric_name, quantity, timestamp, metadata FROM usage_records 
           WHERE user_id = :userId ORDER BY timestamp DESC LIMIT 1000`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        ),
        // GDPR requests history
        sequelize.query(
          `SELECT request_type, status, requested_at, completed_at, metadata 
           FROM gdpr_requests WHERE user_id = :userId`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        )
      ]);

      return {
        personal_data: {
          user_account: userData,
          user_settings: userSettings[0] || null,
          consent_history: {
            marketing_consent: userData.marketing_consent,
            data_processing_consent: userData.data_processing_consent,
            consent_timestamp: userData.consent_timestamp
          }
        },
        booking_data: {
          bookings,
          availability_rules: availabilityRules
        },
        integration_data: {
          calendar_integrations: calendarTokens
        },
        communication_data: {
          notifications: notifications.map(n => ({
            ...n,
            // Remove sensitive data if any
            email_content: n.email_content ? '[EMAIL_CONTENT_REDACTED]' : null
          }))
        },
        billing_data: {
          stripe_customer_id: userData.stripe_customer_id,
          subscription_id: userData.stripe_subscription_id,
          subscription_status: userData.stripe_subscription_status,
          billing_history: billingHistory,
          usage_records: usageRecords
        },
        system_data: {
          audit_logs: auditLogs,
          gdpr_requests: gdprRequests
        },
        export_metadata: {
          export_date: new Date(),
          data_subject: user.email,
          export_reason: 'GDPR Article 20 - Right to Data Portability',
          data_categories: [
            'Personal identification data',
            'Account preferences and settings',
            'Booking and calendar data',
            'Communication records',
            'Billing and subscription data',
            'System logs and GDPR requests'
          ],
          retention_info: {
            active_account: 'Data retained while account is active',
            deleted_account: 'Personal data deleted within 30 days',
            audit_logs: 'System logs retained for 7 years for compliance'
          }
        }
      };
    } catch (error) {
      logger.error('Failed to collect user data:', error);
      throw new AppError('Failed to collect user data', 500);
    }
  }

  /**
   * Generate export file
   * @param {Object} data - User data to export
   * @param {string} format - Export format (json, csv)
   * @param {number} requestId - GDPR request ID
   * @returns {Promise<Object>} File path and download URL
   */
  async generateExportFile(data, format, requestId) {
    try {
      const exportDir = path.join(process.cwd(), 'exports');
      await fs.mkdir(exportDir, { recursive: true });

      const filename = `gdpr-export-${requestId}-${Date.now()}.${format}`;
      const filePath = path.join(exportDir, filename);

      let content;
      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
      } else if (format === 'csv') {
        // Flatten data for CSV
        const flatData = this.flattenDataForCSV(data);
        const parser = new Parser();
        content = parser.parse(flatData);
      } else {
        throw new AppError('Unsupported export format', 400);
      }

      await fs.writeFile(filePath, content, 'utf8');

      // Generate secure download URL (would typically use signed URLs in production)
      const downloadUrl = `/api/gdpr/download/${filename}`;

      logger.info(`Generated export file: ${filename}`);
      return { filePath, downloadUrl };
    } catch (error) {
      logger.error('Failed to generate export file:', error);
      throw new AppError('Failed to generate export file', 500);
    }
  }

  /**
   * Flatten nested data structure for CSV export
   * @param {Object} data - Data to flatten
   * @returns {Array} Flattened data array
   */
  flattenDataForCSV(data) {
    const flattened = [];
    
    // Add user data
    if (data.personal_data?.user_account) {
      flattened.push({
        data_type: 'user_account',
        category: 'personal_data',
        ...data.personal_data.user_account
      });
    }

    // Add user settings
    if (data.personal_data?.user_settings) {
      flattened.push({
        data_type: 'user_settings',
        category: 'personal_data',
        ...data.personal_data.user_settings
      });
    }

    // Add bookings
    if (data.booking_data?.bookings) {
      data.booking_data.bookings.forEach(booking => {
        flattened.push({
          data_type: 'booking',
          category: 'booking_data',
          ...booking
        });
      });
    }

    // Add availability rules
    if (data.booking_data?.availability_rules) {
      data.booking_data.availability_rules.forEach(rule => {
        flattened.push({
          data_type: 'availability_rule',
          category: 'booking_data',
          ...rule
        });
      });
    }

    // Add calendar integrations
    if (data.integration_data?.calendar_integrations) {
      data.integration_data.calendar_integrations.forEach(integration => {
        flattened.push({
          data_type: 'calendar_integration',
          category: 'integration_data',
          ...integration
        });
      });
    }

    // Add notifications (limited data for CSV)
    if (data.communication_data?.notifications) {
      data.communication_data.notifications.forEach(notification => {
        flattened.push({
          data_type: 'notification',
          category: 'communication_data',
          id: notification.id,
          type: notification.type,
          status: notification.status,
          created: notification.created,
          sent_at: notification.sent_at
        });
      });
    }

    // Add billing history
    if (data.billing_data?.billing_history) {
      data.billing_data.billing_history.forEach(bill => {
        flattened.push({
          data_type: 'billing_record',
          category: 'billing_data',
          ...bill
        });
      });
    }

    // Add usage records
    if (data.billing_data?.usage_records) {
      data.billing_data.usage_records.forEach(usage => {
        flattened.push({
          data_type: 'usage_record',
          category: 'billing_data',
          ...usage
        });
      });
    }

    // Add audit logs (limited for CSV)
    if (data.system_data?.audit_logs) {
      data.system_data.audit_logs.forEach(log => {
        flattened.push({
          data_type: 'audit_log',
          category: 'system_data',
          action: log.action,
          table_name: log.table_name,
          record_id: log.record_id,
          created: log.created
        });
      });
    }

    // Add GDPR requests
    if (data.system_data?.gdpr_requests) {
      data.system_data.gdpr_requests.forEach(request => {
        flattened.push({
          data_type: 'gdpr_request',
          category: 'system_data',
          ...request
        });
      });
    }

    return flattened;
  }

  /**
   * Update user consent preferences
   * @param {Object} user - User object
   * @param {Object} consents - Consent preferences
   * @returns {Promise<Object>} Updated user
   */
  async updateConsentPreferences(user, consents) {
    try {
      const updates = {
        marketing_consent: consents.marketing || false,
        data_processing_consent: consents.dataProcessing !== false, // Required for service
        consent_timestamp: new Date()
      };

      await user.update(updates);

      // Log consent changes
      await AuditLog.create({
        user_id: user.id,
        action: 'consent_updated',
        table_name: 'users',
        record_id: user.id,
        metadata: {
          previous_consents: {
            marketing: user.marketing_consent,
            data_processing: user.data_processing_consent
          },
          new_consents: consents,
          timestamp: new Date()
        }
      });

      logger.info(`Updated consent preferences for user ${user.id}`);
      return user.reload();
    } catch (error) {
      logger.error('Failed to update consent preferences:', error);
      throw new AppError('Failed to update consent preferences', 500);
    }
  }

  /**
   * Process consent withdrawal
   * @param {Object} request - GDPR request object
   * @returns {Promise<void>}
   */
  async processConsentWithdrawal(request) {
    const user = await User.findByPk(request.user_id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Withdraw marketing consent but keep data processing for service functionality
    await this.updateConsentPreferences(user, {
      marketing: false,
      dataProcessing: true // Can't withdraw this and keep using the service
    });

    logger.info(`Processed consent withdrawal for user ${user.id}`);
  }

  /**
   * Process data rectification request
   * @param {Object} request - GDPR request object
   * @returns {Promise<void>}
   */
  async processDataRectification(request) {
    // This would typically involve manual review
    // Mark as completed to indicate manual processing required
    logger.info(`Data rectification request ${request.id} requires manual review`);
  }

  /**
   * Process data portability request
   * @param {Object} request - GDPR request object
   * @returns {Promise<void>}
   */
  async processDataPortability(request) {
    // Same as data export but with specific structured format
    await this.processDataExport(request);
    logger.info(`Data portability request ${request.id} processed`);
  }

  /**
   * Process processing restriction request
   * @param {Object} request - GDPR request object
   * @returns {Promise<void>}
   */
  async processProcessingRestriction(request) {
    const user = await User.findByPk(request.user_id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Mark account as restricted (implement restriction logic as needed)
    await user.update({
      is_active: false // Or add a specific restriction field
    });

    logger.info(`Processing restriction applied for user ${user.id}`);
  }

  /**
   * Export user data for GDPR compliance
   * @param {string} userId - User ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Exported user data
   */
  async exportUserData(userId, options = {}) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Collect all user data
      const userData = await this.collectUserData(user);
      
      // Convert to requested format
      if (options.format === 'csv') {
        return this.convertToCSV(userData);
      }
      
      return userData;
    } catch (error) {
      logger.error('Failed to export user data:', error);
      throw new AppError('Failed to export user data', 500);
    }
  }

  /**
   * Delete user data with optional grace period
   * @param {string} userId - User ID
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteUserData(userId, options = {}) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Execute the deletion (anonymization)
      await this.executeUserDeletion(userId);

      return {
        user_id: userId,
        deleted_at: new Date(),
        deletion_type: 'anonymization',
        reason: options.reason || 'User requested deletion',
        gdpr_request_id: options.gdpr_request_id
      };
    } catch (error) {
      logger.error('Failed to delete user data:', error);
      throw new AppError('Failed to delete user data', 500);
    }
  }

  /**
   * Convert user data to CSV format
   * @param {Object} userData - User data object
   * @returns {string} CSV formatted data
   */
  convertToCSV(userData) {
    try {
      const flatData = this.flattenDataForCSV(userData);
      const parser = new Parser();
      return parser.parse(flatData);
    } catch (error) {
      logger.error('Failed to convert data to CSV:', error);
      throw new AppError('Failed to convert data to CSV', 500);
    }
  }

  /**
   * Get GDPR request status
   * @param {number} requestId - GDPR request ID
   * @param {number} userId - User ID (for authorization)
   * @returns {Promise<Object>} Request status
   */
  async getRequestStatus(requestId, userId) {
    try {
      const [request] = await sequelize.query(
        `SELECT id, request_type, status, created, verified_at, completed_at, 
                deletion_scheduled_at, export_url, expires_at
         FROM gdpr_requests 
         WHERE id = :requestId AND user_id = :userId`,
        {
          replacements: { requestId, userId },
          type: QueryTypes.SELECT
        }
      );

      if (!request) {
        throw new AppError('GDPR request not found', 404);
      }

      return request;
    } catch (error) {
      logger.error('Failed to get GDPR request status:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new GDPRService();