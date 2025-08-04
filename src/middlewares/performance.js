/**
 * Performance monitoring middleware
 * 
 * Tracks request performance, database queries, and custom metrics
 * 
 * @author meetabl Team
 */

const metricsService = require('../services/metrics.service');
const { createLogger } = require('../config/logger');

const logger = createLogger('performance');

/**
 * Request performance monitoring middleware
 */
const requestPerformanceMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const startHrTime = process.hrtime();

  // Track API request
  metricsService.recordApiRequest({
    method: req.method,
    route: req.route?.path || req.path,
    user_agent: req.get('user-agent') || 'unknown'
  });

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const [seconds, nanoseconds] = process.hrtime(startHrTime);
    const durationSeconds = seconds + nanoseconds / 1000000000;

    // Record request duration
    metricsService.recordRequestDuration(durationSeconds, {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString(),
      status_class: `${Math.floor(res.statusCode / 100)}xx`
    });

    // Record API errors
    if (res.statusCode >= 400) {
      metricsService.recordApiError({
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode.toString(),
        error_type: res.statusCode >= 500 ? 'server_error' : 'client_error'
      });
    }

    // Log slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration,
        statusCode: res.statusCode,
        userAgent: req.get('user-agent')
      });
    }

    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
};

/**
 * Database query performance monitoring
 */
const databasePerformanceWrapper = (originalQuery) => {
  return function(...args) {
    const startTime = process.hrtime();
    const query = args[0];
    
    // Extract table name from query (basic parsing)
    const tableMatch = query.match(/(?:FROM|UPDATE|INSERT INTO|DELETE FROM)\s+`?(\w+)`?/i);
    const tableName = tableMatch ? tableMatch[1] : 'unknown';
    
    // Extract operation type
    const operationMatch = query.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i);
    const operation = operationMatch ? operationMatch[1].toLowerCase() : 'unknown';

    const promise = originalQuery.apply(this, args);
    
    if (promise && typeof promise.then === 'function') {
      return promise
        .then((result) => {
          const [seconds, nanoseconds] = process.hrtime(startTime);
          const duration = seconds + nanoseconds / 1000000000;
          
          metricsService.recordDatabaseQueryDuration(duration, {
            operation,
            table: tableName,
            success: 'true'
          });
          
          // Log slow queries
          if (duration > 1) { // 1 second
            logger.warn('Slow database query detected', {
              query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
              duration,
              operation,
              table: tableName
            });
          }
          
          return result;
        })
        .catch((error) => {
          const [seconds, nanoseconds] = process.hrtime(startTime);
          const duration = seconds + nanoseconds / 1000000000;
          
          metricsService.recordDatabaseQueryDuration(duration, {
            operation,
            table: tableName,
            success: 'false',
            error_type: error.name || 'unknown'
          });
          
          logger.error('Database query failed', {
            query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
            duration,
            operation,
            table: tableName,
            error: error.message
          });
          
          throw error;
        });
    }
    
    return promise;
  };
};

/**
 * Booking operation performance monitoring
 */
const bookingPerformanceWrapper = (originalFunction, operationType) => {
  return async function(...args) {
    const startTime = process.hrtime();
    
    try {
      const result = await originalFunction.apply(this, args);
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1000000000;
      
      metricsService.recordBookingProcessingTime(duration, {
        operation: operationType,
        success: 'true'
      });
      
      // Record business metrics
      if (operationType === 'create') {
        metricsService.recordBookingCreated({
          user_id: args[0]?.hostId || 'unknown'
        });
      } else if (operationType === 'cancel') {
        metricsService.recordBookingCancelled({
          user_id: args[0]?.hostId || 'unknown'
        });
      }
      
      return result;
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1000000000;
      
      metricsService.recordBookingProcessingTime(duration, {
        operation: operationType,
        success: 'false',
        error_type: error.name || 'unknown'
      });
      
      throw error;
    }
  };
};

/**
 * Memory usage monitoring
 */
const memoryMonitor = {
  start() {
    // Skip monitoring in test environment to avoid hanging tests
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    
    // Monitor memory usage every 30 seconds
    this.interval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const memoryMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };

      // Log high memory usage
      if (memoryMB.rss > 500) { // 500MB
        logger.warn('High memory usage detected', memoryMB);
      }

      // Track memory metrics
      logger.debug('Memory usage', memoryMB);
    }, 30000);
  },

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
};

/**
 * Event loop lag monitoring
 */
const eventLoopMonitor = {
  start() {
    // Skip monitoring in test environment to avoid hanging tests
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    
    let lastTime = process.hrtime();
    
    this.interval = setInterval(() => {
      const currentTime = process.hrtime();
      const lag = (currentTime[0] - lastTime[0]) * 1000 + (currentTime[1] - lastTime[1]) / 1000000 - 100; // Expected 100ms
      lastTime = currentTime;

      if (lag > 100) { // More than 100ms lag
        logger.warn('Event loop lag detected', { lag: Math.round(lag) });
      }
    }, 100);
  },

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
};

/**
 * Initialize performance monitoring
 */
const initializePerformanceMonitoring = () => {
  // Initialize metrics service
  metricsService.initialize();
  
  // Start system monitors
  memoryMonitor.start();
  eventLoopMonitor.start();
  
  logger.info('Performance monitoring initialized');
};

/**
 * Shutdown performance monitoring
 */
const shutdownPerformanceMonitoring = () => {
  memoryMonitor.stop();
  eventLoopMonitor.stop();
  
  logger.info('Performance monitoring shutdown');
};

module.exports = {
  requestPerformanceMiddleware,
  databasePerformanceWrapper,
  bookingPerformanceWrapper,
  initializePerformanceMonitoring,
  shutdownPerformanceMonitoring,
  memoryMonitor,
  eventLoopMonitor
};