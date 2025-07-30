/**
 * Calendar service comprehensive unit tests
 *
 * Tests the actual calendar service implementation with proper mocking
 * of external dependencies
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');

// Mock external dependencies BEFORE importing the service
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn()
    },
    calendar: jest.fn()
  }
}));

jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: jest.fn()
  }
}));

jest.mock('node-fetch');

// Import dependencies after mocking
const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
const fetch = require('node-fetch');
const { formatISO, addSeconds } = require('date-fns');

// Import test helpers
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import the actual service after all mocks are set up
const {
  createCalendarEvent,
  getGoogleAuthClient,
  getMicrosoftGraphClient,
  getGoogleBusyTimes,
  getMicrosoftBusyTimes,
  getAllBusyTimes
} = require('../../../src/services/calendar.service');

// Import models
const { User, CalendarToken } = require('../../../src/models');
const logger = require('../../../src/config/logger');

describe('Calendar Service Comprehensive Tests', () => {
  const userId = 'test-user-id';
  const mockBooking = {
    id: 'booking-id',
    userId: 'test-user-id',
    customerName: 'Test Customer',
    customerEmail: 'customer@example.com',
    startTime: '2024-02-01T10:00:00Z',
    endTime: '2024-02-01T11:00:00Z',
    status: 'confirmed',
    description: 'Test meeting'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'https://meetabl.example.com/auth/google/callback';
    process.env.MICROSOFT_CLIENT_ID = 'microsoft-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'microsoft-client-secret';
    process.env.MICROSOFT_REDIRECT_URI = 'https://meetabl.example.com/auth/microsoft/callback';

    // Mock logger to prevent console output during tests
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
  });

  describe('getGoogleAuthClient', () => {
    test('should return OAuth2 client with valid token', async () => {
      // Mock valid Google token
      const mockToken = {
        id: 'token-id',
        userId: userId,
        provider: 'google',
        accessToken: 'valid-access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        save: jest.fn().mockResolvedValue(true)
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock OAuth2 constructor
      const mockOAuth2Client = {
        setCredentials: jest.fn()
      };
      google.auth.OAuth2.mockImplementationOnce(() => mockOAuth2Client);

      const result = await getGoogleAuthClient(userId);

      expect(CalendarToken.findOne).toHaveBeenCalledWith({
        where: { user_id: userId, provider: 'google' }
      });
      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        'google-client-id',
        'google-client-secret',
        'https://meetabl.example.com/auth/google/callback'
      );
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: 'valid-access-token',
        refresh_token: 'refresh-token'
      });
      expect(result).toBe(mockOAuth2Client);
    });

    test('should throw error when Google Calendar not connected', async () => {
      CalendarToken.findOne.mockResolvedValueOnce(null);

      await expect(getGoogleAuthClient(userId))
        .rejects.toThrow('Google Calendar not connected');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting Google auth client'),
        expect.any(Error)
      );
    });

    test('should refresh expired token', async () => {
      // Mock expired token
      const mockToken = {
        id: 'token-id',
        userId: userId,
        provider: 'google',
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        save: jest.fn().mockResolvedValue(true)
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock OAuth2 client with refresh functionality
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-access-token',
            expires_in: 3600
          }
        })
      };
      google.auth.OAuth2.mockImplementation(() => mockOAuth2Client);

      const result = await getGoogleAuthClient(userId);

      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(mockToken.save).toHaveBeenCalled();
      expect(mockToken.accessToken).toBe('new-access-token');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Refreshed Google token')
      );
    });

    test('should handle token refresh failure', async () => {
      // Mock expired token
      const mockToken = {
        id: 'token-id',
        userId: userId,
        provider: 'google',
        accessToken: 'expired-access-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: new Date(Date.now() - 3600000),
        save: jest.fn().mockResolvedValue(true)
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock OAuth2 client that fails to refresh
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockRejectedValue(new Error('Token refresh failed'))
      };
      google.auth.OAuth2.mockImplementation(() => mockOAuth2Client);

      await expect(getGoogleAuthClient(userId))
        .rejects.toThrow('Token refresh failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Error refreshing Google token:',
        expect.any(Error)
      );
    });
  });

  describe('getMicrosoftGraphClient', () => {
    test('should return Graph client with valid token', async () => {
      // Mock valid Microsoft token
      const mockToken = {
        id: 'token-id',
        userId: userId,
        provider: 'microsoft',
        accessToken: 'valid-ms-access-token',
        refreshToken: 'ms-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn().mockResolvedValue(true)
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock Microsoft Graph client
      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        post: jest.fn(),
        get: jest.fn()
      };
      Client.init.mockReturnValueOnce(mockGraphClient);

      const result = await getMicrosoftGraphClient(userId);

      expect(CalendarToken.findOne).toHaveBeenCalledWith({
        where: { user_id: userId, provider: 'microsoft' }
      });
      expect(Client.init).toHaveBeenCalledWith({
        authProvider: expect.any(Function)
      });
      expect(result).toBe(mockGraphClient);
    });

    test('should throw error when Microsoft Calendar not connected', async () => {
      CalendarToken.findOne.mockResolvedValueOnce(null);

      await expect(getMicrosoftGraphClient(userId))
        .rejects.toThrow('Microsoft Calendar not connected');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting Microsoft Graph client'),
        expect.any(Error)
      );
    });

    test('should refresh expired Microsoft token', async () => {
      // Mock expired token
      const mockToken = {
        id: 'token-id',
        userId: userId,
        provider: 'microsoft',
        accessToken: 'expired-ms-token',
        refreshToken: 'ms-refresh-token',
        expiresAt: new Date(Date.now() - 3600000),
        save: jest.fn().mockResolvedValue(true)
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock successful token refresh
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'new-ms-access-token',
          refresh_token: 'new-ms-refresh-token',
          expires_in: 3600
        })
      });

      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        post: jest.fn(),
        get: jest.fn()
      };
      Client.init.mockReturnValueOnce(mockGraphClient);

      await getMicrosoftGraphClient(userId);

      expect(fetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );
      expect(mockToken.save).toHaveBeenCalled();
      expect(mockToken.accessToken).toBe('new-ms-access-token');
    });

    test('should handle Microsoft token refresh failure', async () => {
      // Mock expired token
      const mockToken = {
        id: 'token-id',
        userId: userId,
        provider: 'microsoft',
        accessToken: 'expired-ms-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: new Date(Date.now() - 3600000),
        save: jest.fn().mockResolvedValue(true)
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock failed token refresh
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400
      });

      await expect(getMicrosoftGraphClient(userId))
        .rejects.toThrow('Microsoft token refresh failed: 400');

      expect(logger.error).toHaveBeenCalledWith(
        'Error refreshing Microsoft token:',
        expect.any(Error)
      );
    });
  });

  describe('createCalendarEvent', () => {
    test('should create Google Calendar event successfully', async () => {
      // Mock user with Google calendar
      const mockUser = {
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        calendar_provider: 'google'
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      // Mock Google Calendar token
      const mockToken = {
        accessToken: 'google-token',
        refreshToken: 'google-refresh',
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn()
      };
      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock OAuth2 client and calendar API
      const mockCalendarAPI = {
        events: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: 'google-event-123',
              htmlLink: 'https://calendar.google.com/event/123'
            }
          })
        }
      };
      const mockOAuth2Client = { setCredentials: jest.fn() };
      google.auth.OAuth2.mockImplementationOnce(() => mockOAuth2Client);
      google.calendar.mockReturnValueOnce(mockCalendarAPI);

      const result = await createCalendarEvent(mockBooking);

      expect(User.findOne).toHaveBeenCalledWith({
        where: { id: mockBooking.userId }
      });
      expect(mockCalendarAPI.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        resource: {
          summary: 'Meeting with Test Customer',
          description: 'Test meeting',
          start: {
            dateTime: '2024-02-01T10:00:00.000Z',
            timeZone: 'America/New_York'
          },
          end: {
            dateTime: '2024-02-01T11:00:00.000Z',
            timeZone: 'America/New_York'
          },
          attendees: [{ email: 'customer@example.com' }]
        },
        sendUpdates: 'all'
      });
      expect(result.id).toBe('google-event-123');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Google Calendar event created')
      );
    });

    test('should create Microsoft Calendar event successfully', async () => {
      // Mock user with Microsoft calendar
      const mockUser = {
        id: userId,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        timezone: 'UTC',
        calendar_provider: 'microsoft'
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      // Mock Microsoft token
      const mockToken = {
        accessToken: 'ms-token',
        refreshToken: 'ms-refresh',
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn()
      };
      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock Microsoft Graph client
      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        post: jest.fn().mockResolvedValue({
          id: 'ms-event-456',
          webLink: 'https://outlook.office.com/calendar/event/456'
        })
      };
      Client.init.mockReturnValueOnce(mockGraphClient);

      const result = await createCalendarEvent(mockBooking);

      expect(mockGraphClient.api).toHaveBeenCalledWith('/me/events');
      expect(mockGraphClient.post).toHaveBeenCalledWith({
        subject: 'Meeting with Test Customer',
        body: {
          contentType: 'text',
          content: 'Test meeting'
        },
        start: {
          dateTime: '2024-02-01T10:00:00.000Z',
          timeZone: 'UTC'
        },
        end: {
          dateTime: '2024-02-01T11:00:00.000Z',
          timeZone: 'UTC'
        },
        attendees: [{
          emailAddress: { address: 'customer@example.com' },
          type: 'required'
        }]
      });
      expect(result.id).toBe('ms-event-456');
    });

    test('should return null when user has no calendar provider', async () => {
      const mockUser = {
        id: userId,
        calendar_provider: 'none'
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      const result = await createCalendarEvent(mockBooking);

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('No calendar provider configured')
      );
    });

    test('should return null when user not found', async () => {
      User.findOne.mockResolvedValueOnce(null);

      const result = await createCalendarEvent(mockBooking);

      expect(result).toBeNull();
    });

    test('should handle Google Calendar API errors', async () => {
      const mockUser = {
        id: userId,
        calendar_provider: 'google',
        timezone: 'UTC'
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      const mockToken = {
        accessToken: 'google-token',
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn()
      };
      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock calendar API to throw error
      const mockCalendarAPI = {
        events: {
          insert: jest.fn().mockRejectedValue(new Error('Google API error'))
        }
      };
      google.auth.OAuth2.mockImplementationOnce(() => ({ setCredentials: jest.fn() }));
      google.calendar.mockReturnValueOnce(mockCalendarAPI);

      await expect(createCalendarEvent(mockBooking))
        .rejects.toThrow('Google API error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error creating Google Calendar event:',
        expect.any(Error)
      );
    });
  });

  describe('getGoogleBusyTimes', () => {
    test('should fetch Google Calendar busy times successfully', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      // Mock Google auth client
      const mockToken = {
        accessToken: 'google-token',
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn()
      };
      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      const mockCalendarAPI = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: {
              items: [
                {
                  id: 'event-1',
                  start: { dateTime: '2024-02-01T10:00:00Z' },
                  end: { dateTime: '2024-02-01T11:00:00Z' },
                  status: 'confirmed'
                },
                {
                  id: 'event-2',
                  start: { dateTime: '2024-02-01T14:00:00Z' },
                  end: { dateTime: '2024-02-01T15:00:00Z' },
                  status: 'confirmed'
                },
                {
                  id: 'event-3',
                  start: { dateTime: '2024-02-01T16:00:00Z' },
                  end: { dateTime: '2024-02-01T17:00:00Z' },
                  status: 'cancelled' // Should be filtered out
                }
              ]
            }
          })
        }
      };

      google.auth.OAuth2.mockImplementationOnce(() => ({ setCredentials: jest.fn() }));
      google.calendar.mockReturnValueOnce(mockCalendarAPI);

      const result = await getGoogleBusyTimes(userId, startTime, endTime);

      expect(mockCalendarAPI.events.list).toHaveBeenCalledWith({
        calendarId: 'primary',
        timeMin: '2024-02-01T09:00:00.000Z',
        timeMax: '2024-02-01T17:00:00.000Z',
        singleEvents: true,
        orderBy: 'startTime'
      });

      expect(result).toHaveLength(2); // Cancelled event filtered out
      expect(result[0]).toEqual({
        start: new Date('2024-02-01T10:00:00Z'),
        end: new Date('2024-02-01T11:00:00Z')
      });
      expect(result[1]).toEqual({
        start: new Date('2024-02-01T14:00:00Z'),
        end: new Date('2024-02-01T15:00:00Z')
      });
    });

    test('should handle Google Calendar API errors', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      // Mock auth client that throws error
      CalendarToken.findOne.mockRejectedValueOnce(new Error('Token not found'));

      await expect(getGoogleBusyTimes(userId, startTime, endTime))
        .rejects.toThrow('Token not found');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting Google busy times'),
        expect.any(Error)
      );
    });
  });

  describe('getMicrosoftBusyTimes', () => {
    test('should fetch Microsoft Calendar busy times successfully', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      // Mock Microsoft Graph client
      const mockToken = {
        accessToken: 'ms-token',
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn()
      };
      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          value: [
            {
              id: 'ms-event-1',
              start: { dateTime: '2024-02-01T10:00:00Z' },
              end: { dateTime: '2024-02-01T11:00:00Z' },
              isCancelled: false
            },
            {
              id: 'ms-event-2',
              start: { dateTime: '2024-02-01T14:00:00Z' },
              end: { dateTime: '2024-02-01T15:00:00Z' },
              isCancelled: true // Should be filtered out
            }
          ]
        })
      };
      Client.init.mockReturnValueOnce(mockGraphClient);

      const result = await getMicrosoftBusyTimes(userId, startTime, endTime);

      expect(mockGraphClient.api).toHaveBeenCalledWith('/me/events');
      expect(mockGraphClient.filter).toHaveBeenCalledWith(
        "start/dateTime ge '2024-02-01T09:00:00.000Z' and end/dateTime le '2024-02-01T17:00:00.000Z'"
      );
      expect(mockGraphClient.select).toHaveBeenCalledWith('start,end,subject,isCancelled');

      expect(result).toHaveLength(1); // Cancelled event filtered out
      expect(result[0]).toEqual({
        start: new Date('2024-02-01T10:00:00Z'),
        end: new Date('2024-02-01T11:00:00Z')
      });
    });
  });

  describe('getAllBusyTimes', () => {
    test('should combine busy times from all connected calendars', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      // Mock tokens for both providers
      const mockTokens = [
        { provider: 'google', accessToken: 'google-token', expiresAt: new Date(Date.now() + 3600000), save: jest.fn() },
        { provider: 'microsoft', accessToken: 'ms-token', expiresAt: new Date(Date.now() + 3600000), save: jest.fn() }
      ];
      CalendarToken.findAll.mockResolvedValueOnce(mockTokens);

      // Mock Google busy times
      CalendarToken.findOne
        .mockResolvedValueOnce(mockTokens[0]) // For getGoogleBusyTimes
        .mockResolvedValueOnce(mockTokens[1]); // For getMicrosoftBusyTimes

      // Mock Google Calendar API
      const mockGoogleCalendarAPI = {
        events: {
          list: jest.fn().mockResolvedValue({
            data: {
              items: [{
                start: { dateTime: '2024-02-01T10:00:00Z' },
                end: { dateTime: '2024-02-01T11:00:00Z' },
                status: 'confirmed'
              }]
            }
          })
        }
      };
      google.auth.OAuth2.mockImplementation(() => ({ setCredentials: jest.fn() }));
      google.calendar.mockReturnValue(mockGoogleCalendarAPI);

      // Mock Microsoft Graph API
      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          value: [{
            start: { dateTime: '2024-02-01T14:00:00Z' },
            end: { dateTime: '2024-02-01T15:00:00Z' },
            isCancelled: false
          }]
        })
      };
      Client.init.mockReturnValue(mockGraphClient);

      const result = await getAllBusyTimes(userId, startTime, endTime);

      expect(CalendarToken.findAll).toHaveBeenCalledWith({
        where: { user_id: userId }
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        start: new Date('2024-02-01T10:00:00Z'),
        end: new Date('2024-02-01T11:00:00Z')
      });
      expect(result[1]).toEqual({
        start: new Date('2024-02-01T14:00:00Z'),
        end: new Date('2024-02-01T15:00:00Z')
      });
    });

    test('should continue if one calendar provider fails', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      // Mock tokens for both providers
      const mockTokens = [
        { provider: 'google', accessToken: 'google-token', expiresAt: new Date(Date.now() + 3600000), save: jest.fn() },
        { provider: 'microsoft', accessToken: 'ms-token', expiresAt: new Date(Date.now() + 3600000), save: jest.fn() }
      ];
      CalendarToken.findAll.mockResolvedValueOnce(mockTokens);

      // Mock Google to fail, Microsoft to succeed
      CalendarToken.findOne
        .mockRejectedValueOnce(new Error('Google auth failed')) // Google fails
        .mockResolvedValueOnce(mockTokens[1]); // Microsoft succeeds

      // Mock Microsoft Graph API (Google won't be called due to auth failure)
      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          value: [{
            start: { dateTime: '2024-02-01T14:00:00Z' },
            end: { dateTime: '2024-02-01T15:00:00Z' },
            isCancelled: false
          }]
        })
      };
      Client.init.mockReturnValue(mockGraphClient);

      const result = await getAllBusyTimes(userId, startTime, endTime);

      expect(result).toHaveLength(1); // Only Microsoft events
      expect(result[0]).toEqual({
        start: new Date('2024-02-01T14:00:00Z'),
        end: new Date('2024-02-01T15:00:00Z')
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching google calendar'),
        expect.any(Error)
      );
    });

    test('should return empty array when no calendars connected', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      CalendarToken.findAll.mockResolvedValueOnce([]);

      const result = await getAllBusyTimes(userId, startTime, endTime);

      expect(result).toEqual([]);
    });

    test('should handle general errors', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      CalendarToken.findAll.mockRejectedValueOnce(new Error('Database error'));

      await expect(getAllBusyTimes(userId, startTime, endTime))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting all busy times'),
        expect.any(Error)
      );
    });
  });
});