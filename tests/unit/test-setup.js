/**
 * Shared test setup for all unit tests
 *
 * This file configures all the necessary mocks for unit tests
 *
 * @author meetabl Team
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Configure SQLite for testing
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

// Mock logger
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock modules that might access external services
jest.mock('googleapis', () => ({
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
        setCredentials: jest.fn()
      }))
    },
    calendar: jest.fn().mockReturnValue({
      events: {
        insert: jest.fn().mockResolvedValue({
          data: {
            id: 'test-event-id',
            htmlLink: 'https://calendar.google.com/event?id=123'
          }
        })
      }
    })
  }
}));

jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: jest.fn().mockImplementation(() => ({
      api: jest.fn().mockReturnThis(),
      post: jest.fn().mockResolvedValue({
        id: 'test-event-id',
        webLink: 'https://outlook.office.com/calendar/item/123'
      })
    }))
  }
}));

jest.mock('node-fetch', () => jest.fn().mockImplementation(() => Promise.resolve({
  ok: true,
  json: jest.fn().mockResolvedValue({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    scope: 'Calendars.ReadWrite offline_access'
  })
})));

// Capture console errors during tests
let originalConsoleError;
beforeAll(() => {
  originalConsoleError = console.error;
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Define global test utilities
global.createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: { id: 'test-user-id' },
  ...overrides
});

global.createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

global.createMockNext = () => jest.fn();
