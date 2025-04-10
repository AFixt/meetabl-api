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

// Export for manual triggering or scheduling
module.exports = { processNotifications };

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