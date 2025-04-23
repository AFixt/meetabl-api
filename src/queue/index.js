/**
 * Queue System using BullMQ
 * 
 * Sets up queues for background processing of notifications, calendar sync, etc.
 * 
 * @author meetabl Team
 */

const { Queue, Worker } = require('bullmq');
const redis = require('../redis');
const logger = require('../config/logger');

// Queue definitions
const queues = {
  notification: new Queue('notification', { connection: redis.getClient() }),
  calendarSync: new Queue('calendarSync', { connection: redis.getClient() })
};

/**
 * Adds a job to the specified queue
 * 
 * @param {string} queueName - Name of the queue (must exist in queues object)
 * @param {string} jobName - Name of the job type
 * @param {Object} data - Job data
 * @param {Object} options - Job options (priority, delay, etc)
 * @returns {Promise<Job>} The created job
 */
async function addJob(queueName, jobName, data, options = {}) {
  if (!queues[queueName]) {
    throw new Error(`Queue ${queueName} does not exist`);
  }
  
  logger.info(`Adding job to ${queueName} queue:`, { jobName });
  return queues[queueName].add(jobName, data, options);
}

/**
 * Creates a worker for processing jobs in a queue
 * 
 * @param {string} queueName - Name of the queue to process
 * @param {Function} processor - Job processing function
 * @returns {Worker} The created worker
 */
function createWorker(queueName, processor) {
  if (!queues[queueName]) {
    throw new Error(`Queue ${queueName} does not exist`);
  }
  
  const worker = new Worker(queueName, processor, { connection: redis.getClient() });
  
  worker.on('completed', job => {
    logger.info(`Job ${job.id} completed in queue ${queueName}`);
  });
  
  worker.on('failed', (job, error) => {
    logger.error(`Job ${job.id} failed in queue ${queueName}:`, error);
  });
  
  return worker;
}

/**
 * Gracefully closes all queues and workers
 * @returns {Promise<void>} Promise that resolves when all queues are closed
 */
async function closeQueues() {
  logger.info('Closing queue connections...');
  
  const closePromises = Object.values(queues).map(queue => queue.close());
  await Promise.all(closePromises);
  
  await redis.closeConnection();
  
  logger.info('All queue connections closed');
}

module.exports = {
  queues,
  addJob,
  createWorker,
  closeQueues
};
