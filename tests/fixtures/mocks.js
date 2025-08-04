/**
 * Mock implementations for testing
 *
 * Provides mock functions for external services
 *
 * @author meetabl Team
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate auth token for test user
 * @param {string} userId - User ID
 * @param {string|object} options - JWT options or expiry string
 * @returns {string} JWT token
 */
const generateAuthToken = (userId, options = { expiresIn: '1h' }) => {
  const jwtOptions = typeof options === 'string'
    ? { expiresIn: options }
    : options;

  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'test-secret',
    jwtOptions
  );
};

/**
 * Create request object mock
 * @param {Object} overrides - Request properties to override
 * @returns {Object} Mocked request object
 */
const mockRequest = (overrides = {}) => {
  const req = {
    body: {},
    query: {},
    params: {},
    headers: {},
    cookies: {},
    ...overrides
  };
  return req;
};

/**
 * Create response object mock
 * @returns {Object} Mocked response object with jest spies
 */
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock Google Calendar API client
 * @returns {Object} Mocked Google Calendar client
 */
const mockGoogleCalendarClient = () => ({
  calendar: jest.fn().mockReturnValue({
    events: {
      insert: jest.fn().mockResolvedValue({
        data: {
          id: uuidv4(),
          htmlLink: 'https://calendar.google.com/event?id=123',
          summary: 'Test Event'
        }
      })
    }
  })
});

/**
 * Mock Microsoft Graph client
 * @returns {Object} Mocked Microsoft Graph client
 */
const mockMicrosoftGraphClient = () => ({
  api: jest.fn().mockReturnThis(),
  post: jest.fn().mockResolvedValue({
    id: uuidv4(),
    webLink: 'https://outlook.office.com/calendar/event/123',
    subject: 'Test Event'
  })
});

module.exports = {
  generateAuthToken,
  mockRequest,
  mockResponse,
  mockGoogleCalendarClient,
  mockMicrosoftGraphClient
};
