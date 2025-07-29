/**
 * Middleware Chain Validation Tests
 * Tests for authentication, validation, and error handling middleware
 */

const request = require('supertest');
const express = require('express');
const authMiddleware = require('../../../src/middlewares/auth');
const validationMiddleware = require('../../../src/middlewares/validation');
const errorMiddleware = require('../../../src/middlewares/error');
const rateLimitMiddleware = require('../../../src/middlewares/rate-limit');
const { User } = require('../../../src/models');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies
jest.mock('../../../src/models');
jest.mock('jsonwebtoken');

describe('Middleware Chain Validation', () => {
  let app;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
  });

  describe('Auth Middleware', () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      isActive: true
    };

    beforeEach(() => {
      // Setup test route with auth middleware
      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ 
          success: true, 
          userId: req.user.id,
          user: req.user 
        });
      });
      app.use(errorMiddleware);
    });

    it('should authenticate valid JWT token', async () => {
      const token = 'valid-jwt-token';
      jwt.verify.mockReturnValue({ userId: mockUser.id });
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        userId: mockUser.id
      });

      expect(jwt.verify).toHaveBeenCalledWith(
        token,
        process.env.JWT_SECRET
      );
      expect(User.findByPk).toHaveBeenCalledWith(mockUser.id);
    });

    it('should reject missing authorization header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'No token provided'
      });
    });

    it('should reject invalid token format', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Invalid token format'
      });
    });

    it('should reject expired token', async () => {
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer expired-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Token expired'
      });
    });

    it('should reject token for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      jwt.verify.mockReturnValue({ userId: inactiveUser.id });
      User.findByPk.mockResolvedValue(inactiveUser);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'User account is inactive'
      });
    });

    it('should reject token for non-existent user', async () => {
      jwt.verify.mockReturnValue({ userId: 'non-existent-id' });
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'User not found'
      });
    });
  });

  describe('Validation Middleware', () => {
    const { body, param, query, validationResult } = require('express-validator');

    beforeEach(() => {
      // Setup test routes with validation middleware
      app.post('/test/body',
        body('email').isEmail().normalizeEmail(),
        body('name').notEmpty().trim(),
        body('age').isInt({ min: 18, max: 100 }),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, data: req.body });
        }
      );

      app.get('/test/params/:id',
        param('id').isUUID(),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, id: req.params.id });
        }
      );

      app.get('/test/query',
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, query: req.query });
        }
      );

      app.use(errorMiddleware);
    });

    it('should pass valid body data', async () => {
      const validData = {
        email: 'test@example.com',
        name: 'Test User',
        age: 25
      };

      const response = await request(app)
        .post('/test/body')
        .send(validData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          email: 'test@example.com',
          name: 'Test User',
          age: 25
        }
      });
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/test/body')
        .send({
          email: 'not-an-email',
          name: 'Test User',
          age: 25
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          expect.objectContaining({
            param: 'email',
            msg: expect.stringContaining('email')
          })
        ])
      });
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/test/body')
        .send({
          email: 'test@example.com',
          // missing name
          age: 25
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          expect.objectContaining({
            param: 'name'
          })
        ])
      });
    });

    it('should validate param formats', async () => {
      const response = await request(app)
        .get('/test/params/not-a-uuid')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          expect.objectContaining({
            param: 'id'
          })
        ])
      });
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/test/query?page=0&limit=200')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          expect.objectContaining({
            param: 'page'
          }),
          expect.objectContaining({
            param: 'limit'
          })
        ])
      });
    });

    it('should sanitize input data', async () => {
      const response = await request(app)
        .post('/test/body')
        .send({
          email: '  TEST@EXAMPLE.COM  ',
          name: '  Test User  ',
          age: '25' // String should be converted to number
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          email: 'test@example.com', // Normalized
          name: 'Test User', // Trimmed
          age: 25 // Converted to number
        }
      });
    });
  });

  describe('Middleware Chain Integration', () => {
    beforeEach(() => {
      // Setup complete middleware chain
      app.use(authMiddleware);
      
      const { body } = require('express-validator');
      app.post('/api/protected',
        body('title').notEmpty().trim(),
        body('date').isISO8601(),
        validationMiddleware,
        (req, res) => {
          res.json({
            success: true,
            userId: req.user.id,
            data: req.body
          });
        }
      );

      app.use(errorMiddleware);
    });

    it('should process request through complete middleware chain', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        isActive: true
      };

      jwt.verify.mockReturnValue({ userId: mockUser.id });
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/protected')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: 'Test Title',
          date: '2024-01-01T10:00:00Z'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        userId: mockUser.id,
        data: {
          title: 'Test Title',
          date: '2024-01-01T10:00:00Z'
        }
      });
    });

    it('should stop at auth middleware if unauthorized', async () => {
      const response = await request(app)
        .post('/api/protected')
        .send({
          title: 'Test Title',
          date: '2024-01-01T10:00:00Z'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });

    it('should stop at validation middleware if invalid data', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        isActive: true
      };

      jwt.verify.mockReturnValue({ userId: mockUser.id });
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/protected')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: '', // Empty title
          date: 'not-a-date'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          expect.objectContaining({ param: 'title' }),
          expect.objectContaining({ param: 'date' })
        ])
      });
    });
  });

  describe('Error Handling Middleware', () => {
    beforeEach(() => {
      // Setup routes that throw different types of errors
      app.get('/test/error', (req, res, next) => {
        const error = new Error('Test error');
        error.statusCode = 400;
        error.errorCode = 'TEST_ERROR';
        next(error);
      });

      app.get('/test/unexpected', (req, res, next) => {
        next(new Error('Unexpected error'));
      });

      app.get('/test/async-error', async (req, res, next) => {
        throw new Error('Async error');
      });

      app.use(errorMiddleware);
    });

    it('should handle custom errors properly', async () => {
      const response = await request(app)
        .get('/test/error')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'TEST_ERROR',
        message: 'Test error'
      });
    });

    it('should handle unexpected errors', async () => {
      const response = await request(app)
        .get('/test/unexpected')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      });
    });

    it('should include stack trace in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .get('/test/unexpected')
        .expect(500);

      expect(response.body).toHaveProperty('stack');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Rate Limiting Middleware', () => {
    beforeEach(() => {
      // Reset rate limiter state
      jest.clearAllMocks();
    });

    it('should allow requests within rate limit', async () => {
      app.use(rateLimitMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      // Make multiple requests within limit
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/test')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true
        });
      }
    });

    it('should include rate limit headers', async () => {
      app.use(rateLimitMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });
});