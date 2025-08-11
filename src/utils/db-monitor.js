/**
 * Database Query Monitoring Utility
 * 
 * Provides query performance monitoring and slow query logging
 * for the meetabl application
 */

const logger = require('../config/logger');
const { performance } = require('perf_hooks');

class DatabaseMonitor {
  constructor(options = {}) {
    this.slowQueryThreshold = options.slowQueryThreshold || 1000; // 1 second default
    this.logLevel = options.logLevel || 'warn';
    this.queryStats = new Map();
    this.enabled = process.env.DB_MONITORING_ENABLED === 'true' || options.enabled;
  }

  /**
   * Log query execution details
   * @param {string} sql - SQL query
   * @param {number} executionTime - Time in milliseconds
   * @param {object} options - Additional options
   */
  logQuery(sql, executionTime, options = {}) {
    if (!this.enabled) return;

    const queryType = this.getQueryType(sql);
    const tableName = this.extractTableName(sql);
    
    // Update statistics
    this.updateQueryStats(queryType, tableName, executionTime);

    // Log slow queries
    if (executionTime > this.slowQueryThreshold) {
      logger.warn('Slow query detected', {
        sql: this.sanitizeQuery(sql),
        executionTime,
        queryType,
        tableName,
        threshold: this.slowQueryThreshold,
        ...options
      });
    } else if (this.logLevel === 'debug') {
      logger.debug('Query executed', {
        sql: this.sanitizeQuery(sql),
        executionTime,
        queryType,
        tableName
      });
    }
  }

  /**
   * Get query type from SQL
   * @param {string} sql - SQL query
   * @returns {string} Query type
   */
  getQueryType(sql) {
    const trimmedSql = sql.trim().toUpperCase();
    if (trimmedSql.startsWith('SELECT')) return 'SELECT';
    if (trimmedSql.startsWith('INSERT')) return 'INSERT';
    if (trimmedSql.startsWith('UPDATE')) return 'UPDATE';
    if (trimmedSql.startsWith('DELETE')) return 'DELETE';
    if (trimmedSql.startsWith('CREATE')) return 'CREATE';
    if (trimmedSql.startsWith('ALTER')) return 'ALTER';
    if (trimmedSql.startsWith('DROP')) return 'DROP';
    return 'OTHER';
  }

  /**
   * Extract table name from SQL query
   * @param {string} sql - SQL query
   * @returns {string} Table name or 'unknown'
   */
  extractTableName(sql) {
    const patterns = [
      /FROM\s+`?(\w+)`?/i,
      /INTO\s+`?(\w+)`?/i,
      /UPDATE\s+`?(\w+)`?/i,
      /DELETE\s+FROM\s+`?(\w+)`?/i,
      /CREATE\s+TABLE\s+`?(\w+)`?/i,
      /ALTER\s+TABLE\s+`?(\w+)`?/i,
      /DROP\s+TABLE\s+`?(\w+)`?/i
    ];

    for (const pattern of patterns) {
      const match = sql.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return 'unknown';
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   * @param {string} sql - SQL query
   * @returns {string} Sanitized query
   */
  sanitizeQuery(sql) {
    // Remove string literals that might contain sensitive data
    return sql
      .replace(/'[^']*'/g, "'?'")
      .replace(/"[^"]*"/g, '"?"')
      .replace(/\b\d{4,}\b/g, '?'); // Remove long numbers (potential IDs, cards, etc.)
  }

  /**
   * Update query statistics
   * @param {string} queryType - Type of query
   * @param {string} tableName - Table name
   * @param {number} executionTime - Execution time in ms
   */
  updateQueryStats(queryType, tableName, executionTime) {
    const key = `${queryType}:${tableName}`;
    
    if (!this.queryStats.has(key)) {
      this.queryStats.set(key, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0
      });
    }

    const stats = this.queryStats.get(key);
    stats.count++;
    stats.totalTime += executionTime;
    stats.minTime = Math.min(stats.minTime, executionTime);
    stats.maxTime = Math.max(stats.maxTime, executionTime);
    stats.avgTime = stats.totalTime / stats.count;
  }

  /**
   * Get query statistics
   * @returns {object} Query statistics
   */
  getStats() {
    const stats = {};
    
    for (const [key, value] of this.queryStats) {
      stats[key] = {
        ...value,
        avgTime: Math.round(value.avgTime)
      };
    }

    return stats;
  }

  /**
   * Get slow queries report
   * @param {number} limit - Number of slow queries to return
   * @returns {array} Array of slow query entries
   */
  getSlowQueries(limit = 10) {
    const slowQueries = [];

    for (const [key, stats] of this.queryStats) {
      if (stats.maxTime > this.slowQueryThreshold) {
        const [queryType, tableName] = key.split(':');
        slowQueries.push({
          queryType,
          tableName,
          ...stats
        });
      }
    }

    return slowQueries
      .sort((a, b) => b.maxTime - a.maxTime)
      .slice(0, limit);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.queryStats.clear();
  }

  /**
   * Create monitoring middleware for Sequelize
   * @returns {function} Sequelize logging function
   */
  createSequelizeLogger() {
    return (sql, timing) => {
      if (typeof timing === 'number') {
        this.logQuery(sql, timing);
      } else if (timing && typeof timing.elapsed === 'number') {
        this.logQuery(sql, timing.elapsed);
      }
    };
  }

  /**
   * Create Express middleware for monitoring endpoints
   * @returns {function} Express middleware
   */
  createExpressMiddleware() {
    return (req, res, next) => {
      if (req.path === '/api/monitoring/db-stats' && req.method === 'GET') {
        return res.json({
          enabled: this.enabled,
          slowQueryThreshold: this.slowQueryThreshold,
          stats: this.getStats(),
          slowQueries: this.getSlowQueries()
        });
      }
      next();
    };
  }
}

// Create singleton instance
const dbMonitor = new DatabaseMonitor({
  slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000,
  logLevel: process.env.DB_MONITOR_LOG_LEVEL || 'warn',
  enabled: process.env.NODE_ENV !== 'test' // Disable in test environment
});

module.exports = dbMonitor;