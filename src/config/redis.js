/**
 * Redis configuration
 * 
 * This file configures Redis connection settings for the queue system
 * 
 * @author meetabl Team
 */

require('dotenv').config();

module.exports = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || '',
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    // Exponential backoff with max 10s
    return Math.min(times * 50, 10000);
  }
};
