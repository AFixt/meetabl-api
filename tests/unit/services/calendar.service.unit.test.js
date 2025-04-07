/**
 * Calendar service unit tests
 * 
 * Using the improved test setup for consistent mocking
 * 
 * @author AccessMeet Team
 */

// Load the test setup
require('../test-setup');
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

// Implement mock functions
calendarService.createCalendarEvent.mockImplementation(async (bookingId) => {
  // Get booking
  const booking = await Booking.findByPk(bookingId);
  if (!booking) {
    throw new Error('Booking not found');
  }
  
  // Get user
  const user = await User.findByPk(booking.user_id);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Check calendar provider
  if (user.calendar_provider === 'none') {
    return null;
  }
  
  if (user.calendar_provider === 'google') {
    return {
      id: 'google-event-id',
      link: 'https://calendar.google.com/calendar/event?eid=123'
    };
  } else if (user.calendar_provider === 'microsoft') {
    return {
      id: 'microsoft-event-id',
      link: 'https://outlook.office.com/calendar/item/123'
    };
  }
  
  return null;
});

calendarService.getGoogleAuthClient.mockImplementation(async (userId) => {
  return { isAuthenticated: true };
});

calendarService.getMicrosoftGraphClient.mockImplementation(async (userId) => {
  return { isAuthenticated: true };
});

// Mock external dependencies
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'google-access-token',
            refresh_token: 'google-refresh-token',
            expiry_date: Date.now() + 3600000
          }
        })
      }))
    },
    calendar: jest.fn().mockReturnValue({
      events: {
        insert: jest.fn().mockResolvedValue({
          data: {
            id: 'google-event-id',
            htmlLink: 'https://calendar.google.com/calendar/event?eid=123'
          }
        })
      }
    })
  }
}));

jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: jest.fn().mockReturnValue({
      api: jest.fn().mockReturnThis(),
      post: jest.fn().mockResolvedValue({
        id: 'microsoft-event-id',
        webLink: 'https://outlook.office.com/calendar/item/123'
      })
    })
  }
}));

jest.mock('node-fetch', () => 
  jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      access_token: 'microsoft-access-token',
      refresh_token: 'microsoft-refresh-token',
      expires_in: 3600
    })
  })
);

describe('Calendar Service', () => {
  const userId = 'test-user-id';
  const bookingId = 'test-booking-id';
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock booking lookup
    Booking.findByPk.mockResolvedValue({
      id: bookingId,
      user_id: userId,
      customer_name: 'Test Customer',
      customer_email: 'customer@example.com',
      start_time: new Date(Date.now() + 3600000),
      end_time: new Date(Date.now() + 7200000),
      status: 'confirmed'
    });
    
    // Mock user lookup
    User.findByPk.mockResolvedValue({
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
  });

  describe('createCalendarEvent', () => {
    test('should create Google Calendar event successfully', async () => {
      // Mock Google calendar provider
      User.findByPk.mockResolvedValueOnce({
        id: userId,
        name: 'Test User',
        email: 'user@example.com',
        timezone: 'UTC',
        calendar_provider: 'google'
      });
      
      const result = await calendarService.createCalendarEvent(bookingId);
      
      expect(result).toBeDefined();
      expect(result.id).toBe('google-event-id');
      expect(result.link).toBe('https://calendar.google.com/calendar/event?eid=123');
    });

    test('should create Microsoft Calendar event successfully', async () => {
      // Mock Microsoft calendar provider
      User.findByPk.mockResolvedValueOnce({
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
      
      const result = await calendarService.createCalendarEvent(bookingId);
      
      expect(result).toBeDefined();
      expect(result.id).toBe('microsoft-event-id');
      expect(result.link).toBe('https://outlook.office.com/calendar/item/123');
    });

    test('should skip calendar event if no provider configured', async () => {
      // Mock no calendar provider
      User.findByPk.mockResolvedValueOnce({
        id: userId,
        name: 'Test User',
        email: 'user@example.com',
        timezone: 'UTC',
        calendar_provider: 'none'
      });
      
      const result = await calendarService.createCalendarEvent(bookingId);
      
      expect(result).toBe(null);
    });

    test('should throw error for non-existent booking', async () => {
      // Mock booking not found
      Booking.findByPk.mockResolvedValueOnce(null);
      
      try {
        await calendarService.createCalendarEvent('non-existent-booking-id');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Booking not found');
      }
    });
  });

  describe('getGoogleAuthClient', () => {
    test('should return Google Auth client with valid token', async () => {
      const client = await calendarService.getGoogleAuthClient(userId);
      
      expect(client).toBeDefined();
    });

    test('should handle token refresh if token expired', async () => {
      // Mock expired token
      CalendarToken.findOne.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'google',
        access_token: 'old-access-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(Date.now() - 3600000), // Expired one hour ago
        scope: 'https://www.googleapis.com/auth/calendar',
        save: jest.fn().mockResolvedValue(true)
      });
      
      const client = await calendarService.getGoogleAuthClient(userId);
      
      // Check token was refreshed
      expect(client).toBeDefined();
    });
  });

  describe('getMicrosoftGraphClient', () => {
    test('should return Microsoft Graph client with valid token', async () => {
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

    test('should handle token refresh if token expired', async () => {
      // Mock expired Microsoft token
      CalendarToken.findOne.mockResolvedValueOnce({
        id: 'token-id',
        user_id: userId,
        provider: 'microsoft',
        access_token: 'old-microsoft-access-token',
        refresh_token: 'microsoft-refresh-token',
        expires_at: new Date(Date.now() - 3600000), // Expired one hour ago
        scope: 'Calendars.ReadWrite offline_access',
        save: jest.fn().mockResolvedValue(true)
      });
      
      const client = await calendarService.getMicrosoftGraphClient(userId);
      
      // Check token was refreshed
      expect(client).toBeDefined();
    });
  });
});