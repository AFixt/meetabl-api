/**
 * Calendar service real unit tests
 *
 * Tests the actual calendar service implementation with minimal mocking
 *
 * @author meetabl Team
 */

// Mock external dependencies before importing anything
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

// Mock models with simple implementations
jest.mock('../../../src/models', () => ({
  User: {
    findOne: jest.fn()
  },
  CalendarToken: {
    findOne: jest.fn(),
    findAll: jest.fn()
  }
}));

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Import mocked dependencies
const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
const fetch = require('node-fetch');
const { User, CalendarToken } = require('../../../src/models');
const logger = require('../../../src/config/logger');

// Import the service after all mocks are set up
const calendarService = require('../../../src/services/calendar.service');

describe('Calendar Service Real Implementation Tests', () => {
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set required environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'https://test.com/google/callback';
    process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
    process.env.MICROSOFT_REDIRECT_URI = 'https://test.com/microsoft/callback';
  });

  describe('getGoogleAuthClient', () => {
    test('should successfully get Google auth client with valid token', async () => {
      const mockToken = {
        user_id: userId,
        provider: 'google',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(Date.now() + 3600000) // Future date
      };

      const mockOAuthClient = {
        setCredentials: jest.fn()
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      google.auth.OAuth2.mockReturnValueOnce(mockOAuthClient);

      const result = await calendarService.getGoogleAuthClient(userId);

      expect(CalendarToken.findOne).toHaveBeenCalledWith({
        where: { user_id: userId, provider: 'google' }
      });
      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        'test-google-client-id',
        'test-google-client-secret',
        'https://test.com/google/callback'
      );
      expect(mockOAuthClient.setCredentials).toHaveBeenCalledWith({
        access_token: 'valid-token',
        refresh_token: 'refresh-token'
      });
      expect(result).toBe(mockOAuthClient);
    });

    test('should throw error when Google Calendar not connected', async () => {
      CalendarToken.findOne.mockResolvedValueOnce(null);

      await expect(calendarService.getGoogleAuthClient(userId))
        .rejects.toThrow('Google Calendar not connected');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting Google auth client'),
        expect.any(Error)
      );
    });

    test('should refresh expired Google token', async () => {
      const mockToken = {
        user_id: userId,
        provider: 'google',
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(Date.now() - 3600000), // Past date
        save: jest.fn().mockResolvedValue(true)
      };

      const mockOAuthClient = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-access-token',
            expires_in: 3600
          }
        })
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      google.auth.OAuth2.mockReturnValue(mockOAuthClient);

      const result = await calendarService.getGoogleAuthClient(userId);

      expect(mockOAuthClient.refreshAccessToken).toHaveBeenCalled();
      expect(mockToken.save).toHaveBeenCalled();
      expect(mockToken.access_token).toBe('new-access-token');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Refreshed Google token')
      );
    });

    test('should handle token refresh errors', async () => {
      const mockToken = {
        user_id: userId,
        provider: 'google',
        access_token: 'expired-token',
        refresh_token: 'invalid-refresh-token',
        expires_at: new Date(Date.now() - 3600000),
        save: jest.fn()
      };

      const mockOAuthClient = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockRejectedValue(new Error('Refresh failed'))
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      google.auth.OAuth2.mockReturnValue(mockOAuthClient);

      await expect(calendarService.getGoogleAuthClient(userId))
        .rejects.toThrow('Refresh failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Error refreshing Google token:',
        expect.any(Error)
      );
    });
  });

  describe('getMicrosoftGraphClient', () => {
    test('should successfully get Microsoft Graph client with valid token', async () => {
      const mockToken = {
        user_id: userId,
        provider: 'microsoft',
        access_token: 'valid-ms-token',
        refresh_token: 'ms-refresh-token',
        expires_at: new Date(Date.now() + 3600000)
      };

      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        get: jest.fn(),
        post: jest.fn()
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      Client.init.mockReturnValueOnce(mockGraphClient);

      const result = await calendarService.getMicrosoftGraphClient(userId);

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

      await expect(calendarService.getMicrosoftGraphClient(userId))
        .rejects.toThrow('Microsoft Calendar not connected');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting Microsoft Graph client'),
        expect.any(Error)
      );
    });

    test('should refresh expired Microsoft token', async () => {
      const mockToken = {
        user_id: userId,
        provider: 'microsoft',
        access_token: 'expired-ms-token',
        refresh_token: 'ms-refresh-token',
        expires_at: new Date(Date.now() - 3600000),
        save: jest.fn().mockResolvedValue(true)
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock successful fetch response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'new-ms-access-token',
          refresh_token: 'new-ms-refresh-token',
          expires_in: 3600
        })
      });

      const mockGraphClient = { api: jest.fn() };
      Client.init.mockReturnValueOnce(mockGraphClient);

      await calendarService.getMicrosoftGraphClient(userId);

      expect(fetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );
      expect(mockToken.save).toHaveBeenCalled();
      expect(mockToken.access_token).toBe('new-ms-access-token');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Refreshed Microsoft token')
      );
    });

    test('should handle Microsoft token refresh failure', async () => {
      const mockToken = {
        user_id: userId,
        provider: 'microsoft',
        access_token: 'expired-ms-token',
        refresh_token: 'invalid-refresh-token',
        expires_at: new Date(Date.now() - 3600000),
        save: jest.fn()
      };

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);

      // Mock failed fetch response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400
      });

      await expect(calendarService.getMicrosoftGraphClient(userId))
        .rejects.toThrow('Microsoft token refresh failed: 400');

      expect(logger.error).toHaveBeenCalledWith(
        'Error refreshing Microsoft token:',
        expect.any(Error)
      );
    });
  });

  describe('createCalendarEvent', () => {
    const mockBooking = {
      id: 'booking-123',
      userId: 'user-123',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      start_time: '2024-02-01T10:00:00Z',
      end_time: '2024-02-01T11:00:00Z',
      description: 'Test meeting'
    };

    test('should create Google Calendar event successfully', async () => {
      const mockUser = {
        id: 'user-123',
        firstName: 'Jane',
        lastName: 'Smith',
        timezone: 'America/New_York',
        calendar_provider: 'google'
      };

      const mockToken = {
        access_token: 'google-token',
        refresh_token: 'google-refresh',
        expires_at: new Date(Date.now() + 3600000)
      };

      const mockOAuthClient = {
        setCredentials: jest.fn()
      };

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

      User.findOne.mockResolvedValueOnce(mockUser);
      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      google.auth.OAuth2.mockReturnValueOnce(mockOAuthClient);
      google.calendar.mockReturnValueOnce(mockCalendarAPI);

      const result = await calendarService.createCalendarEvent(mockBooking);

      expect(User.findOne).toHaveBeenCalledWith({
        where: { id: mockBooking.userId }
      });
      expect(mockCalendarAPI.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        resource: expect.objectContaining({
          summary: 'Meeting with John Doe',
          description: 'Test meeting',
          start: expect.objectContaining({
            timeZone: 'America/New_York'
          }),
          end: expect.objectContaining({
            timeZone: 'America/New_York'
          }),
          attendees: [{ email: 'john@example.com' }]
        }),
        sendUpdates: 'all'
      });
      expect(result.id).toBe('google-event-123');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Google Calendar event created')
      );
    });

    test('should create Microsoft Calendar event successfully', async () => {
      const mockUser = {
        id: 'user-123',
        firstName: 'Jane',
        lastName: 'Smith',
        timezone: 'UTC',
        calendar_provider: 'microsoft'
      };

      const mockToken = {
        access_token: 'ms-token',
        refresh_token: 'ms-refresh',
        expires_at: new Date(Date.now() + 3600000)
      };

      const mockGraphClient = {
        api: jest.fn().mockReturnThis(),
        post: jest.fn().mockResolvedValue({
          id: 'ms-event-456',
          webLink: 'https://outlook.office.com/calendar/event/456'
        })
      };

      User.findOne.mockResolvedValueOnce(mockUser);
      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      Client.init.mockReturnValueOnce(mockGraphClient);

      const result = await calendarService.createCalendarEvent(mockBooking);

      expect(mockGraphClient.api).toHaveBeenCalledWith('/me/events');
      expect(mockGraphClient.post).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'Meeting with John Doe',
        body: {
          contentType: 'text',
          content: 'Test meeting'
        },
        start: expect.objectContaining({
          timeZone: 'UTC'
        }),
        end: expect.objectContaining({
          timeZone: 'UTC'
        }),
        attendees: [{
          emailAddress: { address: 'john@example.com' },
          type: 'required'
        }]
      }));
      expect(result.id).toBe('ms-event-456');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Microsoft Calendar event created')
      );
    });

    test('should return null when user has no calendar provider', async () => {
      const mockUser = {
        id: 'user-123',
        calendar_provider: 'none'
      };

      User.findOne.mockResolvedValueOnce(mockUser);

      const result = await calendarService.createCalendarEvent(mockBooking);

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('No calendar provider configured')
      );
    });

    test('should return null when user not found', async () => {
      User.findOne.mockResolvedValueOnce(null);

      const result = await calendarService.createCalendarEvent(mockBooking);

      expect(result).toBeNull();
    });

    test('should handle Google Calendar API errors', async () => {
      const mockUser = {
        id: 'user-123',
        calendar_provider: 'google',
        timezone: 'UTC'
      };

      const mockToken = {
        access_token: 'google-token',
        expires_at: new Date(Date.now() + 3600000)
      };

      const mockOAuthClient = { setCredentials: jest.fn() };
      const mockCalendarAPI = {
        events: {
          insert: jest.fn().mockRejectedValue(new Error('Google API error'))
        }
      };

      User.findOne.mockResolvedValueOnce(mockUser);
      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      google.auth.OAuth2.mockReturnValueOnce(mockOAuthClient);
      google.calendar.mockReturnValueOnce(mockCalendarAPI);

      await expect(calendarService.createCalendarEvent(mockBooking))
        .rejects.toThrow('Google API error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating calendar event'),
        expect.any(Error)
      );
    });
  });

  describe('getGoogleBusyTimes', () => {
    test('should fetch Google Calendar busy times successfully', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      const mockToken = {
        access_token: 'google-token',
        expires_at: new Date(Date.now() + 3600000)
      };

      const mockOAuthClient = { setCredentials: jest.fn() };
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

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      google.auth.OAuth2.mockReturnValueOnce(mockOAuthClient);
      google.calendar.mockReturnValueOnce(mockCalendarAPI);

      const result = await calendarService.getGoogleBusyTimes(userId, startTime, endTime);

      expect(mockCalendarAPI.events.list).toHaveBeenCalledWith(expect.objectContaining({
        calendarId: 'primary',
        singleEvents: true,
        orderBy: 'startTime'
      }));

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

      CalendarToken.findOne.mockRejectedValueOnce(new Error('Token not found'));

      await expect(calendarService.getGoogleBusyTimes(userId, startTime, endTime))
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

      const mockToken = {
        access_token: 'ms-token',
        expires_at: new Date(Date.now() + 3600000)
      };

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

      CalendarToken.findOne.mockResolvedValueOnce(mockToken);
      Client.init.mockReturnValueOnce(mockGraphClient);

      const result = await calendarService.getMicrosoftBusyTimes(userId, startTime, endTime);

      expect(mockGraphClient.api).toHaveBeenCalledWith('/me/events');
      expect(mockGraphClient.filter).toHaveBeenCalledWith(
        expect.stringContaining("start/dateTime ge") && expect.stringContaining("end/dateTime le")
      );
      expect(mockGraphClient.select).toHaveBeenCalledWith('start,end,subject,isCancelled');

      expect(result).toHaveLength(1); // Cancelled event filtered out
      expect(result[0]).toEqual({
        start: new Date('2024-02-01T10:00:00Z'),
        end: new Date('2024-02-01T11:00:00Z')
      });
    });

    test('should handle Microsoft Calendar API errors', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      CalendarToken.findOne.mockRejectedValueOnce(new Error('Token not found'));

      await expect(calendarService.getMicrosoftBusyTimes(userId, startTime, endTime))
        .rejects.toThrow('Token not found');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting Microsoft busy times'),
        expect.any(Error)
      );
    });
  });

  describe('getAllBusyTimes', () => {
    test('should combine busy times from all connected calendars', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      // Mock tokens for both providers
      const mockTokens = [
        { provider: 'google', access_token: 'google-token', expires_at: new Date(Date.now() + 3600000) },
        { provider: 'microsoft', access_token: 'ms-token', expires_at: new Date(Date.now() + 3600000) }
      ];

      CalendarToken.findAll.mockResolvedValueOnce(mockTokens);

      // Mock individual token lookups for busy time queries
      CalendarToken.findOne
        .mockResolvedValueOnce(mockTokens[0]) // Google
        .mockResolvedValueOnce(mockTokens[1]); // Microsoft

      // Mock Google Calendar API
      const mockGoogleOAuth = { setCredentials: jest.fn() };
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

      google.auth.OAuth2.mockReturnValue(mockGoogleOAuth);
      google.calendar.mockReturnValue(mockGoogleCalendarAPI);
      Client.init.mockReturnValue(mockGraphClient);

      const result = await calendarService.getAllBusyTimes(userId, startTime, endTime);

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

      const mockTokens = [
        { provider: 'google', access_token: 'google-token' },
        { provider: 'microsoft', access_token: 'ms-token', expires_at: new Date(Date.now() + 3600000) }
      ];

      CalendarToken.findAll.mockResolvedValueOnce(mockTokens);

      // Mock Google to fail, Microsoft to succeed
      CalendarToken.findOne
        .mockRejectedValueOnce(new Error('Google auth failed'))
        .mockResolvedValueOnce(mockTokens[1]);

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

      const result = await calendarService.getAllBusyTimes(userId, startTime, endTime);

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

      const result = await calendarService.getAllBusyTimes(userId, startTime, endTime);

      expect(result).toEqual([]);
    });

    test('should handle general errors', async () => {
      const startTime = new Date('2024-02-01T09:00:00Z');
      const endTime = new Date('2024-02-01T17:00:00Z');

      CalendarToken.findAll.mockRejectedValueOnce(new Error('Database error'));

      await expect(calendarService.getAllBusyTimes(userId, startTime, endTime))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting all busy times'),
        expect.any(Error)
      );
    });
  });
});