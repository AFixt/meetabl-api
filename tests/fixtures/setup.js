/**
 * Test setup file for optimized parallel execution
 *
 * Global setup and teardown for tests with worker isolation
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');

// Generate unique test identifier for this worker
const TEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';
const TEST_RUN_ID = uuidv4().substring(0, 8);

// Mock environment variables with worker-specific values
process.env.JWT_SECRET = 'TestJwtSecret123WithUpperLowerAndNumbers32Chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.JWT_REFRESH_SECRET = 'TestJwtRefreshSecret123With32CharsMinimum';
process.env.SESSION_SECRET = 'TestSessionSecret123With32CharactersMinimum';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4000/api/calendar/google/callback';
process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
process.env.MICROSOFT_REDIRECT_URI = 'http://localhost:4000/api/calendar/microsoft/callback';

// Additional required environment variables
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:5173';
process.env.EMAIL_FROM = 'test@meetabl.com';
process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@meetabl.com';
process.env.EMAIL_PASS = 'test-password';
process.env.TWILIO_ACCOUNT_SID = 'test-twilio-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.STRIPE_SECRET_KEY = 'sk_test_1234567890';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_1234567890';

// Configure test database with worker isolation
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = `:memory:${TEST_WORKER_ID}`;
process.env.TEST_DB_PREFIX = `test_w${TEST_WORKER_ID}_${TEST_RUN_ID}`;

// Worker-specific configurations
process.env.REDIS_DB = `${TEST_WORKER_ID}`; // Use different Redis DB per worker
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Extended timeout for E2E tests
jest.setTimeout(30000);

// Make sure Node.js knows we're in test mode
process.env.NODE_ENV = 'test';

// express-status-monitor package has been removed

// Mock logger module with complete implementation
jest.mock('../../src/config/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
    child: jest.fn().mockReturnThis(),
    auditLog: jest.fn(),
    business: jest.fn(),
    security: jest.fn(),
    performance: jest.fn()
  };
  
  return {
    ...mockLogger,
    default: mockLogger,
    createLogger: jest.fn(() => mockLogger),
    auditLogger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    config: {
      level: 'error',
      enableConsole: false,
      enableFile: false,
      enableAudit: false
    }
  };
});

// Mock telemetry module
jest.mock('../../src/config/telemetry', () => {
  const mockTelemetry = {
    recordMetric: jest.fn(),
    recordEvent: jest.fn(),
    recordError: jest.fn(),
    recordDuration: jest.fn(),
    recordGauge: jest.fn(),
    recordHistogram: jest.fn(),
    startSpan: jest.fn(() => ({
      end: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      setAttribute: jest.fn(),
      setAttributes: jest.fn()
    })),
    shutdown: jest.fn().mockResolvedValue(),
    flush: jest.fn().mockResolvedValue()
  };
  
  return {
    ...mockTelemetry,
    default: mockTelemetry,
    telemetry: mockTelemetry,
    TelemetryManager: jest.fn(() => mockTelemetry)
  };
});

// Mock database configuration to use test database
jest.mock('../../src/config/database', () => {
  if (process.env.NODE_ENV === 'test') {
    return require('../../src/config/database-test');
  }
  return require('../../src/config/database-mysql');
});

// Mock external services when in test environment
if (process.env.NODE_ENV === 'test') {
  jest.mock('googleapis', () => {
    const { mockGoogleCalendarClient } = require('./mocks');
    return {
      google: {
        auth: {
          OAuth2: jest.fn().mockImplementation(() => ({
            generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth'),
            getToken: jest.fn().mockResolvedValue({
              tokens: {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token',
                expires_in: 3600,
                scope: 'https://www.googleapis.com/auth/calendar'
              }
            }),
            setCredentials: jest.fn(),
            refreshAccessToken: jest.fn().mockResolvedValue({
              credentials: {
                access_token: 'new-access-token',
                expires_in: 3600
              }
            })
          }))
        },
        calendar: mockGoogleCalendarClient
      }
    };
  });

  jest.mock('@microsoft/microsoft-graph-client', () => {
    const { mockMicrosoftGraphClient } = require('./mocks');
    return {
      Client: {
        init: jest.fn().mockImplementation(mockMicrosoftGraphClient)
      }
    };
  });

  jest.mock('node-fetch', () => jest.fn().mockImplementation(() => Promise.resolve({
    ok: true,
    json: jest.fn().mockResolvedValue({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      scope: 'Calendars.ReadWrite offline_access'
    })
  })));

  // Mock AWS SDK
  jest.mock('aws-sdk', () => ({
    S3: jest.fn().mockImplementation(() => ({
      upload: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://test-bucket.s3.amazonaws.com/test-file.pdf',
          Key: 'test-file.pdf',
          Bucket: 'test-bucket'
        })
      }),
      deleteObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      }),
      getObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Body: Buffer.from('test file content')
        })
      })
    })),
    config: {
      update: jest.fn()
    }
  }));

  // Mock Nodemailer
  jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({
        messageId: 'test-message-id',
        accepted: ['test@example.com'],
        rejected: [],
        response: '250 Message accepted'
      }),
      verify: jest.fn().mockResolvedValue(true)
    })
  }));

  // Mock Twilio
  jest.mock('twilio', () => {
    return jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          sid: 'test-message-sid',
          status: 'sent',
          to: '+1234567890',
          from: '+0987654321',
          body: 'Test SMS message'
        })
      }
    }));
  });

  // Mock Stripe
  jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
      customers: {
        create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
        update: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
        del: jest.fn().mockResolvedValue({ deleted: true })
      },
      subscriptions: {
        create: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' }),
        update: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' }),
        cancel: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'canceled' })
      },
      paymentMethods: {
        create: jest.fn().mockResolvedValue({ id: 'pm_test123' }),
        attach: jest.fn().mockResolvedValue({ id: 'pm_test123' }),
        detach: jest.fn().mockResolvedValue({ id: 'pm_test123' })
      },
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test123' } }
        })
      }
    }));
  });
}

// Global test isolation setup
beforeAll(async () => {
  // Verify test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must run in test environment');
  }
});

// Clean up after each test for better isolation
afterEach(async () => {
  // Clear any pending timers or intervals
  jest.clearAllTimers();
  
  // Reset modules to prevent state leakage between tests
  jest.resetModules();
  
  // Clear any cached require modules
  Object.keys(require.cache).forEach(key => {
    if (key.includes('/src/') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
});

// Global cleanup
afterAll(async () => {
  // Clean up any remaining resources
  if (global.testSequelize) {
    await global.testSequelize.close();
  }
  
  // Clear any timers
  jest.clearAllTimers();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});
