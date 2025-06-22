/**
 * Advanced Booking Scenarios Integration Test
 *
 * Tests complex booking workflows including conflicts, cancellations,
 * rescheduling, and edge cases
 */

const { request, utils, models } = require('../setup');
const app = require('../../../src/app');

describe('Advanced Booking Scenarios', () => {
  let hostUser;
  let hostTokens;
  let guestUser;
  let guestTokens;

  beforeAll(async () => {
    await utils.resetDatabase();
    
    // Create host user with availability
    hostUser = await utils.createTestUser({
      firstName: 'Host',
      lastName: 'User',
      email: 'host@example.com'
    });
    hostTokens = utils.generateAuthTokens(hostUser);

    // Create guest user
    guestUser = await utils.createTestUser({
      firstName: 'Guest',
      lastName: 'User',
      email: 'guest@example.com'
    });
    guestTokens = utils.generateAuthTokens(guestUser);
  });

  afterAll(async () => {
    await utils.cleanup();
  });

  describe('Booking conflict scenarios', () => {
    test('Prevents double booking at same time slot', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      futureDate.setHours(10, 0, 0, 0);

      const endDate = new Date(futureDate);
      endDate.setHours(11, 0, 0, 0);

      const bookingData = {
        title: 'First Meeting',
        startTime: futureDate.toISOString(),
        endTime: endDate.toISOString(),
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        description: 'Test meeting'
      };

      // Create first booking
      const firstBooking = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send(bookingData)
        .expect(201);

      expect(firstBooking.body.success).toBe(true);

      // Try to create conflicting booking
      const conflictingBooking = {
        ...bookingData,
        title: 'Conflicting Meeting',
        customer_name: 'Jane Smith',
        customer_email: 'jane@example.com'
      };

      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send(conflictingBooking)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('conflict');
    });

    test('Allows adjacent bookings without buffer time', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 4);
      futureDate.setHours(14, 0, 0, 0);

      // First booking: 2:00 PM - 3:00 PM
      const firstBooking = {
        title: 'First Meeting',
        startTime: futureDate.toISOString(),
        endTime: new Date(futureDate.getTime() + 60 * 60 * 1000).toISOString(),
        customer_name: 'Customer One',
        customer_email: 'customer1@example.com'
      };

      // Second booking: 3:00 PM - 4:00 PM (immediately after)
      const secondBooking = {
        title: 'Second Meeting',
        startTime: new Date(futureDate.getTime() + 60 * 60 * 1000).toISOString(),
        endTime: new Date(futureDate.getTime() + 120 * 60 * 1000).toISOString(),
        customer_name: 'Customer Two',
        customer_email: 'customer2@example.com'
      };

      const response1 = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send(firstBooking)
        .expect(201);

      const response2 = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send(secondBooking)
        .expect(201);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
    });
  });

  describe('Booking modifications', () => {
    let testBooking;

    beforeEach(async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      futureDate.setHours(9, 0, 0, 0);

      testBooking = await utils.createTestBooking(hostUser.id, {
        title: 'Test Meeting for Modification',
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 60 * 60 * 1000)
      });
    });

    test('Host can reschedule their own booking', async () => {
      const newStartTime = new Date();
      newStartTime.setDate(newStartTime.getDate() + 6);
      newStartTime.setHours(11, 0, 0, 0);
      
      const newEndTime = new Date(newStartTime.getTime() + 60 * 60 * 1000);

      const updateData = {
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
        title: 'Rescheduled Meeting'
      };

      const response = await request(app)
        .put(`/api/bookings/my/${testBooking.id}`)
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Rescheduled Meeting');
      expect(new Date(response.body.data.startTime).getTime()).toBe(newStartTime.getTime());
    });

    test('Host can cancel their booking', async () => {
      const response = await request(app)
        .put(`/api/bookings/my/${testBooking.id}/cancel`)
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');

      // Verify booking is cancelled in database
      const booking = await models.Booking.findByPk(testBooking.id);
      expect(booking.status).toBe('cancelled');
    });

    test('Cannot modify past bookings', async () => {
      // Create a booking in the past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const pastBooking = await utils.createTestBooking(hostUser.id, {
        startTime: pastDate,
        endTime: new Date(pastDate.getTime() + 60 * 60 * 1000)
      });

      const response = await request(app)
        .put(`/api/bookings/my/${pastBooking.id}`)
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send({ title: 'Updated Title' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('past');
    });
  });

  describe('Bulk booking operations', () => {
    let bookingIds = [];

    beforeEach(async () => {
      bookingIds = [];
      // Create multiple test bookings
      for (let i = 0; i < 3; i++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7 + i);
        futureDate.setHours(10 + i, 0, 0, 0);

        const booking = await utils.createTestBooking(hostUser.id, {
          title: `Bulk Test Meeting ${i + 1}`,
          startTime: futureDate,
          endTime: new Date(futureDate.getTime() + 60 * 60 * 1000)
        });
        bookingIds.push(booking.id);
      }
    });

    test('Host can bulk cancel multiple bookings', async () => {
      const response = await request(app)
        .post('/api/bookings/my/bulk-cancel')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send({ bookingIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cancelled).toBe(bookingIds.length);

      // Verify all bookings are cancelled
      for (const id of bookingIds) {
        const booking = await models.Booking.findByPk(id);
        expect(booking.status).toBe('cancelled');
      }
    });

    test('Bulk cancel fails with non-existent booking IDs', async () => {
      const invalidIds = [99999, 99998];
      
      const response = await request(app)
        .post('/api/bookings/my/bulk-cancel')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .send({ bookingIds: invalidIds })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('Public booking workflows', () => {
    test('Anonymous user can create public booking', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      futureDate.setHours(13, 0, 0, 0);

      const publicBookingData = {
        startTime: futureDate.toISOString(),
        endTime: new Date(futureDate.getTime() + 60 * 60 * 1000).toISOString(),
        customerName: 'Anonymous Customer',
        customerEmail: 'anonymous@example.com',
        customerPhone: '+1234567890',
        message: 'I would like to schedule a consultation'
      };

      const response = await request(app)
        .post(`/api/bookings/public/${hostUser.id}`)
        .send(publicBookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customer_email).toBe(publicBookingData.customerEmail);
      expect(response.body.data.status).toBe('confirmed');
    });

    test('Public booking respects availability rules', async () => {
      // Try to book on Sunday (day 0) when user only has Mon-Fri availability
      const futureDate = new Date();
      // Find next Sunday
      while (futureDate.getDay() !== 0) {
        futureDate.setDate(futureDate.getDate() + 1);
      }
      futureDate.setHours(13, 0, 0, 0);

      const publicBookingData = {
        startTime: futureDate.toISOString(),
        endTime: new Date(futureDate.getTime() + 60 * 60 * 1000).toISOString(),
        customerName: 'Weekend Customer',
        customerEmail: 'weekend@example.com'
      };

      const response = await request(app)
        .post(`/api/bookings/public/${hostUser.id}`)
        .send(publicBookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('available');
    });
  });

  describe('Booking analytics and reporting', () => {
    beforeEach(async () => {
      // Create some bookings for analytics
      const dates = [1, 2, 3, 4, 5]; // Next 5 days
      for (const dayOffset of dates) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + dayOffset);
        futureDate.setHours(14, 0, 0, 0);

        await utils.createTestBooking(hostUser.id, {
          startTime: futureDate,
          endTime: new Date(futureDate.getTime() + 60 * 60 * 1000),
          status: dayOffset <= 3 ? 'confirmed' : 'cancelled'
        });
      }
    });

    test('Host can view booking statistics', async () => {
      const response = await request(app)
        .get('/api/bookings/my/stats')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalBookings');
      expect(response.body.data).toHaveProperty('confirmedBookings');
      expect(response.body.data).toHaveProperty('cancelledBookings');
      expect(response.body.data.totalBookings).toBeGreaterThan(0);
    });

    test('Host can export booking data', async () => {
      const response = await request(app)
        .get('/api/bookings/export?format=json')
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time booking updates', () => {
    test('Booking status changes are reflected immediately', async () => {
      const booking = await utils.createTestBooking(hostUser.id);

      // Cancel the booking
      await request(app)
        .put(`/api/bookings/my/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .expect(200);

      // Immediately check the booking status
      const response = await request(app)
        .get(`/api/bookings/my/${booking.id}`)
        .set('Authorization', `Bearer ${hostTokens.accessToken}`)
        .expect(200);

      expect(response.body.data.status).toBe('cancelled');
    });
  });
});