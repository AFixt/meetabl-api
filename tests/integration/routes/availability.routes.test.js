/**
 * Availability routes integration tests
 * 
 * @author AccessMeet Team
 */

const { setupTestApp, createAuthUser, closeDatabase } = require('../../fixtures/app');
const { setupTestDatabase, clearDatabase, createAvailabilityRule } = require('../../fixtures/db');

describe('Availability Routes', () => {
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

  describe('GET /api/availability/rules', () => {
    test('should get all availability rules for user', async () => {
      // Create some availability rules
      await createAvailabilityRule(user.id, { day_of_week: 1 });
      await createAvailabilityRule(user.id, { day_of_week: 2 });
      
      const response = await authRequest('get', '/api/availability/rules');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.headers).toHaveProperty('x-total-count', '2');
    });

    test('should return empty array if user has no rules', async () => {
      const response = await authRequest('get', '/api/availability/rules');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('POST /api/availability/rules', () => {
    test('should create availability rule successfully', async () => {
      const response = await authRequest('post', '/api/availability/rules')
        .send({
          day_of_week: 1, // Monday
          start_time: '09:00:00',
          end_time: '17:00:00',
          buffer_minutes: 15,
          max_bookings_per_day: 8
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('user_id', user.id);
      expect(response.body).toHaveProperty('day_of_week', 1);
      expect(response.body).toHaveProperty('start_time', '09:00:00');
      expect(response.body).toHaveProperty('end_time', '17:00:00');
    });

    test('should validate time range', async () => {
      const response = await authRequest('post', '/api/availability/rules')
        .send({
          day_of_week: 1,
          start_time: '17:00:00',
          end_time: '09:00:00', // End time before start time
          buffer_minutes: 15,
          max_bookings_per_day: 8
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'bad_request');
      expect(response.body.error.message).toContain('End time must be after start time');
    });
  });

  describe('GET /api/availability/rules/:id', () => {
    test('should get availability rule by ID', async () => {
      // Create availability rule
      const rule = await createAvailabilityRule(user.id);
      
      const response = await authRequest('get', `/api/availability/rules/${rule.id}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', rule.id);
      expect(response.body).toHaveProperty('user_id', user.id);
      expect(response.body).toHaveProperty('day_of_week', rule.day_of_week);
    });

    test('should return 404 for non-existent rule', async () => {
      const response = await authRequest('get', '/api/availability/rules/non-existent-id');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'not_found');
    });
  });

  describe('PUT /api/availability/rules/:id', () => {
    test('should update availability rule successfully', async () => {
      // Create availability rule
      const rule = await createAvailabilityRule(user.id);
      
      const response = await authRequest('put', `/api/availability/rules/${rule.id}`)
        .send({
          day_of_week: 3, // Wednesday
          buffer_minutes: 30
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', rule.id);
      expect(response.body).toHaveProperty('day_of_week', 3); // Updated value
      expect(response.body).toHaveProperty('buffer_minutes', 30); // Updated value
      expect(response.body).toHaveProperty('start_time', rule.start_time); // Unchanged
    });

    test('should return 404 for non-existent rule', async () => {
      const response = await authRequest('put', '/api/availability/rules/non-existent-id')
        .send({
          day_of_week: 3
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'not_found');
    });
  });

  describe('DELETE /api/availability/rules/:id', () => {
    test('should delete availability rule successfully', async () => {
      // Create availability rule
      const rule = await createAvailabilityRule(user.id);
      
      const response = await authRequest('delete', `/api/availability/rules/${rule.id}`);
      
      expect(response.status).toBe(204);
      
      // Verify rule was deleted
      const getResponse = await authRequest('get', `/api/availability/rules/${rule.id}`);
      expect(getResponse.status).toBe(404);
    });

    test('should return 404 for non-existent rule', async () => {
      const response = await authRequest('delete', '/api/availability/rules/non-existent-id');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'not_found');
    });
  });

  describe('GET /api/availability/slots', () => {
    test('should get available time slots', async () => {
      // Create availability rule for today
      await createAvailabilityRule(user.id, {
        day_of_week: new Date().getDay()
      });
      
      // Format date as YYYY-MM-DD
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      const response = await authRequest('get', '/api/availability/slots')
        .query({
          date: dateStr,
          duration: 60
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should validate date format', async () => {
      const response = await authRequest('get', '/api/availability/slots')
        .query({
          date: 'invalid-date',
          duration: 60
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'bad_request');
    });

    test('should validate duration', async () => {
      // Format date as YYYY-MM-DD
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      const response = await authRequest('get', '/api/availability/slots')
        .query({
          date: dateStr,
          duration: 500 // Too long
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'bad_request');
    });
  });
});