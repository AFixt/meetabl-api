/**
 * Calendar Routes Integration Tests
 * Tests for calendar integration endpoints
 */

const request = require('supertest');
const { getTestApp } = require('./test-app');
const { User, CalendarToken } = require('../../src/models');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

// Mock calendar services
jest.mock('../../src/services/calendar.service', () => ({
  getGoogleAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/oauth/authorize?...'),
  getMicrosoftAuthUrl: jest.fn().mockReturnValue('https://login.microsoftonline.com/oauth/authorize?...'),
  handleGoogleCallback: jest.fn().mockResolvedValue({
    accessToken: 'google-access-token',
    refreshToken: 'google-refresh-token',
    email: 'test@gmail.com'
  }),
  handleMicrosoftCallback: jest.fn().mockResolvedValue({
    accessToken: 'microsoft-access-token',
    refreshToken: 'microsoft-refresh-token',
    email: 'test@outlook.com'
  })
}));

// Mock subscription middleware
jest.mock('../../src/middlewares/subscription', () => ({
  requireIntegrations: (req, res, next) => next(),
  checkCalendarLimit: (req, res, next) => next()
}));

describe('Calendar Routes Integration Tests', () => {
  let app;
  let testUser;
  let authToken;
  let googleToken;
  let microsoftToken;

  beforeAll(async () => {
    // Initialize app
    app = await getTestApp();
    
    // Create test user
    testUser = await User.create({
      id: uuidv4(),
      firstName: 'Calendar',
      lastName: 'Test',
      email: 'calendar-test@meetabl.com',
      password: await bcrypt.hash('CalendarTest123!', 10),
      timezone: 'America/New_York',
      isActive: true,
      isEmailVerified: true
    });

    // Generate auth token
    authToken = jwt.sign(
      { 
        id: testUser.id, 
        email: testUser.email,
        type: 'access'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (googleToken || microsoftToken) {
      await CalendarToken.destroy({ where: { userId: testUser.id } });
    }
    if (testUser) {
      await User.destroy({ where: { id: testUser.id } });
    }
  });

  describe('GET /api/calendar/status', () => {
    beforeEach(async () => {
      // Create test calendar tokens
      googleToken = await CalendarToken.create({
        id: uuidv4(),
        userId: testUser.id,
        provider: 'google',
        accessToken: 'encrypted-google-access-token',
        refreshToken: 'encrypted-google-refresh-token',
        email: 'test@gmail.com',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
      });

      microsoftToken = await CalendarToken.create({
        id: uuidv4(),
        userId: testUser.id,
        provider: 'microsoft',
        accessToken: 'encrypted-microsoft-access-token',
        refreshToken: 'encrypted-microsoft-refresh-token',
        email: 'test@outlook.com',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000)
      });
    });

    it('should retrieve calendar integration status', async () => {
      const response = await request(app)
        .get('/api/calendar/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          calendars: expect.arrayContaining([
            expect.objectContaining({
              provider: 'google',
              email: 'test@gmail.com',
              isActive: true,
              isExpired: false
            }),
            expect.objectContaining({
              provider: 'microsoft',
              email: 'test@outlook.com',
              isActive: true,
              isExpired: false
            })
          ])
        }
      });
    });

    it('should indicate expired tokens', async () => {
      // Update one token to be expired
      await googleToken.update({
        expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
      });

      const response = await request(app)
        .get('/api/calendar/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const googleCalendar = response.body.data.calendars.find(cal => cal.provider === 'google');
      expect(googleCalendar.isExpired).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/calendar/status')
        .expect(401);
    });
  });

  describe('DELETE /api/calendar/disconnect/token/:tokenId', () => {
    it('should disconnect calendar by token ID', async () => {
      const response = await request(app)
        .delete(`/api/calendar/disconnect/token/${googleToken.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Calendar disconnected successfully'
      });

      // Verify token is deactivated
      const disconnectedToken = await CalendarToken.findByPk(googleToken.id);
      expect(disconnectedToken.isActive).toBe(false);
    });

    it('should return 404 for non-existent token', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .delete(`/api/calendar/disconnect/token/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Calendar token not found'
      });
    });

    it('should prevent disconnecting other user\'s calendar', async () => {
      // Create another user's token
      const otherUser = await User.create({
        id: uuidv4(),
        firstName: 'Other',
        lastName: 'User',
        email: 'other-calendar@meetabl.com',
        password: await bcrypt.hash('OtherUser123!', 10),
        timezone: 'America/New_York'
      });

      const otherToken = await CalendarToken.create({
        id: uuidv4(),
        userId: otherUser.id,
        provider: 'google',
        accessToken: 'other-access-token',
        refreshToken: 'other-refresh-token',
        email: 'other@gmail.com'
      });

      await request(app)
        .delete(`/api/calendar/disconnect/token/${otherToken.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      // Clean up
      await CalendarToken.destroy({ where: { id: otherToken.id } });
      await User.destroy({ where: { id: otherUser.id } });
    });
  });

  describe('DELETE /api/calendar/disconnect/:provider (legacy)', () => {
    it('should disconnect all calendars for a provider', async () => {
      const response = await request(app)
        .delete('/api/calendar/disconnect/google')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Calendar(s) disconnected successfully',
        data: {
          disconnectedCount: 1
        }
      });

      // Verify all Google tokens are deactivated
      const googleTokens = await CalendarToken.findAll({
        where: { userId: testUser.id, provider: 'google' }
      });
      expect(googleTokens.every(token => !token.isActive)).toBe(true);
    });

    it('should validate provider', async () => {
      const response = await request(app)
        .delete('/api/calendar/disconnect/invalid-provider')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid calendar provider'
      });
    });
  });

  describe('Google Calendar Integration', () => {
    describe('GET /api/calendar/google/status', () => {
      it('should return Google Calendar integration status', async () => {
        const response = await request(app)
          .get('/api/calendar/google/status')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            configured: true,
            scopes: expect.arrayContaining([
              'https://www.googleapis.com/auth/calendar.readonly',
              'https://www.googleapis.com/auth/calendar.events'
            ])
          }
        });
      });
    });

    describe('GET /api/calendar/google/auth', () => {
      it('should return Google OAuth authorization URL', async () => {
        const response = await request(app)
          .get('/api/calendar/google/auth')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            authUrl: expect.stringContaining('accounts.google.com')
          }
        });
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/calendar/google/auth')
          .expect(401);
      });
    });

    describe('GET /api/calendar/google/callback', () => {
      it('should handle Google OAuth callback', async () => {
        const response = await request(app)
          .get('/api/calendar/google/callback?code=test-auth-code&state=' + testUser.id)
          .expect(302);

        // Should redirect to frontend with success
        expect(response.headers.location).toContain('/calendar/connected?provider=google&status=success');
      });

      it('should handle callback errors', async () => {
        const response = await request(app)
          .get('/api/calendar/google/callback?error=access_denied&state=' + testUser.id)
          .expect(302);

        // Should redirect to frontend with error
        expect(response.headers.location).toContain('/calendar/connected?provider=google&status=error');
      });

      it('should validate state parameter', async () => {
        const response = await request(app)
          .get('/api/calendar/google/callback?code=test-auth-code')
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid or missing state parameter'
        });
      });
    });
  });

  describe('Microsoft Calendar Integration', () => {
    describe('GET /api/calendar/microsoft/status', () => {
      it('should return Microsoft Calendar integration status', async () => {
        const response = await request(app)
          .get('/api/calendar/microsoft/status')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            configured: true,
            scopes: expect.arrayContaining([
              'calendars.read',
              'calendars.readwrite'
            ])
          }
        });
      });
    });

    describe('GET /api/calendar/microsoft/auth', () => {
      it('should return Microsoft OAuth authorization URL', async () => {
        const response = await request(app)
          .get('/api/calendar/microsoft/auth')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            authUrl: expect.stringContaining('login.microsoftonline.com')
          }
        });
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/calendar/microsoft/auth')
          .expect(401);
      });
    });

    describe('GET /api/calendar/microsoft/callback', () => {
      it('should handle Microsoft OAuth callback', async () => {
        const response = await request(app)
          .get('/api/calendar/microsoft/callback?code=test-auth-code&state=' + testUser.id)
          .expect(302);

        // Should redirect to frontend with success
        expect(response.headers.location).toContain('/calendar/connected?provider=microsoft&status=success');
      });

      it('should handle callback errors', async () => {
        const response = await request(app)
          .get('/api/calendar/microsoft/callback?error=access_denied&state=' + testUser.id)
          .expect(302);

        // Should redirect to frontend with error
        expect(response.headers.location).toContain('/calendar/connected?provider=microsoft&status=error');
      });
    });
  });

  describe('Calendar Limit Enforcement', () => {
    beforeEach(() => {
      // Mock subscription middleware to enforce limits
      jest.resetModules();
      jest.doMock('../../src/middlewares/subscription', () => ({
        requireIntegrations: (req, res, next) => next(),
        checkCalendarLimit: (req, res, next) => {
          return res.status(403).json({
            success: false,
            error: 'Calendar limit reached for your subscription plan'
          });
        }
      }));
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('should enforce calendar limits', async () => {
      const response = await request(app)
        .get('/api/calendar/google/auth')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Calendar limit reached for your subscription plan'
      });
    });
  });
});