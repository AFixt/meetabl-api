/**
 * Auth routes integration tests
 * 
 * @author AccessMeet Team
 */

const { setupTestApp, closeDatabase } = require('../../fixtures/app');
const { setupTestDatabase, clearDatabase, createTestUser } = require('../../fixtures/db');

describe('Auth Routes', () => {
  let request;

  // Setup and teardown
  beforeAll(async () => {
    await setupTestDatabase();
    request = await setupTestApp();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('POST /api/auth/register', () => {
    test('should register new user successfully', async () => {
      const response = await request
        .post('/api/auth/register')
        .send({
          name: 'New User',
          email: 'newuser@example.com',
          password: 'Password123!',
          timezone: 'UTC'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'New User');
      expect(response.body).toHaveProperty('email', 'newuser@example.com');
      expect(response.body).toHaveProperty('token');
    });

    test('should validate required fields', async () => {
      const response = await request
        .post('/api/auth/register')
        .send({
          name: '',
          email: 'invalid-email',
          password: '123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'bad_request');
      expect(response.body.error).toHaveProperty('params');
    });

    test('should prevent duplicate email', async () => {
      // Create user first
      const user = await createTestUser({
        email: 'existing@example.com'
      });
      
      // Try to register with same email
      const response = await request
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: 'existing@example.com',
          password: 'Password123!'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'bad_request');
      expect(response.body.error.message).toContain('Email already in use');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login successfully with correct credentials', async () => {
      // Create user
      const user = await createTestUser();
      
      // Login
      const response = await request
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.rawPassword
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('email', user.email);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
    });

    test('should reject invalid credentials', async () => {
      // Create user
      const user = await createTestUser();
      
      // Login with wrong password
      const response = await request
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'WrongPassword!'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'unauthorized');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    test('should refresh tokens successfully', async () => {
      // Create user and login to get refresh token
      const user = await createTestUser();
      
      const loginResponse = await request
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.rawPassword
        });
      
      const refreshToken = loginResponse.body.refreshToken;
      
      // Refresh token
      const response = await request
        .post('/api/auth/refresh-token')
        .send({ refreshToken });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
    });

    test('should reject invalid refresh token', async () => {
      const response = await request
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'unauthorized');
    });
  });
});