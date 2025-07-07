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

      // Get related data
      const [bookings, auditLogs, billingHistory] = await Promise.all([
        // Bookings
        sequelize.query(
          `SELECT * FROM bookings WHERE host_id = :userId OR attendee_id = :userId`,
          {
            replacements: { userId: user.id },
            type: QueryTypes.SELECT
          }
        ),
        // Audit logs
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
        )
      ]);

      return {
        user: userData,
        bookings,
        auditLogs,
        billingHistory,
        exportMetadata: {
          exportDate: new Date(),
          dataSubject: user.email,
          exportReason: 'GDPR Article 20 - Right to Data Portability'
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
    flattened.push({
      type: 'user',
      ...data.user
    });

    // Add bookings
    data.bookings.forEach(booking => {
      flattened.push({
        type: 'booking',
        ...booking
      });
    });

    // Add billing history
    data.billingHistory.forEach(bill => {
      flattened.push({
        type: 'billing',
        ...bill
      });
    });

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