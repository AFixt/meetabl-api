/**
 * Booking routes integration tests
 * 
 * @author AccessMeet Team
 */

const { setupTestApp, createAuthUser, closeDatabase } = require('../../fixtures/app');
const { setupTestDatabase, clearDatabase, createBooking } = require('../../fixtures/db');

describe('Booking Routes', () => {
  let request;
  let user;
  let authRequest;

  // Setup and teardown
  beforeAll(async () => {
    await setupTestDatabase();
    request = await setupTestApp();
  });

  beforeEach(async () => {
    // Create authenticated user
    const auth = await createAuthUser(request);
    user = auth.user;
    authRequest = auth.authRequest;
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /api/bookings/my', () => {
    test('should get user bookings', async () => {
      // Create some bookings
      await createBooking(user.id);
      await createBooking(user.id);
      
      const response = await authRequest('get', '/api/bookings/my');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.headers).toHaveProperty('x-total-count', '2');
    });

    test('should apply pagination', async () => {
      // Create some bookings
      await createBooking(user.id);
      await createBooking(user.id);
      
      const response = await authRequest('get', '/api/bookings/my?limit=1&offset=0');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.headers).toHaveProperty('x-total-count', '2');
      expect(response.headers).toHaveProperty('x-total-pages', '2');
    });
  });

  describe('POST /api/bookings/my', () => {
    test('should create booking successfully', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      
      const endTime = new Date(tomorrow);
      endTime.setHours(11, 0, 0, 0);
      
      const response = await authRequest('post', '/api/bookings/my')
        .send({
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com',
          start_time: tomorrow.toISOString(),
          end_time: endTime.toISOString()
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('customer_name', 'Test Customer');
      expect(response.body).toHaveProperty('customer_email', 'customer@example.com');
      expect(response.body).toHaveProperty('status', 'confirmed');
    });

    test('should validate time range', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      
      // End time before start time
      const endTime = new Date(tomorrow);
      endTime.setHours(9, 0, 0, 0);
      
      const response = await authRequest('post', '/api/bookings/my')
        .send({
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com',
          start_time: tomorrow.toISOString(),
          end_time: endTime.toISOString()
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'bad_request');
      expect(response.body.error.message).toContain('End time must be after start time');
    });

    test('should reject invalid date format', async () => {
      const response = await authRequest('post', '/api/bookings/my')
        .send({
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com',
          start_time: 'invalid-date',
          end_time: 'invalid-date'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/bookings/my/:id', () => {
    test('should get booking by ID', async () => {
      // Create booking
      const booking = await createBooking(user.id);
      
      const response = await authRequest('get', `/api/bookings/my/${booking.id}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', booking.id);
      expect(response.body).toHaveProperty('customer_name', booking.customer_name);
      expect(response.body).toHaveProperty('status', booking.status);
    });

    test('should return 404 for non-existent booking', async () => {
      const response = await authRequest('get', '/api/bookings/my/non-existent-id');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'not_found');
    });
  });

  describe('PUT /api/bookings/my/:id/cancel', () => {
    test('should cancel booking successfully', async () => {
      // Create booking
      const booking = await createBooking(user.id);
      
      const response = await authRequest('put', `/api/bookings/my/${booking.id}/cancel`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', booking.id);
      expect(response.body).toHaveProperty('status', 'cancelled');
    });

    test('should return 404 for non-existent booking', async () => {
      const response = await authRequest('put', '/api/bookings/my/non-existent-id/cancel');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'not_found');
    });
  });

  describe('GET /api/bookings/public/:username', () => {
    test('should get public booking slots', async () => {
      // Format date as YYYY-MM-DD
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      const response = await request
        .get(`/api/bookings/public/${user.name}`)
        .query({
          date: dateStr,
          duration: 60
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('date', dateStr);
      expect(response.body).toHaveProperty('available_slots');
      expect(Array.isArray(response.body.available_slots)).toBe(true);
    });

    test('should validate date format', async () => {
      const response = await request
        .get(`/api/bookings/public/${user.name}`)
        .query({
          date: 'invalid-date',
          duration: 60
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'bad_request');
    });

    test('should return 404 for non-existent user', async () => {
      // Format date as YYYY-MM-DD
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      const response = await request
        .get('/api/bookings/public/non-existent-user')
        .query({
          date: dateStr,
          duration: 60
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'not_found');
    });
  });

  describe('POST /api/bookings/public/:username', () => {
    test('should create public booking successfully', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      
      const endTime = new Date(tomorrow);
      endTime.setHours(11, 0, 0, 0);
      
      const response = await request
        .post(`/api/bookings/public/${user.name}`)
        .send({
          customer_name: 'Public Customer',
          customer_email: 'public@example.com',
          start_time: tomorrow.toISOString(),
          end_time: endTime.toISOString()
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('customer_name', 'Public Customer');
      expect(response.body).toHaveProperty('status', 'confirmed');
    });
  });
});