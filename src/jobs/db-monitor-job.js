/**
 * Database Monitoring Job
 * 
 * Periodically logs database performance statistics and slow queries
 */

const logger = require('../config/logger');
const dbMonitor = require('../utils/db-monitor');
const { getPoolStats } = require('../config/database');

/**
 * Log database statistics
 */
function logDatabaseStats() {
  try {
    const stats = dbMonitor.getStats();
    const slowQueries = dbMonitor.getSlowQueries();
    const poolStats = getPoolStats();

    // Log pool statistics
    logger.info('Database connection pool status', {
      pool: poolStats,
      timestamp: new Date().toISOString()
    });

    // Log query statistics if available
    if (Object.keys(stats).length > 0) {
      logger.info('Database query statistics', {
        stats: stats,
        timestamp: new Date().toISOString()
      });
    }

    // Log slow queries if any
    if (slowQueries.length > 0) {
      logger.warn('Slow queries detected in the last period', {
        slowQueries: slowQueries,
        timestamp: new Date().toISOString()
      });
    }

    // Log summary metrics
    const totalQueries = Object.values(stats).reduce((sum, stat) => sum + stat.count, 0);
    const avgQueryTime = totalQueries > 0
      ? Object.values(stats).reduce((sum, stat) => sum + (stat.avgTime * stat.count), 0) / totalQueries
      : 0;

    logger.info('Database performance summary', {
      totalQueries,
      avgQueryTime: Math.round(avgQueryTime),
      slowQueryCount: slowQueries.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to log database statistics', { error: error.message });
  }
}

/**
 * Start monitoring job
 * @param {number} intervalMinutes - Interval in minutes between statistics logs
 */
function startMonitoringJob(intervalMinutes = 5) {
  // Only run in non-test environments
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  logger.info(`Starting database monitoring job with ${intervalMinutes} minute interval`);

  // Log initial stats
  logDatabaseStats();

  // Schedule periodic logging
  const intervalMs = intervalMinutes * 60 * 1000;
  const intervalId = setInterval(logDatabaseStats, intervalMs);

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    clearInterval(intervalId);
    logger.info('Database monitoring job stopped');
  });

  process.on('SIGINT', () => {
    clearInterval(intervalId);
    logger.info('Database monitoring job stopped');
  });

  return intervalId;
}

module.exports = {
  logDatabaseStats,
  startMonitoringJob
};