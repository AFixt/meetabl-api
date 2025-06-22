/**
 * Complete User Onboarding Workflow Integration Test
 *
 * Tests the full user onboarding experience including registration,
 * email verification, profile setup, and availability configuration
 */

const { request, utils, models } = require('../setup');
const app = require('../../../src/app');

describe('Complete User Onboarding Workflow', () => {
  beforeAll(async () => {
    await utils.resetDatabase();
  });

  afterAll(async () => {
    await utils.cleanup();
  });

  describe('Full onboarding journey', () => {
    let newUser;
    let authTokens;
    let verificationToken;

    test('Step 1: User registers with valid data', async () => {
      const registrationData = {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@example.com',
        password: 'SecurePassword123!',
        timezone: 'America/New_York'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(registrationData.email);
      expect(response.body.data.user.firstName).toBe(registrationData.firstName);
      expect(response.body.data.user.email_verified).toBe(false);

      newUser = response.body.data.user;
      authTokens = { accessToken: response.body.data.token };
    });

    test('Step 2: User can login with credentials', async () => {
      const loginData = {
        email: 'sarah.johnson@example.com',
        password: 'SecurePassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.id).toBe(newUser.id);

      authTokens.accessToken = response.body.data.token;
    });

    test('Step 3: User requests email verification', async () => {
      const response = await request(app)
        .post('/api/users/me/resend-verification')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verification');

      // Get verification token from database for testing
      const user = await models.User.findByPk(newUser.id);
      verificationToken = user.email_verification_token;
      expect(verificationToken).toBeTruthy();
    });

    test('Step 4: User verifies email with token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified');

      // Verify user is now verified in database
      const user = await models.User.findByPk(newUser.id);
      expect(user.email_verified).toBe(true);
      expect(user.email_verification_token).toBeNull();
    });

    test('Step 5: User updates profile information', async () => {
      const profileData = {
        firstName: 'Sarah Elizabeth',
        lastName: 'Johnson-Smith',
        timezone: 'America/Los_Angeles'
      };

      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(profileData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(profileData.firstName);
      expect(response.body.data.lastName).toBe(profileData.lastName);
      expect(response.body.data.timezone).toBe(profileData.timezone);
    });

    test('Step 6: User sets up availability rules', async () => {
      const availabilityRules = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isAvailable: true }, // Monday
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isAvailable: true }, // Tuesday
        { dayOfWeek: 3, startTime: '10:00', endTime: '16:00', isAvailable: true }, // Wednesday
        { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isAvailable: true }, // Thursday
        { dayOfWeek: 5, startTime: '09:00', endTime: '15:00', isAvailable: true }  // Friday
      ];

      for (const rule of availabilityRules) {
        const response = await request(app)
          .post('/api/availability/rules')
          .set('Authorization', `Bearer ${authTokens.accessToken}`)
          .send(rule)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.dayOfWeek).toBe(rule.dayOfWeek);
        expect(response.body.data.startTime).toBe(rule.startTime);
        expect(response.body.data.endTime).toBe(rule.endTime);
      }

      // Verify all rules were created
      const response = await request(app)
        .get('/api/availability/rules')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(5);
    });

    test('Step 7: User configures booking settings', async () => {
      const settingsData = {
        bookingSlotDuration: 60, // 1 hour
        bufferTime: 15, // 15 minutes
        maxAdvanceBookingDays: 60,
        minAdvanceBookingHours: 48,
        isPubliclyBookable: true
      };

      const response = await request(app)
        .put('/api/users/me/settings')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(settingsData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookingSlotDuration).toBe(settingsData.bookingSlotDuration);
      expect(response.body.data.isPubliclyBookable).toBe(settingsData.isPubliclyBookable);
    });

    test('Step 8: Verify user can view their complete profile', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('Sarah Elizabeth');
      expect(response.body.data.email_verified).toBe(true);
      expect(response.body.data.timezone).toBe('America/Los_Angeles');
    });

    test('Step 9: User can view available time slots', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/availability/slots?date=${dateStr}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      // Should have available slots based on the rules we created
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('Step 10: External user can view public booking page', async () => {
      // First get the user's public username or ID for the booking URL
      const userResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      const userId = userResponse.body.data.id;

      // Test public booking availability
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3); // 3 days ahead to meet min advance booking
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/bookings/public/${userId}/availability?date=${dateStr}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Error handling during onboarding', () => {
    test('Registration fails with invalid email', async () => {
      const invalidData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'invalid-email',
        password: 'SecurePassword123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });

    test('Registration fails with weak password', async () => {
      const weakPasswordData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });

    test('Availability rule creation fails with invalid time range', async () => {
      const user = await utils.createTestUser();
      const tokens = utils.generateAuthTokens(user);

      const invalidRule = {
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '09:00', // End before start
        isAvailable: true
      };

      const response = await request(app)
        .post('/api/availability/rules')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send(invalidRule)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});