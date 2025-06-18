/**
 * Calendar Integration Workflow Test
 *
 * Tests the complete calendar integration flow with Google and Microsoft
 *
 * @author meetabl Team
 */

const { request, utils, models } = require('../setup');
const app = require('../../../src/app');

// Mock external calendar services
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock=true'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock-google-access-token',
            refresh_token: 'mock-google-refresh-token',
            expiry_date: Date.now() + 3600000
          }
        }),
        setCredentials: jest.fn()
      }))
    },
    calendar: jest.fn().mockReturnValue({
      events: {
        insert: jest.fn().mockResolvedValue({
          data: {
            id: 'google-event-123',
            htmlLink: 'https://calendar.google.com/event?eid=123'
          }
        }),
        delete: jest.fn().mockResolvedValue({})
      }
    })
  }
}));

jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: jest.fn().mockReturnValue({
      api: jest.fn().mockReturnThis(),
      post: jest.fn().mockResolvedValue({
        id: 'microsoft-event-456',
        webLink: 'https://outlook.office.com/calendar/item/456'
      }),
      delete: jest.fn().mockResolvedValue({})
    })
  }
}));

describe('Calendar Integration Workflow', () => {
  let user;
  let userTokens;
  let booking;

  beforeAll(async () => {
    await utils.resetDatabase();

    // Create test user
    user = await utils.createTestUser({
      firstName: 'Calendar',
      lastName: 'User',
      email: 'calendar@example.com',
      username: 'calendaruser'
    });

    userTokens = utils.generateAuthTokens(user);
  });

  afterAll(async () => {
    await utils.cleanup();
  });

  describe('Google Calendar Integration', () => {
    test('Step 1: Get Google authorization URL', async () => {
      const response = await request(app)
        .get('/api/calendar/google/auth')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toContain('accounts.google.com');
      expect(response.body.data.authUrl).toContain('mock=true');
    });

    test('Step 2: Handle Google OAuth callback', async () => {
      // Simulate OAuth callback
      const response = await request(app)
        .get('/api/calendar/google/callback')
        .query({
          code: 'mock-auth-code',
          state: userTokens.accessToken
        })
        .expect(302);

      // Should redirect to success page
      expect(response.headers.location).toContain('success=true');

      // Verify calendar token was stored
      const calendarToken = await models.CalendarToken.findOne({
        where: {
          userId: user.id,
          provider: 'google'
        }
      });

      expect(calendarToken).toBeTruthy();
      expect(calendarToken.accessToken).toBe('mock-google-access-token');
      expect(calendarToken.refreshToken).toBe('mock-google-refresh-token');
    });

    test('Step 3: Update user calendar preference', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({
          calendarProvider: 'google'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.calendarProvider).toBe('google');
    });

    test('Step 4: Create booking with Google Calendar sync', async () => {
      const bookingData = {
        title: 'Team Meeting',
        description: 'Weekly team sync',
        startTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 days from now
        endTime: new Date(Date.now() + 48 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
        attendeeName: 'John Attendee',
        attendeeEmail: 'attendee@example.com',
        location: 'Google Meet'
      };

      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.externalCalendarId).toBe('google-event-123');
      expect(response.body.data.externalCalendarLink).toContain('calendar.google.com');
      booking = response.body.data;
    });

    test('Step 5: Verify calendar connection status', async () => {
      const response = await request(app)
        .get('/api/calendar/status')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connections).toHaveLength(1);
      expect(response.body.data.connections[0].provider).toBe('google');
      expect(response.body.data.connections[0].isActive).toBe(true);
    });
  });

  describe('Microsoft Calendar Integration', () => {
    test('Step 1: Get Microsoft authorization URL', async () => {
      const response = await request(app)
        .get('/api/calendar/microsoft/auth')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toBeTruthy();
    });

    test('Step 2: Simulate Microsoft OAuth callback', async () => {
      // Mock Microsoft token exchange
      jest.spyOn(require('node-fetch'), 'default').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'mock-microsoft-access-token',
          refresh_token: 'mock-microsoft-refresh-token',
          expires_in: 3600
        })
      });

      const response = await request(app)
        .get('/api/calendar/microsoft/callback')
        .query({
          code: 'mock-microsoft-auth-code',
          state: userTokens.accessToken
        })
        .expect(302);

      // Should redirect to success page
      expect(response.headers.location).toContain('success=true');

      // Verify both calendar tokens exist
      const calendarTokens = await models.CalendarToken.findAll({
        where: { userId: user.id }
      });

      expect(calendarTokens).toHaveLength(2);
      const providers = calendarTokens.map(t => t.provider);
      expect(providers).toContain('google');
      expect(providers).toContain('microsoft');
    });

    test('Step 3: Switch to Microsoft Calendar', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({
          calendarProvider: 'microsoft'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.calendarProvider).toBe('microsoft');
    });

    test('Step 4: Create booking with Microsoft Calendar sync', async () => {
      const bookingData = {
        title: 'Client Meeting',
        description: 'Quarterly review',
        startTime: new Date(Date.now() + 72 * 60 * 60 * 1000), // 3 days from now
        endTime: new Date(Date.now() + 72 * 60 * 60 * 1000 + 90 * 60 * 1000), // 1.5 hours later
        attendeeName: 'Jane Client',
        attendeeEmail: 'client@example.com',
        location: 'Microsoft Teams'
      };

      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.externalCalendarId).toBe('microsoft-event-456');
      expect(response.body.data.externalCalendarLink).toContain('outlook.office.com');
    });
  });

  describe('Calendar Disconnection', () => {
    test('Step 1: Disconnect Google Calendar', async () => {
      const response = await request(app)
        .delete('/api/calendar/google/disconnect')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disconnected');

      // Verify token was removed
      const googleToken = await models.CalendarToken.findOne({
        where: {
          userId: user.id,
          provider: 'google'
        }
      });
      expect(googleToken).toBeNull();
    });

    test('Step 2: Disconnect Microsoft Calendar', async () => {
      const response = await request(app)
        .delete('/api/calendar/microsoft/disconnect')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify all calendar tokens are removed
      const remainingTokens = await models.CalendarToken.findAll({
        where: { userId: user.id }
      });
      expect(remainingTokens).toHaveLength(0);
    });

    test('Step 3: Verify calendar status shows no connections', async () => {
      const response = await request(app)
        .get('/api/calendar/status')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connections).toHaveLength(0);
    });

    test('Step 4: Create booking without calendar sync', async () => {
      // Update user to have no calendar provider
      await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({
          calendarProvider: 'none'
        })
        .expect(200);

      // Create booking
      const bookingData = {
        title: 'Manual Booking',
        description: 'No calendar sync',
        startTime: new Date(Date.now() + 96 * 60 * 60 * 1000), // 4 days from now
        endTime: new Date(Date.now() + 96 * 60 * 60 * 1000 + 60 * 60 * 1000),
        attendeeName: 'Manual Attendee',
        attendeeEmail: 'manual@example.com'
      };

      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.externalCalendarId).toBeNull();
      expect(response.body.data.externalCalendarLink).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('Handle calendar sync failure gracefully', async () => {
      // Mock calendar API failure
      const { google } = require('googleapis');
      google.calendar().events.insert.mockRejectedValueOnce(new Error('Calendar API Error'));

      // Set user back to Google calendar
      await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({ calendarProvider: 'google' })
        .expect(200);

      // Re-add Google token
      await models.CalendarToken.create({
        userId: user.id,
        provider: 'google',
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        expiresAt: new Date(Date.now() + 3600000)
      });

      // Create booking - should succeed even if calendar sync fails
      const bookingData = {
        title: 'Booking with Failed Sync',
        startTime: new Date(Date.now() + 120 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 120 * 60 * 60 * 1000 + 60 * 60 * 1000),
        attendeeName: 'Test Attendee',
        attendeeEmail: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.externalCalendarId).toBeNull();
      // Should include warning about calendar sync failure
      expect(response.body.warning).toContain('calendar sync failed');
    });
  });
});