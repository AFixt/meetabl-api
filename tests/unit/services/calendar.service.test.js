/**
 * Calendar service tests
 * 
 * @author AccessMeet Team
 */

const { 
  createCalendarEvent,
  getGoogleAuthClient,
  getMicrosoftGraphClient
} = require('../../../src/services/calendar.service');
const logger = require('../../../src/config/logger');
const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
const { 
  setupTestDatabase, 
  clearDatabase, 
  createTestUser, 
  createBooking,
  createCalendarToken
} = require('../../fixtures/db');

describe('Calendar Service', () => {
  let user;
  let booking;

  // Setup and teardown
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    user = await createTestUser();
    booking = await createBooking(user.id);
  });

  afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
  });

  describe('getGoogleAuthClient', () => {
    test('should get Google auth client successfully', async () => {
      // Create calendar token
      await createCalendarToken(user.id, 'google');
      
      const authClient = await getGoogleAuthClient(user.id);
      
      expect(authClient).toBeDefined();
      expect(google.auth.OAuth2).toHaveBeenCalled();
      expect(authClient.setCredentials).toHaveBeenCalled();
    });

    test('should throw error if no token exists', async () => {
      try {
        await getGoogleAuthClient(user.id);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('not connected');
      }
    });
  });

  describe('getMicrosoftGraphClient', () => {
    test('should get Microsoft Graph client successfully', async () => {
      // Create calendar token
      await createCalendarToken(user.id, 'microsoft');
      
      const graphClient = await getMicrosoftGraphClient(user.id);
      
      expect(graphClient).toBeDefined();
      expect(Client.init).toHaveBeenCalled();
    });

    test('should throw error if no token exists', async () => {
      try {
        await getMicrosoftGraphClient(user.id);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('not connected');
      }
    });
  });

  describe('createCalendarEvent', () => {
    test('should return null if user has no calendar provider', async () => {
      // User with no calendar_provider
      const result = await createCalendarEvent(booking);
      
      expect(result).toBeNull();
    });

    test('should create Google Calendar event successfully', async () => {
      // Update user to use Google Calendar
      user.calendar_provider = 'google';
      await user.save();
      
      // Create calendar token
      await createCalendarToken(user.id, 'google');
      
      const result = await createCalendarEvent(booking);
      
      expect(result).toBeDefined();
      expect(google.calendar).toHaveBeenCalled();
    });

    test('should create Microsoft Calendar event successfully', async () => {
      // Update user to use Microsoft Calendar
      user.calendar_provider = 'microsoft';
      await user.save();
      
      // Create calendar token
      await createCalendarToken(user.id, 'microsoft');
      
      const result = await createCalendarEvent(booking);
      
      expect(result).toBeDefined();
      expect(Client.init).toHaveBeenCalled();
    });

    test('should handle errors gracefully', async () => {
      // Update user to use Google Calendar
      user.calendar_provider = 'google';
      await user.save();
      
      // Create calendar token
      await createCalendarToken(user.id, 'google');
      
      // Force an error by mocking getGoogleAuthClient
      const originalGetGoogleAuthClient = getGoogleAuthClient;
      
      // Mock implementation
      const mockGetGoogleAuthClient = jest.fn().mockRejectedValue(
        new Error('Test error')
      );
      
      // Replace real implementation with mock
      const calendarService = require('../../../src/services/calendar.service');
      calendarService.getGoogleAuthClient = mockGetGoogleAuthClient;
      
      // Spy on logger
      const errorSpy = jest.spyOn(logger, 'error');
      
      try {
        await createCalendarEvent(booking);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(errorSpy).toHaveBeenCalled();
      }
      
      // Restore original implementation
      calendarService.getGoogleAuthClient = originalGetGoogleAuthClient;
    });
  });
});