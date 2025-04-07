/**
 * Calendar routes integration tests
 * 
 * @author AccessMeet Team
 */

const { setupTestApp, createAuthUser, closeDatabase } = require('../../fixtures/app');
const { setupTestDatabase, clearDatabase, createCalendarToken } = require('../../fixtures/db');

describe('Calendar Routes', () => {
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

  describe('GET /api/calendar/google/auth', () => {
    test('should generate Google auth URL', async () => {
      const response = await authRequest('get', '/api/calendar/google/auth');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('authUrl');
      expect(response.body.authUrl).toContain('accounts.google.com');
    });

    test('should require authentication', async () => {
      const response = await request.get('/api/calendar/google/auth');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'unauthorized');
    });
  });

  describe('GET /api/calendar/microsoft/auth', () => {
    test('should generate Microsoft auth URL', async () => {
      const response = await authRequest('get', '/api/calendar/microsoft/auth');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('authUrl');
      expect(response.body.authUrl).toContain('login.microsoftonline.com');
    });

    test('should require authentication', async () => {
      const response = await request.get('/api/calendar/microsoft/auth');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'unauthorized');
    });
  });

  describe('GET /api/calendar/status', () => {
    test('should get calendar status with no connections', async () => {
      const response = await authRequest('get', '/api/calendar/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('provider', 'none');
      expect(response.body).toHaveProperty('connected', false);
      expect(response.body).toHaveProperty('connections');
      expect(response.body.connections).toHaveLength(0);
    });

    test('should get calendar status with connections', async () => {
      // Create calendar token
      await createCalendarToken(user.id, 'google');
      
      // Update user calendar provider
      user.calendar_provider = 'google';
      await user.save();
      
      const response = await authRequest('get', '/api/calendar/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('provider', 'google');
      expect(response.body).toHaveProperty('connected', true);
      expect(response.body).toHaveProperty('connections');
      expect(response.body.connections).toHaveLength(1);
      expect(response.body.connections[0]).toHaveProperty('provider', 'google');
    });
  });

  describe('DELETE /api/calendar/disconnect/:provider', () => {
    test('should disconnect calendar provider', async () => {
      // Create calendar token
      await createCalendarToken(user.id, 'google');
      
      // Update user calendar provider
      user.calendar_provider = 'google';
      await user.save();
      
      const response = await authRequest('delete', '/api/calendar/disconnect/google');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('disconnected successfully');
      
      // Verify status was updated
      const statusResponse = await authRequest('get', '/api/calendar/status');
      expect(statusResponse.body).toHaveProperty('provider', 'none');
      expect(statusResponse.body).toHaveProperty('connected', false);
    });

    test('should validate provider param', async () => {
      const response = await authRequest('delete', '/api/calendar/disconnect/invalid-provider');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'bad_request');
    });
  });
});