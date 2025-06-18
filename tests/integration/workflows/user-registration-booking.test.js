/**
 * User Registration and Booking Workflow Integration Test
 *
 * Tests the complete user journey from registration to making a booking
 *
 * @author meetabl Team
 */

const { request, utils, models } = require('../setup');
const app = require('../../../src/app');

describe('User Registration and Booking Workflow', () => {
  beforeAll(async () => {
    await utils.resetDatabase();
  });

  afterAll(async () => {
    await utils.cleanup();
  });

  describe('Complete new user journey', () => {
    let newUser;
    let authTokens;
    let hostUser;
    let booking;

    test('Step 1: Register a new user account', async () => {
      const registrationData = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        username: 'janedoe',
        password: 'SecurePassword123!',
        timezone: 'America/Los_Angeles',
        phoneNumber: '+14155551234'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      newUser = response.body.data.user;
      authTokens = {
        accessToken: response.body.data.accessToken,
        refreshToken: response.body.data.refreshToken
      };

      // Verify user was created in database
      const dbUser = await models.User.findByPk(newUser.id);
      expect(dbUser).toBeTruthy();
      expect(dbUser.email).toBe(registrationData.email);
      expect(dbUser.isEmailVerified).toBe(false);
    });

    test('Step 2: Verify email address', async () => {
      // Get the verification token from the user record
      const user = await models.User.findByPk(newUser.id);
      const verificationToken = user.emailVerificationToken;

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified successfully');

      // Verify email is marked as verified
      const updatedUser = await models.User.findByPk(newUser.id);
      expect(updatedUser.isEmailVerified).toBe(true);
    });

    test('Step 3: Update user profile and settings', async () => {
      // Update profile
      const profileUpdate = {
        bio: 'Software developer passionate about clean code',
        website: 'https://janedoe.dev',
        company: 'Tech Innovations Inc.'
      };

      const profileResponse = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(profileUpdate)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.bio).toBe(profileUpdate.bio);

      // Update settings
      const settingsUpdate = {
        bookingSlotDuration: 45,
        bufferTime: 10,
        maxAdvanceBookingDays: 60,
        minAdvanceBookingHours: 12,
        isPubliclyBookable: true,
        bookingPageTitle: 'Book a meeting with Jane',
        bookingPageDescription: 'Schedule a consultation about your project'
      };

      const settingsResponse = await request(app)
        .put('/api/users/me/settings')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(settingsUpdate)
        .expect(200);

      expect(settingsResponse.body.success).toBe(true);
      expect(settingsResponse.body.data.bookingSlotDuration).toBe(45);
    });

    test('Step 4: Set up availability rules', async () => {
      // Create availability rules for weekdays
      const availabilityRules = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
        { dayOfWeek: 1, startTime: '13:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 5, startTime: '09:00', endTime: '15:00', isActive: true }
      ];

      for (const rule of availabilityRules) {
        const response = await request(app)
          .post('/api/availability/rules')
          .set('Authorization', `Bearer ${authTokens.accessToken}`)
          .send(rule)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.dayOfWeek).toBe(rule.dayOfWeek);
      }

      // Verify rules were created
      const rulesResponse = await request(app)
        .get('/api/availability/rules')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(rulesResponse.body.data.length).toBe(6);
    });

    test('Step 5: Find and book a time slot with another user', async () => {
      // Create a host user with availability
      hostUser = await utils.createTestUser({
        firstName: 'John',
        lastName: 'Host',
        email: 'john.host@example.com',
        username: 'johnhost',
        isPubliclyBookable: true
      });

      // Get available time slots for the host
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const slotsResponse = await request(app)
        .get(`/api/availability/slots/${hostUser.username}`)
        .query({
          date: tomorrow.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      expect(slotsResponse.body.success).toBe(true);
      expect(slotsResponse.body.data.length).toBeGreaterThan(0);

      // Book the first available slot
      const slot = slotsResponse.body.data[0];
      const bookingData = {
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: 'Project Discussion',
        description: 'Discuss new project requirements',
        attendeeName: `${newUser.firstName} ${newUser.lastName}`,
        attendeeEmail: newUser.email,
        attendeePhoneNumber: newUser.phoneNumber,
        location: 'Virtual Meeting',
        notes: 'Looking forward to discussing the project details'
      };

      const bookingResponse = await request(app)
        .post(`/api/bookings/public/${hostUser.username}`)
        .send(bookingData)
        .expect(201);

      expect(bookingResponse.body.success).toBe(true);
      expect(bookingResponse.body.data.status).toBe('confirmed');
      booking = bookingResponse.body.data;
    });

    test('Step 6: View and manage bookings', async () => {
      // Switch to host user context
      const hostTokens = utils.generateAuthTokens(hostUser);

      // Get host's bookings
      const hostBookingsResponse = await request(app)
        .get('/api/bookings/my')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .expect(200);

      expect(hostBookingsResponse.body.success).toBe(true);
      expect(hostBookingsResponse.body.data.bookings.length).toBeGreaterThan(0);
      expect(hostBookingsResponse.body.data.bookings[0].id).toBe(booking.id);

      // Get booking details
      const bookingDetailsResponse = await request(app)
        .get(`/api/bookings/my/${booking.id}`)
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .expect(200);

      expect(bookingDetailsResponse.body.success).toBe(true);
      expect(bookingDetailsResponse.body.data.attendeeEmail).toBe(newUser.email);
    });

    test('Step 7: Reschedule the booking', async () => {
      const hostTokens = utils.generateAuthTokens(hostUser);

      // Get new available slots
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const newSlotsResponse = await request(app)
        .get(`/api/availability/slots/${hostUser.username}`)
        .query({
          date: nextWeek.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      const newSlot = newSlotsResponse.body.data[0];

      // Reschedule the booking
      const rescheduleResponse = await request(app)
        .put(`/api/bookings/my/${booking.id}`)
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send({
          startTime: newSlot.startTime,
          endTime: newSlot.endTime,
          notes: 'Rescheduled due to conflict'
        })
        .expect(200);

      expect(rescheduleResponse.body.success).toBe(true);
      expect(new Date(rescheduleResponse.body.data.startTime).getTime())
        .toBe(new Date(newSlot.startTime).getTime());
    });

    test('Step 8: Check notifications', async () => {
      // Both users should have received notifications
      const hostTokens = utils.generateAuthTokens(hostUser);

      // Check host notifications
      const hostNotificationsResponse = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .expect(200);

      expect(hostNotificationsResponse.body.success).toBe(true);
      expect(hostNotificationsResponse.body.data.notifications.length).toBeGreaterThan(0);

      // Check attendee notifications (using newUser tokens)
      const attendeeNotificationsResponse = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(attendeeNotificationsResponse.body.success).toBe(true);
    });

    test('Step 9: Cancel the booking', async () => {
      const hostTokens = utils.generateAuthTokens(hostUser);

      const cancelResponse = await request(app)
        .delete(`/api/bookings/my/${booking.id}`)
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send({
          reason: 'Need to reschedule to a different date'
        })
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.message).toContain('cancelled');

      // Verify booking status
      const cancelledBooking = await models.Booking.findByPk(booking.id);
      expect(cancelledBooking.status).toBe('cancelled');
    });

    test('Step 10: Export booking history', async () => {
      const hostTokens = utils.generateAuthTokens(hostUser);

      // Export as CSV
      const csvResponse = await request(app)
        .get('/api/bookings/export')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .query({ format: 'csv' })
        .expect(200);

      expect(csvResponse.headers['content-type']).toContain('text/csv');
      expect(csvResponse.text).toContain('Title,Start Time,End Time');

      // Export as JSON
      const jsonResponse = await request(app)
        .get('/api/bookings/export')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .query({ format: 'json' })
        .expect(200);

      expect(jsonResponse.body).toBeInstanceOf(Array);
      expect(jsonResponse.body.length).toBeGreaterThan(0);
    });
  });
});