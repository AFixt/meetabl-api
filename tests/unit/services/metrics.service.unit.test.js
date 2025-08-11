/**
 * Metrics service unit tests
 *
 * Tests for application metrics collection and monitoring
 *
 * @author meetabl Team
 */

// Create mock logger instance
const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
};

// Mock dependencies before imports
jest.mock('../../../src/config/telemetry', () => ({
  getMeter: jest.fn(),
  getTracer: jest.fn()
}));

jest.mock('../../../src/config/logger', () => ({
  createLogger: jest.fn(() => mockLogger)
}));

const { getMeter, getTracer } = require('../../../src/config/telemetry');
const { createLogger } = require('../../../src/config/logger');

// Mock OpenTelemetry metric instruments
const createMockInstrument = (type) => ({
  add: jest.fn(),
  record: jest.fn(),
  addCallback: jest.fn()
});

const mockMeter = {
  createCounter: jest.fn().mockImplementation(() => createMockInstrument('counter')),
  createHistogram: jest.fn().mockImplementation(() => createMockInstrument('histogram')),
  createUpDownCounter: jest.fn().mockImplementation(() => createMockInstrument('upDownCounter')),
  createObservableGauge: jest.fn().mockImplementation(() => createMockInstrument('observableGauge'))
};

const mockTracer = {
  startActiveSpan: jest.fn()
};

// Import service after mocks
const metricsService = require('../../../src/services/metrics.service');

describe('MetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service state
    metricsService.meter = null;
    metricsService.tracer = null;
    metricsService.counters = {};
    metricsService.histograms = {};
    metricsService.gauges = {};
    metricsService.initialized = false;
    
    // Setup mocks
    getMeter.mockReturnValue(mockMeter);
    getTracer.mockReturnValue(mockTracer);
    createLogger.mockReturnValue(mockLogger);
    
    // Clear mock logger calls
    mockLogger.debug.mockClear();
    mockLogger.error.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
  });

  describe('initialize', () => {
    test('should initialize metrics service successfully', () => {
      metricsService.initialize();

      expect(getMeter).toHaveBeenCalled();
      expect(getTracer).toHaveBeenCalled();
      expect(metricsService.initialized).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Metrics service initialized');
    });

    test('should create all required counters', () => {
      metricsService.initialize();

      expect(mockMeter.createCounter).toHaveBeenCalledWith('bookings_created_total', {
        description: 'Total number of bookings created',
        unit: '1'
      });
      expect(mockMeter.createCounter).toHaveBeenCalledWith('bookings_cancelled_total', {
        description: 'Total number of bookings cancelled',
        unit: '1'
      });
      expect(mockMeter.createCounter).toHaveBeenCalledWith('users_registered_total', {
        description: 'Total number of users registered',
        unit: '1'
      });
      expect(mockMeter.createCounter).toHaveBeenCalledWith('auth_attempts_total', {
        description: 'Total authentication attempts',
        unit: '1'
      });
      expect(mockMeter.createCounter).toHaveBeenCalledWith('auth_failures_total', {
        description: 'Total authentication failures',
        unit: '1'
      });
      expect(mockMeter.createCounter).toHaveBeenCalledWith('api_requests_total', {
        description: 'Total API requests',
        unit: '1'
      });
      expect(mockMeter.createCounter).toHaveBeenCalledWith('api_errors_total', {
        description: 'Total API errors',
        unit: '1'
      });
      expect(mockMeter.createCounter).toHaveBeenCalledWith('webhook_events_total', {
        description: 'Total webhook events processed',
        unit: '1'
      });
      expect(mockMeter.createCounter).toHaveBeenCalledWith('subscription_changes_total', {
        description: 'Total subscription changes',
        unit: '1'
      });
    });

    test('should create all required histograms', () => {
      metricsService.initialize();

      expect(mockMeter.createHistogram).toHaveBeenCalledWith('request_duration_seconds', {
        description: 'HTTP request duration in seconds',
        unit: 's',
        boundaries: [0.001, 0.01, 0.1, 1, 10]
      });
      expect(mockMeter.createHistogram).toHaveBeenCalledWith('database_query_duration_seconds', {
        description: 'Database query duration in seconds',
        unit: 's',
        boundaries: [0.001, 0.01, 0.1, 1, 5]
      });
      expect(mockMeter.createHistogram).toHaveBeenCalledWith('booking_processing_duration_seconds', {
        description: 'Time taken to process booking requests',
        unit: 's',
        boundaries: [0.1, 0.5, 1, 2, 5]
      });
    });

    test('should create all required gauges', () => {
      metricsService.initialize();

      expect(mockMeter.createUpDownCounter).toHaveBeenCalledWith('active_connections', {
        description: 'Number of active database connections',
        unit: '1'
      });
      expect(mockMeter.createUpDownCounter).toHaveBeenCalledWith('queue_size', {
        description: 'Number of jobs in processing queue',
        unit: '1'
      });
      expect(mockMeter.createObservableGauge).toHaveBeenCalledWith('memory_usage_bytes', {
        description: 'Memory usage in bytes',
        unit: 'By'
      });
      expect(mockMeter.createObservableGauge).toHaveBeenCalledWith('active_users', {
        description: 'Number of currently active users',
        unit: '1'
      });
    });

    test('should not reinitialize if already initialized', () => {
      metricsService.initialize();
      const callCount = getMeter.mock.calls.length;
      
      metricsService.initialize();
      
      expect(getMeter).toHaveBeenCalledTimes(callCount);
    });

    test('should handle initialization errors gracefully', () => {
      getMeter.mockImplementationOnce(() => {
        throw new Error('Telemetry error');
      });

      metricsService.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize metrics service',
        { error: 'Telemetry error' }
      );
      expect(metricsService.initialized).toBe(false);
    });
  });

  describe('registerObservableGauges', () => {
    beforeEach(() => {
      metricsService.initialize();
    });

    test('should register memory usage callback', () => {
      const memoryGauge = metricsService.gauges.memoryUsage;
      expect(memoryGauge.addCallback).toHaveBeenCalled();

      // Test the callback
      const callback = memoryGauge.addCallback.mock.calls[0][0];
      const mockResult = {
        observe: jest.fn()
      };

      callback(mockResult);

      expect(mockResult.observe).toHaveBeenCalledTimes(3);
      expect(mockResult.observe).toHaveBeenCalledWith(expect.any(Number), { type: 'heap_used' });
      expect(mockResult.observe).toHaveBeenCalledWith(expect.any(Number), { type: 'heap_total' });
      expect(mockResult.observe).toHaveBeenCalledWith(expect.any(Number), { type: 'rss' });
    });

    test('should register active users callback', async () => {
      const activeUsersGauge = metricsService.gauges.activeUsers;
      expect(activeUsersGauge.addCallback).toHaveBeenCalled();

      // Test the callback
      const callback = activeUsersGauge.addCallback.mock.calls[0][0];
      const mockResult = {
        observe: jest.fn()
      };

      const spy = jest.spyOn(metricsService, 'getActiveUserCount').mockResolvedValue(42);

      await callback(mockResult);

      expect(mockResult.observe).toHaveBeenCalledWith(42);
      
      // Clean up spy
      spy.mockRestore();
    });

    test('should handle active users callback errors', async () => {
      const activeUsersGauge = metricsService.gauges.activeUsers;
      const callback = activeUsersGauge.addCallback.mock.calls[0][0];
      const mockResult = {
        observe: jest.fn()
      };

      const spy = jest.spyOn(metricsService, 'getActiveUserCount').mockRejectedValue(new Error('Database error'));

      await callback(mockResult);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error collecting active users metric',
        { error: 'Database error' }
      );
      
      // Clean up spy
      spy.mockRestore();
    });
  });

  describe('counter methods', () => {
    beforeEach(() => {
      metricsService.initialize();
    });

    test('should record booking created', () => {
      const attributes = { user_id: 'user-123' };
      metricsService.recordBookingCreated(attributes);

      expect(metricsService.counters.bookingsCreated.add).toHaveBeenCalledWith(1, attributes);
    });

    test('should record booking cancelled', () => {
      const attributes = { reason: 'user_cancelled' };
      metricsService.recordBookingCancelled(attributes);

      expect(metricsService.counters.bookingsCancelled.add).toHaveBeenCalledWith(1, attributes);
    });

    test('should record user registered', () => {
      const attributes = { registration_type: 'email' };
      metricsService.recordUserRegistered(attributes);

      expect(metricsService.counters.usersRegistered.add).toHaveBeenCalledWith(1, attributes);
    });

    test('should record successful authentication attempt', () => {
      const attributes = { method: 'password' };
      metricsService.recordAuthAttempt(true, attributes);

      expect(metricsService.counters.authenticationAttempts.add).toHaveBeenCalledWith(1, attributes);
      expect(metricsService.counters.authenticationFailures.add).not.toHaveBeenCalled();
    });

    test('should record failed authentication attempt', () => {
      const attributes = { method: 'password' };
      metricsService.recordAuthAttempt(false, attributes);

      expect(metricsService.counters.authenticationAttempts.add).toHaveBeenCalledWith(1, attributes);
      expect(metricsService.counters.authenticationFailures.add).toHaveBeenCalledWith(1, attributes);
    });

    test('should record API request', () => {
      const attributes = { method: 'GET', endpoint: '/api/bookings' };
      metricsService.recordApiRequest(attributes);

      expect(metricsService.counters.apiRequests.add).toHaveBeenCalledWith(1, attributes);
    });

    test('should record API error', () => {
      const attributes = { status_code: 500, endpoint: '/api/bookings' };
      metricsService.recordApiError(attributes);

      expect(metricsService.counters.apiErrors.add).toHaveBeenCalledWith(1, attributes);
    });

    test('should record successful webhook event', () => {
      const attributes = { event_type: 'payment.succeeded' };
      metricsService.recordWebhookEvent(true, attributes);

      expect(metricsService.counters.webhookEvents.add).toHaveBeenCalledWith(1, attributes);
      expect(metricsService.counters.webhookFailures.add).not.toHaveBeenCalled();
    });

    test('should record failed webhook event', () => {
      const attributes = { event_type: 'payment.failed' };
      metricsService.recordWebhookEvent(false, attributes);

      expect(metricsService.counters.webhookEvents.add).toHaveBeenCalledWith(1, attributes);
      expect(metricsService.counters.webhookFailures.add).toHaveBeenCalledWith(1, attributes);
    });

    test('should record subscription change', () => {
      const attributes = { change_type: 'upgrade', plan: 'professional' };
      metricsService.recordSubscriptionChange(attributes);

      expect(metricsService.counters.subscriptionChanges.add).toHaveBeenCalledWith(1, attributes);
    });
  });

  describe('histogram methods', () => {
    beforeEach(() => {
      metricsService.initialize();
    });

    test('should record request duration', () => {
      const duration = 0.250;
      const attributes = { method: 'POST', status: '200' };
      metricsService.recordRequestDuration(duration, attributes);

      expect(metricsService.histograms.requestDuration.record).toHaveBeenCalledWith(duration, attributes);
    });

    test('should record database query duration', () => {
      const duration = 0.045;
      const attributes = { query_type: 'SELECT', table: 'bookings' };
      metricsService.recordDatabaseQueryDuration(duration, attributes);

      expect(metricsService.histograms.databaseQueryDuration.record).toHaveBeenCalledWith(duration, attributes);
    });

    test('should record booking processing time', () => {
      const duration = 1.2;
      const attributes = { booking_type: 'immediate' };
      metricsService.recordBookingProcessingTime(duration, attributes);

      expect(metricsService.histograms.bookingProcessingTime.record).toHaveBeenCalledWith(duration, attributes);
    });
  });

  describe('gauge methods', () => {
    beforeEach(() => {
      metricsService.initialize();
    });

    test('should update active connections count', () => {
      const count = 15;
      metricsService.updateActiveConnections(count);

      expect(metricsService.gauges.activeConnections.add).toHaveBeenCalledWith(count);
    });

    test('should update queue size', () => {
      const size = 8;
      metricsService.updateQueueSize(size);

      expect(metricsService.gauges.queueSize.add).toHaveBeenCalledWith(size);
    });
  });

  describe('createSpan', () => {
    beforeEach(() => {
      metricsService.initialize();
    });

    test('should create span and execute function successfully', async () => {
      const mockSpan = {
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn()
      };
      
      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const testFn = jest.fn().mockResolvedValue('test result');
      const attributes = { operation: 'test' };

      const result = await metricsService.createSpan('test-operation', testFn, attributes);

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'test-operation',
        { attributes },
        expect.any(Function)
      );
      expect(testFn).toHaveBeenCalledWith(mockSpan);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
      expect(mockSpan.end).toHaveBeenCalled();
      expect(result).toBe('test result');
    });

    test('should handle span execution errors', async () => {
      const mockSpan = {
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn()
      };
      
      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const error = new Error('Test error');
      const testFn = jest.fn().mockRejectedValue(error);

      await expect(metricsService.createSpan('test-operation', testFn)).rejects.toThrow('Test error');

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 2, message: 'Test error' });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    test('should execute function without tracing when tracer not available', () => {
      metricsService.tracer = null;
      const testFn = jest.fn().mockReturnValue('result');

      const result = metricsService.createSpan('test-operation', testFn);

      expect(testFn).toHaveBeenCalled();
      expect(result).toBe('result');
      expect(mockTracer.startActiveSpan).not.toHaveBeenCalled();
    });
  });

  describe('getActiveUserCount', () => {
    test('should return placeholder value', async () => {
      // Reset any spies before testing the actual method
      if (jest.isMockFunction(metricsService.getActiveUserCount)) {
        metricsService.getActiveUserCount.mockRestore();
      }
      
      const count = await metricsService.getActiveUserCount();
      expect(count).toBe(0);
    });
  });

  describe('getMetricsSummary', () => {
    test('should return comprehensive metrics summary', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const summary = await metricsService.getMetricsSummary();

      expect(summary).toEqual({
        timestamp: expect.any(String),
        memory: {
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          rss: expect.any(Number),
          external: expect.any(Number)
        },
        process: {
          uptime: expect.any(Number),
          pid: expect.any(Number),
          version: expect.any(String)
        },
        environment: 'test'
      });

      expect(new Date(summary.timestamp)).toBeInstanceOf(Date);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('error handling', () => {
    test('should handle missing counters gracefully', () => {
      metricsService.counters = {};
      
      expect(() => metricsService.recordBookingCreated()).not.toThrow();
      expect(() => metricsService.recordApiRequest()).not.toThrow();
    });

    test('should handle missing histograms gracefully', () => {
      metricsService.histograms = {};
      
      expect(() => metricsService.recordRequestDuration(0.5)).not.toThrow();
      expect(() => metricsService.recordDatabaseQueryDuration(0.1)).not.toThrow();
    });

    test('should handle missing gauges gracefully', () => {
      metricsService.gauges = {};
      
      expect(() => metricsService.updateActiveConnections(10)).not.toThrow();
      expect(() => metricsService.updateQueueSize(5)).not.toThrow();
    });
  });
});