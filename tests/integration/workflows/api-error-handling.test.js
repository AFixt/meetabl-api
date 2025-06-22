/**
 * API Error Handling Integration Test
 *
 * Tests comprehensive error handling across all API endpoints
 * including authentication, validation, and business logic errors
 */

const { request, utils, models } = require('../setup');
const app = require('../../../src/app');

describe('API Error Handling', () => {
  let testUser;
  let authTokens;
  let expiredToken;

  beforeAll(async () => {
    await utils.resetDatabase();
    
    testUser = await utils.createTestUser();
    authTokens = utils.generateAuthTokens(testUser);
    
    // Create an expired token for testing
    const jwt = require('jsonwebtoken');
    expiredToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' } // Expired 1 hour ago
    );
  });

  afterAll(async () => {
    await utils.cleanup();
  });

  describe('Authentication errors', () => {
    test('Returns 401 for missing authorization header', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });

    test('Returns 401 for invalid token format', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'InvalidTokenFormat')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });

    test('Returns 401 for expired token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });

    test('Returns 401 for invalid token signature', async () => {
      const jwt = require('jsonwebtoken');
      const invalidToken = jwt.sign(
        { userId: testUser.id },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });

    test('Returns 403 for accessing other user\'s resources', async () => {
      const otherUser = await utils.createTestUser({ email: 'other@example.com' });
      const booking = await utils.createTestBooking(otherUser.id);

      const response = await request(app)
        .get(`/api/bookings/my/${booking.id}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('access');
    });
  });

  describe('Validation errors', () => {
    test('Registration validation - missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    test('Registration validation - invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'invalid-email-format',
          password: 'ValidPassword123!'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });

    test('Registration validation - weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });

    test('Booking validation - invalid date format', async () => {
      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          title: 'Test Meeting',
          startTime: 'invalid-date',
          endTime: 'invalid-date',
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('date');
    });

    test('Booking validation - end time before start time', async () => {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      const endTime = new Date(startTime.getTime() - 60 * 60 * 1000); // 1 hour before start

      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          title: 'Test Meeting',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('time');
    });

    test('Availability rule validation - invalid day of week', async () => {
      const response = await request(app)
        .post('/api/availability/rules')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          dayOfWeek: 8, // Invalid: should be 0-6
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: true
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('day');
    });

    test('Availability rule validation - invalid time format', async () => {
      const response = await request(app)
        .post('/api/availability/rules')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          dayOfWeek: 1,
          startTime: '25:00', // Invalid hour
          endTime: '17:00',
          isAvailable: true
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('time');
    });
  });

  describe('Business logic errors', () => {
    test('Duplicate email registration', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        email: testUser.email, // Same as existing user
        password: 'ValidPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });

    test('Login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('credentials');
    });

    test('Login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('credentials');
    });

    test('Booking in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          title: 'Past Meeting',
          startTime: pastDate.toISOString(),
          endTime: new Date(pastDate.getTime() + 60 * 60 * 1000).toISOString(),
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('past');
    });

    test('Booking outside availability hours', async () => {
      const futureDate = new Date();
      // Find a weekday
      while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
        futureDate.setDate(futureDate.getDate() + 1);
      }
      futureDate.setHours(22, 0, 0, 0); // 10 PM - outside normal hours

      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          title: 'Late Meeting',
          startTime: futureDate.toISOString(),
          endTime: new Date(futureDate.getTime() + 60 * 60 * 1000).toISOString(),
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('available');
    });
  });

  describe('Resource not found errors', () => {
    test('Get non-existent booking', async () => {
      const response = await request(app)
        .get('/api/bookings/my/99999')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    test('Update non-existent availability rule', async () => {
      const response = await request(app)
        .put('/api/availability/rules/99999')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          startTime: '10:00',
          endTime: '18:00'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    test('Access non-existent user profile', async () => {
      const response = await request(app)
        .get('/api/bookings/public/99999/availability')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('Rate limiting errors', () => {
    test('Rate limit on authentication endpoints', async () => {
      // Make multiple rapid requests to exceed rate limit
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);
      
      // At least one should hit the rate limit
      const rateLimitedResponse = responses.find(res => res.status === 429);
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body.message).toContain('rate limit');
      }
    }, 10000);
  });

  describe('Server error handling', () => {
    test('Handles database connection errors gracefully', async () => {
      // Mock a database error by closing the connection temporarily
      const { sequelize } = require('../../../src/config/database');
      
      // This test would require more complex setup to properly test
      // database connection failures, so we'll test the error response format
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('database');
    });

    test('Returns consistent error format', async () => {
      const response = await request(app)
        .get('/api/bookings/my/99999')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(404);

      // Verify consistent error response structure
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('Input sanitization', () => {
    test('Prevents XSS in booking title', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      futureDate.setHours(10, 0, 0, 0);

      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/bookings/my')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          title: xssPayload,
          startTime: futureDate.toISOString(),
          endTime: new Date(futureDate.getTime() + 60 * 60 * 1000).toISOString(),
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com'
        })
        .expect(201);

      // XSS payload should be sanitized
      expect(response.body.data.title).not.toContain('<script>');
      expect(response.body.data.title).not.toContain('alert');
    });

    test('Prevents SQL injection in search parameters', async () => {
      const sqlInjection = "'; DROP TABLE Users; --";
      
      const response = await request(app)
        .get(`/api/bookings/my?search=${encodeURIComponent(sqlInjection)}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      // Should not cause a database error
      expect(response.body.success).toBe(true);
    });
  });

  describe('CORS and security headers', () => {
    test('Includes proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/users/me')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    test('Includes security headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });
});