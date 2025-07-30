/**
 * Auth Routes Integration Tests
 * Tests for authentication endpoints
 */

const request = require('supertest');
const { getTestApp } = require('./test-app');
const { User, RefreshToken } = require('../../src/models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

describe('Auth Routes Integration Tests', () => {
  let app;
  let testUser;

  beforeAll(async () => {
    // Initialize app
    app = await getTestApp();
    
    // Clean up any existing test data
    await User.destroy({ where: { email: 'auth-test@meetabl.com' } });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await User.destroy({ where: { id: testUser.id } });
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        firstName: 'Auth',
        lastName: 'Test',
        email: 'auth-test@meetabl.com',
        password: 'AuthTest123!',
        timezone: 'America/New_York'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully. Please check your email to verify your account.',
        data: {
          email: userData.email,
          first_name: userData.firstName,
          last_name: userData.lastName,
          email_verified: false
        }
      });

      expect(response.body.data.id).toBeDefined();

      // Store user for cleanup
      testUser = await User.findOne({ where: { email: userData.email } });
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        firstName: 'Duplicate',
        lastName: 'User',
        email: 'auth-test@meetabl.com',
        password: 'Duplicate123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'CONFLICT'
      });
    });

    it('should validate required fields', async () => {
      const userData = {
        firstName: 'Missing',
        // Missing lastName, email, password
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should validate password strength', async () => {
      const userData = {
        firstName: 'Weak',
        lastName: 'Password',
        email: 'weakpass@meetabl.com',
        password: '123' // Too weak
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'auth-test@meetabl.com',
        password: 'AuthTest123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            email: loginData.email
          }
        }
      });

      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'auth-test@meetabl.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });

    it('should reject login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@meetabl.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });

    it('should handle missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    let validRefreshToken;
    let accessToken;

    beforeAll(async () => {
      // Login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'auth-test@meetabl.com',
          password: 'AuthTest123!'
        });

      validRefreshToken = loginResponse.body.data.refreshToken;
      accessToken = loginResponse.body.data.accessToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: expect.any(String)
        }
      });

      // New access token should be different
      expect(response.body.data.accessToken).not.toBe(accessToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken;

    beforeAll(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'auth-test@meetabl.com',
          password: 'AuthTest123!'
        });

      authToken = loginResponse.body.data.accessToken;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logout successful'
      });
    });

    it('should reject logout without auth token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });

    it('should reject logout with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should initiate password reset for valid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'auth-test@meetabl.com' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('password reset')
      });
    });

    it('should handle non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@meetabl.com' })
        .expect(200); // Returns 200 to prevent email enumeration

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('password reset')
      });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should validate reset token and password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-reset-token',
          password: 'NewPassword123!'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should require strong password for reset', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'some-reset-token',
          password: '123' // Too weak
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should handle email verification token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-verification-token' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should validate token format', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: '' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });
});