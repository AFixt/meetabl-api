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
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4000/api/calendar/google/callback';
process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
process.env.MICROSOFT_REDIRECT_URI = 'http://localhost:4000/api/calendar/microsoft/callback';

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

// Mock modules
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

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
