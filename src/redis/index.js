/**
 * Redis Client
 * 
 * Initializes and exports the Redis client for the application
 * 
 * @author meetabl Team
 */

const Redis = require('ioredis');
const config = require('../config/redis');
const logger = require('../config/logger');

let redisClient = null;

/**
 * Gets a singleton Redis client instance
 * @returns {Redis} Redis client instance
 */
function getClient() {
  if (!redisClient) {
    redisClient = new Redis(config);
    
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });
  }
  
  return redisClient;
}

/**
 * Closes the Redis connection
 * @returns {Promise<void>} Promise that resolves when the connection is closed
 */
async function closeConnection() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

module.exports = {
  getClient,
  closeConnection
};
