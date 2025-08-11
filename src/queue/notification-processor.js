/**
 * Notification Queue Processor
 * 
 * Processes jobs from the notification queue to send emails and SMS
 * 
 * @author meetabl Team
 */

const { createWorker } = require('./index');
const notificationService = require('../services/notification.service');
const logger = require('../config/logger');

/**
 * Process notification jobs
 * 
 * @param {Object} job - The job containing notification data
 * @returns {Promise<void>} Promise that resolves when notification is sent
 */
async function processNotification(job) {
  const { data } = job;
  logger.info('Processing notification job:', { id: job.id, type: data.type });
  
  try {
    switch (data.type) {
      case 'email':
        await notificationService.sendEmail(data.bookingId, data.templateName, data.recipient, data.templateData);
        break;
        
      case 'sms':
        await notificationService.sendSMS(data.bookingId, data.recipient, data.message);
        break;
        
      default:
        throw new Error(`Unknown notification type: ${data.type}`);
    }
    
    logger.info('Notification sent successfully', { id: job.id });
  } catch (error) {
    logger.error('Error processing notification:', error);
    throw error; // Will be caught by the worker and job marked as failed
  }
}

/**
 * Start the notification worker
 * @returns {Worker} The notification worker instance
 */
function startWorker() {
  logger.info('Starting notification queue worker');
  return createWorker('notification', processNotification);
}

// Start the worker if this file is run directly
if (require.main === module) {
  startWorker();
}

module.exports = {
  processNotification,
  startWorker
};
