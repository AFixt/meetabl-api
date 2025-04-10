/**
 * Test setup file
 * 
 * Global setup and teardown for tests
 * 
 * @author meetabl Team
 */

// Mock environment variables
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

// Configure test database
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

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