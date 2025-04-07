/**
 * User routes integration tests
 * 
 * @author AccessMeet Team
 */

const { setupTestApp, createAuthUser, closeDatabase } = require('../../fixtures/app');
const { setupTestDatabase, clearDatabase } = require('../../fixtures/db');

describe('User Routes', () => {
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

  describe('GET /api/users/me', () => {
    test('should get current user profile', async () => {
      const response = await authRequest('get', '/api/users/me');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('name', user.name);
      expect(response.body).toHaveProperty('email', user.email);
      // Should not include password hash
      expect(response.body).not.toHaveProperty('password_hash');
    });

    test('should require authentication', async () => {
      const response = await request.get('/api/users/me');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'unauthorized');
    });
  });

  describe('PUT /api/users/me', () => {
    test('should update user profile', async () => {
      const response = await authRequest('put', '/api/users/me')
        .send({
          name: 'Updated Name',
          timezone: 'America/New_York'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('name', 'Updated Name');
      expect(response.body).toHaveProperty('timezone', 'America/New_York');
      expect(response.body).toHaveProperty('email', user.email); // Unchanged
    });

    test('should validate input', async () => {
      const response = await authRequest('put', '/api/users/me')
        .send({
          email: 'invalid-email'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'bad_request');
    });
  });

  describe('GET /api/users/settings', () => {
    test('should get user settings', async () => {
      const response = await authRequest('get', '/api/users/settings');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user_id', user.id);
      expect(response.body).toHaveProperty('accessibility_mode');
      expect(response.body).toHaveProperty('notification_email');
    });
  });

  describe('PUT /api/users/settings', () => {
    test('should update user settings', async () => {
      const response = await authRequest('put', '/api/users/settings')
        .send({
          accessibility_mode: true,
          notification_sms: true
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user_id', user.id);
      expect(response.body).toHaveProperty('accessibility_mode', true);
      expect(response.body).toHaveProperty('notification_sms', true);
    });
  });
});