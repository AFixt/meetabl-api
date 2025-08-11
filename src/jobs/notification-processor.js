/**
 * Notification processor job
 *
 * Background job to process pending notifications
 *
 * @author meetabl Team
 */

const logger = require('../config/logger');
const { notificationService } = require('../services');

/**
 * Process notifications
 * Intended to be run at regular intervals via a scheduler
 */
const processNotifications = async () => {
  try {
    logger.info('Starting notification processing job');
    await notificationService.processNotificationQueue();
    logger.info('Notification processing job completed');
  } catch (error) {
    logger.error('Error in notification processing job:', error);
  }
};

/**
 * AWS Lambda handler for notification processing
 * @param {Object} event - AWS Lambda event object
 * @param {Object} context - AWS Lambda context object
 */
const lambdaHandler = async (event, context) => {
  try {
    logger.info('Lambda notification processor started', { event, context });
    await processNotifications();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Notification processing completed successfully'
      })
    };
  } catch (error) {
    logger.error('Lambda notification processor error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Notification processing failed',
        error: error.message
      })
    };
  }
};

// Export for manual triggering or scheduling
module.exports = { processNotifications, lambdaHandler };

// Run directly if this file is executed directly
if (require.main === module) {
  processNotifications()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Fatal error in notification processor:', err);
      process.exit(1);
    });
}
