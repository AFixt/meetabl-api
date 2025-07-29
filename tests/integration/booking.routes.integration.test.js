/**
 * Booking Routes Integration Tests
 * Tests for booking management endpoints
 */

const request = require('supertest');
const app = require('../../src/app');
const { User, Booking, BookingRequest } = require('../../src/models');
const { v4: uuidv4 } = require('uuid');
const { addDays } = require('date-fns');

describe('Booking Routes Integration Tests', () => {
  let authToken;
  let testUser;
  let testBooking;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      id: uuidv4(),
      firstName: 'Booking',
      lastName: 'Test',
      email: `booking-test-${Date.now()}@meetabl.com`,
      password: 'BookingTest123!',
      isActive: true,
      emailVerified: true
    });

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'BookingTest123!'
      });

    authToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    if (testBooking) {
      await Booking.destroy({ where: { id: testBooking.id } });
    }
    if (testUser) {
      await User.destroy({ where: { id: testUser.id } });
    }
  });

  describe('GET /api/bookings', () => {
    it('should get user bookings with authentication', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Bookings retrieved successfully',
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 100,
          total: expect.any(Number)
        }
      });
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/bookings?page=1&limit=10&order=created_at&dir=desc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });

    it('should reject invalid auth token', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking', async () => {
      const bookingData = {
        title: 'Test Meeting',
        start_time: addDays(new Date(), 1).toISOString(),
        end_time: addDays(new Date(), 1).toISOString(),
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        notes: 'Test meeting notes'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Booking created successfully',
        data: {
          id: expect.any(String),
          title: bookingData.title,
          status: 'confirmed',
          userId: testUser.id
        }
      });

      // Store for cleanup
      testBooking = response.body.data;
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        title: 'Missing Required Fields'
        // Missing start_time, end_time, customer info
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should validate date formats', async () => {
      const invalidDateData = {
        title: 'Invalid Dates',
        start_time: 'not-a-date',
        end_time: 'also-not-a-date',
        customer_name: 'Test User',
        customer_email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        title: 'Invalid Email',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        customer_name: 'Test User',
        customer_email: 'not-an-email'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidEmailData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should get a specific booking', async () => {
      const response = await request(app)
        .get(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Booking retrieved successfully',
        data: {
          id: testBooking.id,
          title: testBooking.title
        }
      });
    });

    it('should return 404 for non-existent booking', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .get(`/api/bookings/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'NOT_FOUND'
      });
    });

    it('should validate booking ID format', async () => {
      const response = await request(app)
        .get('/api/bookings/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('PUT /api/bookings/:id', () => {
    it('should update a booking', async () => {
      const updateData = {
        title: 'Updated Meeting Title',
        notes: 'Updated notes'
      };

      const response = await request(app)
        .put(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Booking updated successfully',
        data: {
          id: testBooking.id,
          title: updateData.title,
          notes: updateData.notes
        }
      });
    });

    it('should prevent updating cancelled bookings', async () => {
      // First cancel the booking
      await request(app)
        .delete(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to update cancelled booking
      const response = await request(app)
        .put(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Should not update' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    let bookingToCancel;

    beforeAll(async () => {
      // Create a booking to cancel
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Booking to Cancel',
          start_time: addDays(new Date(), 2).toISOString(),
          end_time: addDays(new Date(), 2).toISOString(),
          customer_name: 'Jane Doe',
          customer_email: 'jane@example.com'
        });

      bookingToCancel = response.body.data;
    });

    it('should cancel a booking', async () => {
      const response = await request(app)
        .delete(`/api/bookings/${bookingToCancel.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test cancellation' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Booking cancelled successfully',
        data: {
          id: bookingToCancel.id,
          status: 'cancelled'
        }
      });
    });

    it('should prevent double cancellation', async () => {
      const response = await request(app)
        .delete(`/api/bookings/${bookingToCancel.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('POST /api/bookings/bulk-cancel', () => {
    let bulkBookings = [];

    beforeAll(async () => {
      // Create multiple bookings for bulk cancel
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Bulk Booking ${i + 1}`,
            start_time: addDays(new Date(), i + 3).toISOString(),
            end_time: addDays(new Date(), i + 3).toISOString(),
            customer_name: `Customer ${i + 1}`,
            customer_email: `customer${i + 1}@example.com`
          });

        bulkBookings.push(response.body.data);
      }
    });

    it('should cancel multiple bookings', async () => {
      const bookingIds = bulkBookings.map(b => b.id);

      const response = await request(app)
        .post('/api/bookings/bulk-cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          bookingIds,
          reason: 'Bulk cancellation test'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('cancelled successfully'),
        data: {
          cancelledCount: 3,
          failedCount: 0
        }
      });
    });

    it('should validate booking IDs array', async () => {
      const response = await request(app)
        .post('/api/bookings/bulk-cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          bookingIds: 'not-an-array',
          reason: 'Invalid request'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should limit bulk operations to 100 bookings', async () => {
      const tooManyIds = Array(101).fill(uuidv4());

      const response = await request(app)
        .post('/api/bookings/bulk-cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          bookingIds: tooManyIds,
          reason: 'Too many bookings'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('Public Booking Routes', () => {
    describe('GET /api/bookings/public/:username', () => {
      it('should get public booking page for user', async () => {
        // Create a user with username
        const publicUser = await User.create({
          id: uuidv4(),
          firstName: 'Public',
          lastName: 'User',
          email: `public-${Date.now()}@meetabl.com`,
          username: `publicuser${Date.now()}`,
          password: 'Public123!',
          isActive: true,
          emailVerified: true
        });

        const response = await request(app)
          .get(`/api/bookings/public/${publicUser.username}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            user: {
              firstName: publicUser.firstName,
              lastName: publicUser.lastName,
              username: publicUser.username
            }
          }
        });

        // Cleanup
        await User.destroy({ where: { id: publicUser.id } });
      });

      it('should return 404 for non-existent username', async () => {
        const response = await request(app)
          .get('/api/bookings/public/nonexistentuser')
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          errorCode: 'NOT_FOUND'
        });
      });
    });

    describe('POST /api/bookings/public/:username', () => {
      let publicUser;

      beforeAll(async () => {
        publicUser = await User.create({
          id: uuidv4(),
          firstName: 'Public',
          lastName: 'Booking',
          email: `publicbooking-${Date.now()}@meetabl.com`,
          username: `publicbooking${Date.now()}`,
          password: 'Public123!',
          isActive: true,
          emailVerified: true
        });
      });

      afterAll(async () => {
        await User.destroy({ where: { id: publicUser.id } });
      });

      it('should create public booking request', async () => {
        const bookingData = {
          title: 'Public Meeting Request',
          start_time: addDays(new Date(), 5).toISOString(),
          end_time: addDays(new Date(), 5).toISOString(),
          customer_name: 'External Customer',
          customer_email: 'external@example.com',
          notes: 'Public booking request'
        };

        const response = await request(app)
          .post(`/api/bookings/public/${publicUser.username}`)
          .send(bookingData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          message: expect.stringContaining('booking request created'),
          data: {
            id: expect.any(String),
            status: 'pending',
            confirmation_token: expect.any(String)
          }
        });
      });
    });
  });
});