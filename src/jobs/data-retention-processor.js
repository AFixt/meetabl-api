/**
 * Data Retention Processor Job
 * 
 * Scheduled job to execute GDPR data retention policies
 * Runs daily to clean up old data according to retention policies
 * 
 * @author meetabl Team
 */

const logger = require('../config/logger');
const dataRetentionService = require('../services/data-retention.service');
const { v4: uuidv4 } = require('uuid');
const { AuditLog } = require('../models');

/**
 * Process data retention policies
 * @returns {Promise<Object>} Processing results
 */
async function processDataRetention() {
  const startTime = Date.now();
  logger.info('Starting data retention policy processing');

  try {
    // Execute all retention policies
    const results = await dataRetentionService.executeRetentionPolicies();
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Log successful completion
    logger.info(`Data retention processing completed in ${duration}ms`, {
      total_cleaned: results.total_cleaned,
      policies_executed: results.policies_executed,
      errors: results.errors,
      duration_ms: duration
    });

    // Create system audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: null, // System operation
      action: 'system.data_retention_completed',
      metadata: {
        ...results,
        duration_ms: duration,
        scheduled_execution: true
      }
    });

    return {
      success: true,
      ...results,
      duration_ms: duration
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.error('Data retention processing failed:', {
      error: error.message,
      stack: error.stack,
      duration_ms: duration
    });

    // Log failure
    try {
      await AuditLog.create({
        id: uuidv4(),
        user_id: null,
        action: 'system.data_retention_failed',
        metadata: {
          error: error.message,
          duration_ms: duration,
          scheduled_execution: true
        }
      });
    } catch (auditError) {
      logger.error('Failed to log data retention failure:', auditError);
    }

    return {
      success: false,
      error: error.message,
      duration_ms: duration
    };
  }
}

/**
 * Process a specific retention policy
 * @param {string} policyName - Name of the policy to execute
 * @returns {Promise<Object>} Processing result
 */
async function processSinglePolicy(policyName) {
  const startTime = Date.now();
  logger.info(`Starting single data retention policy: ${policyName}`);

  try {
    const result = await dataRetentionService.executeSinglePolicy(policyName);
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.info(`Data retention policy ${policyName} completed`, {
      cleaned_count: result.cleaned_count,
      duration_ms: duration
    });

    // Create audit log for single policy execution
    await AuditLog.create({
      id: uuidv4(),
      user_id: null,
      action: `system.data_retention_policy_executed`,
      metadata: {
        policy_name: policyName,
        cleaned_count: result.cleaned_count,
        duration_ms: duration,
        manual_execution: true
      }
    });

    return {
      success: true,
      policy_name: policyName,
      ...result,
      duration_ms: duration
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.error(`Data retention policy ${policyName} failed:`, error);

    try {
      await AuditLog.create({
        id: uuidv4(),
        user_id: null,
        action: 'system.data_retention_policy_failed',
        metadata: {
          policy_name: policyName,
          error: error.message,
          duration_ms: duration,
          manual_execution: true
        }
      });
    } catch (auditError) {
      logger.error('Failed to log policy failure:', auditError);
    }

    return {
      success: false,
      policy_name: policyName,
      error: error.message,
      duration_ms: duration
    };
  }
}

/**
 * Get retention policy status and statistics
 * @returns {Promise<Object>} Status information
 */
async function getRetentionStatus() {
  try {
    const policies = dataRetentionService.getRetentionPolicies();
    
    // Calculate next scheduled run (daily at 2 AM)
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(2, 0, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return {
      policies,
      policy_count: Object.keys(policies).length,
      next_scheduled_run: nextRun,
      status: 'active'
    };
  } catch (error) {
    logger.error('Failed to get retention status:', error);
    throw error;
  }
}

module.exports = {
  processDataRetention,
  processSinglePolicy,
  getRetentionStatus
};