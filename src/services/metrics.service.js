/**
 * Application metrics service
 * 
 * Provides custom metrics collection and monitoring for business logic
 * 
 * @author meetabl Team
 */

const { getMeter, getTracer } = require('../config/telemetry');
const { createLogger } = require('../config/logger');

const logger = createLogger('metrics');

class MetricsService {
  constructor() {
    this.meter = null;
    this.tracer = null;
    this.counters = {};
    this.histograms = {};
    this.gauges = {};
    this.initialized = false;
  }

  /**
   * Initialize metrics collectors
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      this.meter = getMeter();
      this.tracer = getTracer();

      // Business metrics counters
      this.counters = {
        bookingsCreated: this.meter.createCounter('bookings_created_total', {
          description: 'Total number of bookings created',
          unit: '1'
        }),
        bookingsCancelled: this.meter.createCounter('bookings_cancelled_total', {
          description: 'Total number of bookings cancelled',
          unit: '1'
        }),
        usersRegistered: this.meter.createCounter('users_registered_total', {
          description: 'Total number of users registered',
          unit: '1'
        }),
        authenticationAttempts: this.meter.createCounter('auth_attempts_total', {
          description: 'Total authentication attempts',
          unit: '1'
        }),
        authenticationFailures: this.meter.createCounter('auth_failures_total', {
          description: 'Total authentication failures',
          unit: '1'
        }),
        apiRequests: this.meter.createCounter('api_requests_total', {
          description: 'Total API requests',
          unit: '1'
        }),
        apiErrors: this.meter.createCounter('api_errors_total', {
          description: 'Total API errors',
          unit: '1'
        }),
        webhookEvents: this.meter.createCounter('webhook_events_total', {
          description: 'Total webhook events processed',
          unit: '1'
        }),
        webhookFailures: this.meter.createCounter('webhook_failures_total', {
          description: 'Total webhook processing failures',
          unit: '1'
        }),
        subscriptionChanges: this.meter.createCounter('subscription_changes_total', {
          description: 'Total subscription changes',
          unit: '1'
        })
      };

      // Performance metrics histograms
      this.histograms = {
        requestDuration: this.meter.createHistogram('request_duration_seconds', {
          description: 'HTTP request duration in seconds',
          unit: 's',
          boundaries: [0.001, 0.01, 0.1, 1, 10]
        }),
        databaseQueryDuration: this.meter.createHistogram('database_query_duration_seconds', {
          description: 'Database query duration in seconds',
          unit: 's',
          boundaries: [0.001, 0.01, 0.1, 1, 5]
        }),
        bookingProcessingTime: this.meter.createHistogram('booking_processing_duration_seconds', {
          description: 'Time taken to process booking requests',
          unit: 's',
          boundaries: [0.1, 0.5, 1, 2, 5]
        })
      };

      // Current state gauges
      this.gauges = {
        activeConnections: this.meter.createUpDownCounter('active_connections', {
          description: 'Number of active database connections',
          unit: '1'
        }),
        queueSize: this.meter.createUpDownCounter('queue_size', {
          description: 'Number of jobs in processing queue',
          unit: '1'
        }),
        memoryUsage: this.meter.createObservableGauge('memory_usage_bytes', {
          description: 'Memory usage in bytes',
          unit: 'By'
        }),
        activeUsers: this.meter.createObservableGauge('active_users', {
          description: 'Number of currently active users',
          unit: '1'
        })
      };

      // Register observable gauge callbacks
      this.registerObservableGauges();

      this.initialized = true;
      logger.info('Metrics service initialized');
    } catch (error) {
      logger.error('Failed to initialize metrics service', { error: error.message });
    }
  }

  /**
   * Register callbacks for observable gauges
   */
  registerObservableGauges() {
    // Memory usage callback
    this.gauges.memoryUsage.addCallback((result) => {
      const memUsage = process.memoryUsage();
      result.observe(memUsage.heapUsed, { type: 'heap_used' });
      result.observe(memUsage.heapTotal, { type: 'heap_total' });
      result.observe(memUsage.rss, { type: 'rss' });
    });

    // Active users callback (would need to implement user session tracking)
    this.gauges.activeUsers.addCallback(async (result) => {
      try {
        // This would require implementing active session tracking
        // For now, we'll use a placeholder
        const activeCount = await this.getActiveUserCount();
        result.observe(activeCount);
      } catch (error) {
        logger.error('Error collecting active users metric', { error: error.message });
      }
    });
  }

  /**
   * Record booking creation
   */
  recordBookingCreated(attributes = {}) {
    this.counters.bookingsCreated?.add(1, attributes);
  }

  /**
   * Record booking cancellation
   */
  recordBookingCancelled(attributes = {}) {
    this.counters.bookingsCancelled?.add(1, attributes);
  }

  /**
   * Record user registration
   */
  recordUserRegistered(attributes = {}) {
    this.counters.usersRegistered?.add(1, attributes);
  }

  /**
   * Record authentication attempt
   */
  recordAuthAttempt(success = true, attributes = {}) {
    this.counters.authenticationAttempts?.add(1, attributes);
    
    if (!success) {
      this.counters.authenticationFailures?.add(1, attributes);
    }
  }

  /**
   * Record API request
   */
  recordApiRequest(attributes = {}) {
    this.counters.apiRequests?.add(1, attributes);
  }

  /**
   * Record API error
   */
  recordApiError(attributes = {}) {
    this.counters.apiErrors?.add(1, attributes);
  }

  /**
   * Record webhook event
   */
  recordWebhookEvent(success = true, attributes = {}) {
    this.counters.webhookEvents?.add(1, attributes);
    
    if (!success) {
      this.counters.webhookFailures?.add(1, attributes);
    }
  }

  /**
   * Record subscription change
   */
  recordSubscriptionChange(attributes = {}) {
    this.counters.subscriptionChanges?.add(1, attributes);
  }

  /**
   * Record request duration
   */
  recordRequestDuration(duration, attributes = {}) {
    this.histograms.requestDuration?.record(duration, attributes);
  }

  /**
   * Record database query duration
   */
  recordDatabaseQueryDuration(duration, attributes = {}) {
    this.histograms.databaseQueryDuration?.record(duration, attributes);
  }

  /**
   * Record booking processing time
   */
  recordBookingProcessingTime(duration, attributes = {}) {
    this.histograms.bookingProcessingTime?.record(duration, attributes);
  }

  /**
   * Update active connections count
   */
  updateActiveConnections(count) {
    // Reset and set new value
    this.gauges.activeConnections?.add(count);
  }

  /**
   * Update queue size
   */
  updateQueueSize(size) {
    this.gauges.queueSize?.add(size);
  }

  /**
   * Create a custom span for tracing
   */
  createSpan(name, fn, attributes = {}) {
    if (!this.tracer) {
      return fn();
    }

    return this.tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: 2, message: error.message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get active user count (placeholder implementation)
   */
  async getActiveUserCount() {
    // This would implement actual active user tracking
    // For now, return a placeholder value
    return 0;
  }

  /**
   * Get comprehensive metrics summary
   */
  async getMetricsSummary() {
    const memUsage = process.memoryUsage();
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version
      },
      environment: process.env.NODE_ENV
    };
  }
}

module.exports = new MetricsService();