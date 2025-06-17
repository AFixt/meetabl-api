/**
 * Auth Routes Tests
 * 
 * Tests for authentication route definitions and middleware setup
 * 
 * @author meetabl Team
 */

const express = require('express');
const request = require('supertest');

// Mock the controller functions
jest.mock('../../../src/controllers/auth.controller', () => ({
  register: jest.fn((req, res) => res.status(201).json({ message: 'User registered' })),
  login: jest.fn((req, res) => res.status(200).json({ message: 'Login successful' })),
  refresh: jest.fn((req, res) => res.status(200).json({ message: 'Token refreshed' })),
  logout: jest.fn((req, res) => res.status(200).json({ message: 'Logout successful' })),
  forgotPassword: jest.fn((req, res) => res.status(200).json({ message: 'Password reset email sent' })),
  resetPassword: jest.fn((req, res) => res.status(200).json({ message: 'Password reset successful' })),
  verifyEmail: jest.fn((req, res) => res.status(200).json({ message: 'Email verified' })),
  resendVerification: jest.fn((req, res) => res.status(200).json({ message: 'Verification email sent' }))
}));

// Mock validation middleware
jest.mock('../../../src/middlewares/validation', () => ({
  validateRegister: jest.fn((req, res, next) => next()),
  validateLogin: jest.fn((req, res, next) => next()),
  validateForgotPassword: jest.fn((req, res, next) => next()),
  validateResetPassword: jest.fn((req, res, next) => next()),
  validateVerifyEmail: jest.fn((req, res, next) => next()),
  validateResendVerification: jest.fn((req, res, next) => next())
}));

// Mock auth middleware
jest.mock('../../../src/middlewares/auth', () => ({
  authenticateJWT: jest.fn((req, res, next) => next())
}));

// Import the routes after mocking
const authRoutes = require('../../../src/routes/auth.routes');
const authController = require('../../../src/controllers/auth.controller');
const validation = require('../../../src/middlewares/validation');
const { authenticateJWT } = require('../../../src/middlewares/auth');

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    test('should have register route with validation middleware', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(validation.validateRegister).toHaveBeenCalled();
      expect(authController.register).toHaveBeenCalled();
    });
  });

  describe('POST /auth/login', () => {
    test('should have login route with validation middleware', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(validation.validateLogin).toHaveBeenCalled();
      expect(authController.login).toHaveBeenCalled();
    });
  });

  describe('POST /auth/refresh', () => {
    test('should have refresh route', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'refresh-token' });

      expect(response.status).toBe(200);
      expect(authController.refresh).toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    test('should have logout route with authentication', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(authController.logout).toHaveBeenCalled();
    });
  });

  describe('POST /auth/forgot-password', () => {
    test('should have forgot password route with validation', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(validation.validateForgotPassword).toHaveBeenCalled();
      expect(authController.forgotPassword).toHaveBeenCalled();
    });
  });

  describe('POST /auth/reset-password', () => {
    test('should have reset password route with validation', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'reset-token',
          password: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(validation.validateResetPassword).toHaveBeenCalled();
      expect(authController.resetPassword).toHaveBeenCalled();
    });
  });

  describe('GET /auth/verify-email/:token', () => {
    test('should have verify email route with validation', async () => {
      const response = await request(app)
        .get('/auth/verify-email/verification-token');

      expect(response.status).toBe(200);
      expect(validation.validateVerifyEmail).toHaveBeenCalled();
      expect(authController.verifyEmail).toHaveBeenCalled();
    });
  });

  describe('POST /auth/resend-verification', () => {
    test('should have resend verification route with validation', async () => {
      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(validation.validateResendVerification).toHaveBeenCalled();
      expect(authController.resendVerification).toHaveBeenCalled();
    });
  });
});