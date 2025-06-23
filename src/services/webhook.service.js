/**
 * Webhook verification and processing service
 * 
 * Handles webhook signature verification and event processing
 * 
 * @author meetabl Team
 */

const crypto = require('crypto');
const { createLogger } = require('../config/logger');

const logger = createLogger('webhook-service');

class WebhookService {
  /**
   * Verify webhook signature using HMAC-SHA256
   * @param {string} payload - Raw request body
   * @param {string} signature - Webhook signature header
   * @param {string} secret - Webhook secret
   * @returns {boolean} Verification result
   */
  verifySignature(payload, signature, secret) {
    if (!signature || !secret) {
      logger.warn('Missing signature or secret for webhook verification');
      return false;
    }

    try {
      // Remove 'sha256=' prefix if present
      const cleanSignature = signature.replace(/^sha256=/, '');
      
      // Calculate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(cleanSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying webhook signature', { error: error.message });
      return false;
    }
  }

  /**
   * Verify Outseta webhook signature
   * @param {string} payload - Raw request body
   * @param {string} signature - X-Outseta-Signature header
   * @returns {boolean} Verification result
   */
  verifyOutsetaSignature(payload, signature) {
    const secret = process.env.OUTSETA_WEBHOOK_SECRET;
    
    if (!secret) {
      logger.error('OUTSETA_WEBHOOK_SECRET not configured');
      return false;
    }

    return this.verifySignature(payload, signature, secret);
  }

  /**
   * Process webhook event with retries and error handling
   * @param {Object} event - Webhook event data
   * @param {Function} processor - Event processor function
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<boolean>} Success status
   */
  async processEventWithRetry(event, processor, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await processor(event);
        
        if (attempt > 1) {
          logger.info('Webhook processing succeeded after retry', { 
            eventType: event.type,
            attempt 
          });
        }
        
        return true;
      } catch (error) {
        lastError = error;
        
        logger.warn('Webhook processing failed', {
          eventType: event.type,
          attempt,
          error: error.message
        });

        // Don't retry for certain error types
        if (this.isNonRetryableError(error)) {
          logger.error('Non-retryable error, stopping retries', { 
            eventType: event.type,
            error: error.message 
          });
          break;
        }

        // Exponential backoff delay
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('Webhook processing failed after all retries', {
      eventType: event.type,
      maxRetries,
      finalError: lastError.message
    });

    return false;
  }

  /**
   * Check if error is non-retryable (e.g., validation errors)
   * @param {Error} error - Error object
   * @returns {boolean} Whether error is non-retryable
   */
  isNonRetryableError(error) {
    const nonRetryableMessages = [
      'User not found',
      'Invalid user data',
      'Validation error',
      'Duplicate entry',
      'Foreign key constraint'
    ];

    return nonRetryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }

  /**
   * Log webhook event for debugging and monitoring
   * @param {Object} event - Webhook event
   * @param {string} source - Event source (e.g., 'outseta')
   * @param {boolean} success - Processing success status
   * @param {string} error - Error message if failed
   */
  logWebhookEvent(event, source, success, error = null) {
    const logData = {
      source,
      eventType: event.type,
      eventId: event.id || 'unknown',
      success,
      timestamp: new Date().toISOString()
    };

    if (error) {
      logData.error = error;
    }

    if (success) {
      logger.info('Webhook event processed successfully', logData);
    } else {
      logger.error('Webhook event processing failed', logData);
    }
  }

  /**
   * Validate webhook event structure
   * @param {Object} event - Webhook event
   * @returns {Object} Validation result
   */
  validateEventStructure(event) {
    const errors = [];

    if (!event) {
      errors.push('Event is null or undefined');
    } else {
      if (!event.type) {
        errors.push('Event type is required');
      }

      if (!event.data) {
        errors.push('Event data is required');
      }

      // Validate event type format
      if (event.type && !/^[a-zA-Z]+\.[a-zA-Z]+$/.test(event.type)) {
        errors.push('Event type must be in format "resource.action"');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create webhook response based on processing result
   * @param {boolean} success - Processing success status
   * @param {string} message - Response message
   * @param {Object} details - Additional details
   * @returns {Object} Response object
   */
  createWebhookResponse(success, message, details = {}) {
    const response = {
      success,
      message,
      timestamp: new Date().toISOString()
    };

    if (Object.keys(details).length > 0) {
      response.details = details;
    }

    return response;
  }

  /**
   * Get webhook processing statistics
   * @param {string} timeRange - Time range for stats (e.g., '24h', '7d')
   * @returns {Promise<Object>} Webhook statistics
   */
  async getWebhookStats(timeRange = '24h') {
    // This would typically query a database or monitoring system
    // For now, return placeholder data
    return {
      timeRange,
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      eventTypes: {},
      avgProcessingTime: 0
    };
  }
}

module.exports = new WebhookService();