/**
 * Data Retention Service
 * 
 * Handles automatic data retention policies for GDPR compliance
 * Manages cleanup of old data according to defined retention periods
 * 
 * @author meetabl Team
 */

const logger = require('../config/logger');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { AuditLog } = require('../models');

class DataRetentionService {
  constructor() {
    // Data retention periods (in days)
    this.retentionPolicies = {
      // User data
      deleted_users: 30,           // Anonymized user data kept for 30 days
      email_verification_tokens: 7, // Email verification tokens expire after 7 days
      password_reset_tokens: 1,    // Password reset tokens expire after 1 day
      
      // Session and security data
      jwt_blacklist: 30,           // Blacklisted JWTs cleaned after 30 days
      session_data: 30,            // Old session data cleaned after 30 days
      
      // Audit and logging data
      audit_logs: 2555,            // Audit logs kept for 7 years (GDPR requirement)
      notification_logs: 365,      // Notification logs kept for 1 year
      
      // GDPR and compliance data
      gdpr_export_files: 30,       // Export files available for 30 days
      gdpr_completed_requests: 365, // Completed GDPR requests kept for 1 year
      
      // Billing and usage data
      billing_history: 2555,       // Billing records kept for 7 years (tax requirement)
      usage_records: 365,          // Usage records kept for 1 year
      
      // Booking data (completed bookings)
      completed_bookings: 1095,    // Completed bookings kept for 3 years
      cancelled_bookings: 365,     // Cancelled bookings kept for 1 year
      
      // Temporary files and exports
      temp_files: 7,               // Temporary files cleaned after 7 days
      log_files: 90               // Application log files kept for 90 days
    };
  }

  /**
   * Execute all data retention policies
   * @returns {Promise<Object>} Cleanup results
   */
  async executeRetentionPolicies() {
    try {
      logger.info('Starting data retention policy execution');
      
      const results = {
        total_cleaned: 0,
        policies_executed: 0,
        errors: 0,
        details: {}
      };

      // Execute each retention policy
      for (const [policyName, retentionDays] of Object.entries(this.retentionPolicies)) {
        try {
          const policyResult = await this.executePolicyByName(policyName, retentionDays);
          results.details[policyName] = policyResult;
          results.total_cleaned += policyResult.cleaned_count;
          results.policies_executed++;
        } catch (error) {
          logger.error(`Failed to execute retention policy ${policyName}:`, error);
          results.errors++;
          results.details[policyName] = { error: error.message, cleaned_count: 0 };
        }
      }

      // Log the retention execution
      await AuditLog.create({
        id: uuidv4(),
        user_id: null, // System operation
        action: 'data_retention.policies_executed',
        metadata: {
          total_cleaned: results.total_cleaned,
          policies_executed: results.policies_executed,
          errors: results.errors,
          execution_date: new Date()
        }
      });

      logger.info(`Data retention policies completed. Cleaned ${results.total_cleaned} records across ${results.policies_executed} policies`);
      return results;
    } catch (error) {
      logger.error('Failed to execute data retention policies:', error);
      throw error;
    }
  }

  /**
   * Execute a specific retention policy by name
   * @param {string} policyName - Name of the policy
   * @param {number} retentionDays - Number of days to retain data
   * @returns {Promise<Object>} Policy execution result
   */
  async executePolicyByName(policyName, retentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    switch (policyName) {
      case 'deleted_users':
        return await this.cleanDeletedUsers(cutoffDate);
      case 'email_verification_tokens':
        return await this.cleanExpiredTokens('email_verification', cutoffDate);
      case 'password_reset_tokens':
        return await this.cleanExpiredTokens('password_reset', cutoffDate);
      case 'jwt_blacklist':
        return await this.cleanJwtBlacklist(cutoffDate);
      case 'session_data':
        return await this.cleanSessionData(cutoffDate);
      case 'audit_logs':
        return await this.cleanAuditLogs(cutoffDate);
      case 'notification_logs':
        return await this.cleanNotificationLogs(cutoffDate);
      case 'gdpr_export_files':
        return await this.cleanGdprExportFiles(cutoffDate);
      case 'gdpr_completed_requests':
        return await this.cleanCompletedGdprRequests(cutoffDate);
      case 'billing_history':
        return await this.cleanBillingHistory(cutoffDate);
      case 'usage_records':
        return await this.cleanUsageRecords(cutoffDate);
      case 'completed_bookings':
        return await this.cleanCompletedBookings(cutoffDate);
      case 'cancelled_bookings':
        return await this.cleanCancelledBookings(cutoffDate);
      case 'temp_files':
        return await this.cleanTempFiles(cutoffDate);
      case 'log_files':
        return await this.cleanLogFiles(cutoffDate);
      default:
        throw new Error(`Unknown retention policy: ${policyName}`);
    }
  }

  /**
   * Clean deleted (anonymized) users after grace period
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanDeletedUsers(cutoffDate) {
    const result = await sequelize.query(`
      DELETE FROM users 
      WHERE email LIKE 'deleted-%@anonymized.local' 
      AND updated < :cutoffDate
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.DELETE
    });

    return { cleaned_count: result[1] || 0, policy: 'deleted_users' };
  }

  /**
   * Clean expired email verification and password reset tokens
   * @param {string} tokenType - Type of token (email_verification or password_reset)
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanExpiredTokens(tokenType, cutoffDate) {
    let query, field;
    
    if (tokenType === 'email_verification') {
      field = 'email_verification_token';
      query = `
        UPDATE users 
        SET email_verification_token = NULL, email_verification_expires = NULL
        WHERE email_verification_token IS NOT NULL 
        AND (email_verification_expires < :cutoffDate OR email_verification_expires < NOW())
      `;
    } else if (tokenType === 'password_reset') {
      field = 'password_reset_token';
      query = `
        UPDATE users 
        SET password_reset_token = NULL, password_reset_expires = NULL
        WHERE password_reset_token IS NOT NULL 
        AND (password_reset_expires < :cutoffDate OR password_reset_expires < NOW())
      `;
    }

    const result = await sequelize.query(query, {
      replacements: { cutoffDate },
      type: QueryTypes.UPDATE
    });

    return { cleaned_count: result[1] || 0, policy: `${tokenType}_tokens` };
  }

  /**
   * Clean expired JWT blacklist entries
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanJwtBlacklist(cutoffDate) {
    const result = await sequelize.query(`
      DELETE FROM jwt_blacklist 
      WHERE expires_at < :cutoffDate OR expires_at < NOW()
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.DELETE
    });

    return { cleaned_count: result[1] || 0, policy: 'jwt_blacklist' };
  }

  /**
   * Clean old session data
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanSessionData(cutoffDate) {
    // This would depend on your session storage implementation
    // For Redis-based sessions, you might need to use Redis commands
    // For database sessions, clean expired session records
    
    try {
      const result = await sequelize.query(`
        DELETE FROM sessions 
        WHERE expires < :cutoffDate OR expires < NOW()
      `, {
        replacements: { cutoffDate },
        type: QueryTypes.DELETE
      });

      return { cleaned_count: result[1] || 0, policy: 'session_data' };
    } catch (error) {
      // If sessions table doesn't exist, skip silently
      if (error.message.includes('Table') && error.message.includes('doesn\'t exist')) {
        return { cleaned_count: 0, policy: 'session_data', note: 'Sessions table not found' };
      }
      throw error;
    }
  }

  /**
   * Clean old audit logs (beyond retention period)
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanAuditLogs(cutoffDate) {
    const result = await sequelize.query(`
      DELETE FROM audit_logs 
      WHERE created < :cutoffDate
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.DELETE
    });

    return { cleaned_count: result[1] || 0, policy: 'audit_logs' };
  }

  /**
   * Clean old notification logs
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanNotificationLogs(cutoffDate) {
    const result = await sequelize.query(`
      DELETE FROM notifications 
      WHERE created < :cutoffDate 
      AND status IN ('sent', 'failed', 'cancelled')
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.DELETE
    });

    return { cleaned_count: result[1] || 0, policy: 'notification_logs' };
  }

  /**
   * Clean expired GDPR export files and URLs
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanGdprExportFiles(cutoffDate) {
    const result = await sequelize.query(`
      UPDATE gdpr_requests 
      SET export_url = NULL 
      WHERE export_url IS NOT NULL 
      AND (expires_at < :cutoffDate OR expires_at < NOW())
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.UPDATE
    });

    return { cleaned_count: result[1] || 0, policy: 'gdpr_export_files' };
  }

  /**
   * Clean old completed GDPR requests
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanCompletedGdprRequests(cutoffDate) {
    const result = await sequelize.query(`
      DELETE FROM gdpr_requests 
      WHERE status = 'completed' 
      AND completed_at < :cutoffDate
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.DELETE
    });

    return { cleaned_count: result[1] || 0, policy: 'gdpr_completed_requests' };
  }

  /**
   * Clean old billing history (keeping required records for tax purposes)
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanBillingHistory(cutoffDate) {
    // For billing history, we're very conservative due to legal requirements
    // Only clean records that are clearly temporary or test data
    const result = await sequelize.query(`
      DELETE FROM billing_history 
      WHERE created < :cutoffDate 
      AND (
        invoice_status = 'draft' 
        OR invoice_status = 'void'
        OR amount_total = 0
      )
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.DELETE
    });

    return { cleaned_count: result[1] || 0, policy: 'billing_history' };
  }

  /**
   * Clean old usage records
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanUsageRecords(cutoffDate) {
    const result = await sequelize.query(`
      DELETE FROM usage_records 
      WHERE timestamp < :cutoffDate 
      AND reported_at IS NOT NULL
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.DELETE
    });

    return { cleaned_count: result[1] || 0, policy: 'usage_records' };
  }

  /**
   * Clean old completed bookings
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanCompletedBookings(cutoffDate) {
    const result = await sequelize.query(`
      DELETE FROM bookings 
      WHERE status = 'completed' 
      AND end_time < :cutoffDate
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.DELETE
    });

    return { cleaned_count: result[1] || 0, policy: 'completed_bookings' };
  }

  /**
   * Clean old cancelled bookings
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanCancelledBookings(cutoffDate) {
    const result = await sequelize.query(`
      DELETE FROM bookings 
      WHERE status = 'cancelled' 
      AND updated < :cutoffDate
    `, {
      replacements: { cutoffDate },
      type: QueryTypes.DELETE
    });

    return { cleaned_count: result[1] || 0, policy: 'cancelled_bookings' };
  }

  /**
   * Clean temporary files (placeholder - would need filesystem integration)
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanTempFiles(cutoffDate) {
    // This would require filesystem operations to clean actual temp files
    // For now, return a placeholder result
    return { cleaned_count: 0, policy: 'temp_files', note: 'Filesystem cleanup not implemented' };
  }

  /**
   * Clean old log files (placeholder - would need log management integration)
   * @param {Date} cutoffDate - Date before which to clean data
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanLogFiles(cutoffDate) {
    // This would require log management system integration
    // For now, return a placeholder result
    return { cleaned_count: 0, policy: 'log_files', note: 'Log file cleanup not implemented' };
  }

  /**
   * Get current retention policy configuration
   * @returns {Object} Retention policies
   */
  getRetentionPolicies() {
    return { ...this.retentionPolicies };
  }

  /**
   * Update a retention policy
   * @param {string} policyName - Name of the policy
   * @param {number} retentionDays - New retention period in days
   * @returns {boolean} Success status
   */
  updateRetentionPolicy(policyName, retentionDays) {
    if (this.retentionPolicies.hasOwnProperty(policyName)) {
      this.retentionPolicies[policyName] = retentionDays;
      logger.info(`Updated retention policy ${policyName} to ${retentionDays} days`);
      return true;
    }
    return false;
  }

  /**
   * Execute a single retention policy by name
   * @param {string} policyName - Name of the policy to execute
   * @returns {Promise<Object>} Execution result
   */
  async executeSinglePolicy(policyName) {
    if (!this.retentionPolicies.hasOwnProperty(policyName)) {
      throw new Error(`Unknown retention policy: ${policyName}`);
    }

    const retentionDays = this.retentionPolicies[policyName];
    return await this.executePolicyByName(policyName, retentionDays);
  }
}

// Export singleton instance
module.exports = new DataRetentionService();