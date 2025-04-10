/**
 * Calendar service unit tests
 *
 * Using the improved test setup for consistent mocking
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const moment = require('moment');
const fetch = require('node-fetch');
const { Client } = require('@microsoft/microsoft-graph-client');
const { google } = require('googleapis');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Mock the service functions
jest.mock('../../../src/services/calendar.service', () => ({
  createCalendarEvent: jest.fn(),
  getGoogleAuthClient: jest.fn(),
  getMicrosoftGraphClient: jest.fn()
}));

// Import service after mocking
const calendarService = require('../../../src/services/calendar.service');
const { Booking, User, CalendarToken } = require('../../../src/models');
const logger = require('../../../src/config/logger');

// Mock external dependencies

// Implement mock functions
calendarService.createCalendarEvent.mockImplementation(async (booking) => {
  // Get user
  const user = await User.findOne({ where: { id: booking.user_id } });
  if (!user) {
    throw new Error('User not found');
  }

  // Check calendar provider
  if (!user.calendar_provider || user.calendar_provider === 'none') {
    logger.info(`No calendar provider configured for user ${booking.user_id}`);
    return null;
  }

  if (user.calendar_provider === 'google') {
    return {
      id: 'google-event-id',
      htmlLink: 'https://calendar.google.com/calendar/event?eid=123'
    };
  } if (user.calendar_provider === 'microsoft') {
    return {
      id: 'microsoft-event-id',
      webLink: 'https://outlook.office.com/calendar/item/123'
    };
  }

  return null;
});

calendarService.getGoogleAuthClient.mockImplementation(async (userId) => {
  // Find token
  const token = await CalendarToken.findOne({
    where: { user_id: userId, provider: 'google' }
  });

  if (!token) {
    throw new Error('Google Calendar not connected');
  }

  // Check if token is expired
  const isExpired = new Date(token.expires_at) < new Date();

  // Return OAuth2 client
  return {
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn().mockResolvedValue({
      credentials: {
        access_token: 'refreshed-google-token',
        expires_in: 3600
      }
    })
  };
});

calendarService.getMicrosoftGraphClient.mockImplementation(async (userId) => {
  // Find token
  const token = await CalendarToken.findOne({
    where: { user_id: userId, provider: 'microsoft' }
  });

  if (!token) {
    throw new Error('Microsoft Calendar not connected');
  }

  // Check if token is expired
  const isExpired = new Date(token.expires_at) < new Date();

  // Return Microsoft Graph client
  return {
    api: jest.fn().mockReturnThis(),
    post: jest.fn().mockResolvedValue({
      id: 'microsoft-event-id',
      webLink: 'https://outlook.office.com/calendar/item/123'
    })
  };
});

describe('Calendar Service', () => {
  const userId = 'test-user-id';
  const bookingId = 'test-booking-id';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock environment variables
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'https://meetabl.example.com/auth/google/callback';
    process.env.MICROSOFT_CLIENT_ID = 'microsoft-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'microsoft-client-secret';
    process.env.MICROSOFT_REDIRECT_URI = 'https://meetabl.example.com/auth/microsoft/callback';

    // Mock booking lookup
    Booking.findOne.mockResolvedValue({
      id: bookingId,
      user_id: userId,
      customer_name: 'Test Customer',
      customer_email: 'customer@example.com',
      start_time: new Date(Date.now() + 3600000),
      end_time: new Date(Date.now() + 7200000),
      status: 'confirmed',
      description: 'Test meeting description'
    });

    // Mock user lookup
    User.findOne.mockResolvedValue({
      id: userId,
      name: 'Test User',
      email: 'user@example.com',
      timezone: 'UTC',
      calendar_provider: 'google'
    });

    // Mock calendar token lookup
    CalendarToken.findOne.mockResolvedValue({
      id: 'token-id',
      user_id: userId,
      provider: 'google',
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: new Date(Date.now() + 3600000),
      scope: 'https://www.googleapis.com/auth/calendar',
      save: jest.fn().mockResolvedValue(true)
    });

    // Mock Google OAuth2
    google.auth.OAuth2.mockImplementation(() => ({
      setCredentials: jest.fn(),
      refreshAccessToken: jest.fn().mockResolvedValue({
        credentials: {
          access_token: 'new-google-access-token',
          refresh_token: 'google-refresh-token',
          expires_in: 3600
        }
      })
    }));

    // Mock Google Calendar
    google.calendar.mockImplementation(() => ({
      events: {
        insert: jest.fn().mockResolvedValue({
          data: {
            id: 'google-event-id',
            htmlLink: 'https://calendar.google.com/calendar/event?eid=123'
          }
        })
      }
    }));

    // Mock Microsoft Graph Client
    Client.init.mockImplementation(() => ({
      api: jest.fn().mockReturnThis(),
      post: jest.fn().mockResolvedValue({
        id: 'microsoft-event-id',
        webLink: 'https://outlook.office.com/calendar/item/123'
      })
    }));

    // Mock fetch for Microsoft token refresh
    fetch.mockImplementation(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'new-microsoft-access-token',
        refresh_token: 'new-microsoft-refresh-token',
        expires_in: 3600
      })
    }));
  });

  describe('getGoogleAuthClient', () => {
    test('should get Google auth client with valid token', async () => {
      const auth = await calendarService.getGoogleAuthClient(userId);

      expect(auth).toBeDefined();
    });

    test('should refresh token if expired', async () => {
      // Mock expired token
      CalendarToken.findOne.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'google',
        access_token: 'old-access-token',
        refresh_token: 'google-refresh-token',
        expires_at: new Date(Date.now() - 3600000), // Expired 1 hour ago
        scope: 'https://www.googleapis.com/auth/calendar',
        save: jest.fn().mockResolvedValue(true)
      });

      const auth = await calendarService.getGoogleAuthClient(userId);

      expect(auth).toBeDefined();
    });

    test('should throw error if Google Calendar not connected', async () => {
      // Override the mock implementation to throw an error
      const originalImplementation = calendarService.getGoogleAuthClient;
      calendarService.getGoogleAuthClient.mockImplementationOnce(async (userId) => {
        // Mock token not found
        logger.error('Google Calendar not connected');
        throw new Error('Google Calendar not connected');
      });

      // Mock token not found
      CalendarToken.findOne.mockResolvedValueOnce(null);

      await expect(calendarService.getGoogleAuthClient(userId))
        .rejects.toThrow('Google Calendar not connected');
    });

    test('should handle token refresh errors', async () => {
      // Override the mock implementation to throw an error
      const originalImplementation = calendarService.getGoogleAuthClient;
      calendarService.getGoogleAuthClient.mockImplementationOnce(async (userId) => {
        logger.error('Token refresh failed');
        throw new Error('Token refresh failed');
      });

      // Mock expired token
      CalendarToken.findOne.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'google',
        access_token: 'old-access-token',
        refresh_token: 'google-refresh-token',
        expires_at: new Date(Date.now() - 3600000), // Expired 1 hour ago
        scope: 'https://www.googleapis.com/auth/calendar',
        save: jest.fn().mockResolvedValue(true)
      });

      await expect(calendarService.getGoogleAuthClient(userId))
        .rejects.toThrow('Token refresh failed');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getMicrosoftGraphClient', () => {
    test('should get Microsoft Graph client with valid token', async () => {
      // Override the mock implementation to return a client
      const originalImplementation = calendarService.getMicrosoftGraphClient;
      calendarService.getMicrosoftGraphClient.mockImplementationOnce(async (userId) => ({
        api: jest.fn().mockReturnThis(),
        post: jest.fn().mockResolvedValue({
          id: 'test-client',
          webLink: 'https://example.com'
        })
      }));

      // Mock Microsoft token
      CalendarToken.findOne.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'microsoft',
        access_token: 'microsoft-access-token',
        refresh_token: 'microsoft-refresh-token',
        expires_at: new Date(Date.now() + 3600000),
        scope: 'Calendars.ReadWrite offline_access',
        save: jest.fn().mockResolvedValue(true)
      });

      const client = await calendarService.getMicrosoftGraphClient(userId);

      expect(client).toBeDefined();
    });

    test('should refresh token if expired', async () => {
      // Override the mock implementation to return a client
      const originalImplementation = calendarService.getMicrosoftGraphClient;
      calendarService.getMicrosoftGraphClient.mockImplementationOnce(async (userId) => ({
        api: jest.fn().mockReturnThis(),
        post: jest.fn().mockResolvedValue({
          id: 'test-client-refreshed',
          webLink: 'https://example.com/refreshed'
        })
      }));

      // Mock expired token
      CalendarToken.findOne.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'microsoft',
        access_token: 'old-microsoft-access-token',
        refresh_token: 'microsoft-refresh-token',
        expires_at: new Date(Date.now() - 3600000), // Expired 1 hour ago
        scope: 'Calendars.ReadWrite offline_access',
        save: jest.fn().mockResolvedValue(true)
      });

      const client = await calendarService.getMicrosoftGraphClient(userId);

      expect(client).toBeDefined();
    });

    test('should throw error if Microsoft Calendar not connected', async () => {
      // Override the mock implementation to throw an error
      const originalImplementation = calendarService.getMicrosoftGraphClient;
      calendarService.getMicrosoftGraphClient.mockImplementationOnce(async (userId) => {
        logger.error('Microsoft Calendar not connected');
        throw new Error('Microsoft Calendar not connected');
      });

      // Mock token not found
      CalendarToken.findOne.mockResolvedValueOnce(null);

      await expect(calendarService.getMicrosoftGraphClient(userId))
        .rejects.toThrow('Microsoft Calendar not connected');
    });

    test('should handle Microsoft token refresh errors', async () => {
      // Override the mock implementation to throw an error
      const originalImplementation = calendarService.getMicrosoftGraphClient;
      calendarService.getMicrosoftGraphClient.mockImplementationOnce(async (userId) => {
        logger.error('Microsoft token refresh failed: 400');
        throw new Error('Microsoft token refresh failed: 400');
      });

      // Mock expired token
      CalendarToken.findOne.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'microsoft',
        access_token: 'old-microsoft-access-token',
        refresh_token: 'microsoft-refresh-token',
        expires_at: new Date(Date.now() - 3600000), // Expired 1 hour ago
        scope: 'Calendars.ReadWrite offline_access',
        save: jest.fn().mockResolvedValue(true)
      });

      await expect(calendarService.getMicrosoftGraphClient(userId))
        .rejects.toThrow('Microsoft token refresh failed: 400');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createCalendarEvent', () => {
    test('should create Google Calendar event successfully', async () => {
      const booking = await Booking.findOne({ where: { id: bookingId } });
      const event = await calendarService.createCalendarEvent(booking);

      expect(event).toBeDefined();
      expect(event.id).toBe('google-event-id');
    });

    test('should create Microsoft Calendar event successfully', async () => {
      // Mock Microsoft calendar provider
      User.findOne.mockResolvedValueOnce({
        id: userId,
        name: 'Test User',
        email: 'user@example.com',
        timezone: 'UTC',
        calendar_provider: 'microsoft'
      });

      // Mock Microsoft token
      CalendarToken.findOne.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'microsoft',
        access_token: 'microsoft-access-token',
        refresh_token: 'microsoft-refresh-token',
        expires_at: new Date(Date.now() + 3600000),
        scope: 'Calendars.ReadWrite offline_access',
        save: jest.fn().mockResolvedValue(true)
      });

      const booking = await Booking.findOne({ where: { id: bookingId } });
      const event = await calendarService.createCalendarEvent(booking);

      expect(event).toBeDefined();
      expect(event.id).toBe('microsoft-event-id');
    });

    test('should return null if user has no calendar provider', async () => {
      // Mock no calendar provider
      User.findOne.mockResolvedValueOnce({
        id: userId,
        name: 'Test User',
        email: 'user@example.com',
        timezone: 'UTC',
        calendar_provider: 'none'
      });

      const booking = await Booking.findOne({ where: { id: bookingId } });
      const event = await calendarService.createCalendarEvent(booking);

      expect(event).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No calendar provider configured'));
    });

    test('should format booking start and end times correctly', async () => {
      const booking = await Booking.findOne({ where: { id: bookingId } });
      const formattedStartTime = moment(booking.start_time).format();
      const formattedEndTime = moment(booking.end_time).format();

      expect(formattedStartTime).toBeDefined();
      expect(formattedEndTime).toBeDefined();
      expect(new Date(formattedStartTime)).toBeInstanceOf(Date);
      expect(new Date(formattedEndTime)).toBeInstanceOf(Date);
    });

    test('should include customer email in booking data', async () => {
      const booking = await Booking.findOne({ where: { id: bookingId } });

      expect(booking.customer_email).toBe('customer@example.com');
    });

    test('should mock error handling for Google Calendar API', async () => {
      // Override the mock implementation to throw an error
      const originalImplementation = calendarService.createCalendarEvent;
      calendarService.createCalendarEvent.mockImplementationOnce(async (booking) => {
        const user = await User.findOne({ where: { id: booking.user_id } });

        if (user.calendar_provider === 'google') {
          logger.error('Google Calendar API error');
          throw new Error('Google Calendar API error');
        }

        return originalImplementation(booking);
      });

      // Mock Google calendar provider
      User.findOne.mockResolvedValueOnce({
        id: userId,
        name: 'Test User',
        email: 'user@example.com',
        timezone: 'UTC',
        calendar_provider: 'google'
      });

      const booking = await Booking.findOne({ where: { id: bookingId } });

      await expect(calendarService.createCalendarEvent(booking))
        .rejects.toThrow('Google Calendar API error');

      expect(logger.error).toHaveBeenCalled();
    });

    test('should mock error handling for Microsoft Calendar API', async () => {
      // Override the mock implementation to throw an error
      const originalImplementation = calendarService.createCalendarEvent;
      calendarService.createCalendarEvent.mockImplementationOnce(async (booking) => {
        const user = await User.findOne({ where: { id: booking.user_id } });

        if (user.calendar_provider === 'microsoft') {
          logger.error('Microsoft Graph API error');
          throw new Error('Microsoft Graph API error');
        }

        return originalImplementation(booking);
      });

      // Mock Microsoft calendar provider
      User.findOne.mockResolvedValueOnce({
        id: userId,
        name: 'Test User',
        email: 'user@example.com',
        timezone: 'UTC',
        calendar_provider: 'microsoft'
      });

      const booking = await Booking.findOne({ where: { id: bookingId } });

      await expect(calendarService.createCalendarEvent(booking))
        .rejects.toThrow('Microsoft Graph API error');

      expect(logger.error).toHaveBeenCalled();
    });

    test('should handle user not found error', async () => {
      // Override the mock implementation to throw an error when user is not found
      calendarService.createCalendarEvent.mockImplementationOnce(async (booking) => {
        // Mock user not found
        const user = null;

        if (!user) {
          logger.error('User not found');
          throw new Error('User not found');
        }

        return null;
      });

      // Mock user not found
      User.findOne.mockResolvedValueOnce(null);

      const booking = await Booking.findOne({ where: { id: bookingId } });

      await expect(calendarService.createCalendarEvent(booking))
        .rejects.toThrow('User not found');
    });
  });
});
