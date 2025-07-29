/**
 * Validation Middleware Tests
 * Comprehensive tests for input validation and sanitization
 */

const request = require('supertest');
const express = require('express');
const { body, param, query, check, oneOf } = require('express-validator');
const validationMiddleware = require('../../../src/middlewares/validation');

describe('Validation Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Request Body Validation', () => {
    beforeEach(() => {
      app.post('/test/user',
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)/),
        body('firstName').notEmpty().trim().escape(),
        body('lastName').notEmpty().trim().escape(),
        body('age').optional().isInt({ min: 13, max: 120 }),
        body('website').optional().isURL(),
        body('phone').optional().isMobilePhone(),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, data: req.body });
        }
      );
    });

    it('should validate valid user data', async () => {
      const response = await request(app)
        .post('/test/user')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe',
          age: 25,
          website: 'https://example.com',
          phone: '+1234567890'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        })
      });
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/test/user')
        .send({
          email: 'invalid-email',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
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

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/test/user')
        .send({
          email: 'test@example.com',
          password: 'weak',
          firstName: 'John',
          lastName: 'Doe'
        })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ param: 'password' })
        ])
      );
    });

    it('should sanitize input data', async () => {
      const response = await request(app)
        .post('/test/user')
        .send({
          email: '  TEST@EXAMPLE.COM  ',
          password: 'Password123',
          firstName: '  John<script>alert("xss")</script>  ',
          lastName: '  Doe  '
        })
        .expect(200);

      expect(response.body.data).toMatchObject({
        email: 'test@example.com',
        firstName: 'John&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
        lastName: 'Doe'
      });
    });

    it('should handle optional fields correctly', async () => {
      const response = await request(app)
        .post('/test/user')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
          // Optional fields omitted
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }
      });
    });
  });

  describe('Query Parameter Validation', () => {
    beforeEach(() => {
      app.get('/test/search',
        query('q').optional().trim().escape(),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('sort').optional().isIn(['asc', 'desc']),
        query('from').optional().isISO8601(),
        query('to').optional().isISO8601(),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, query: req.query });
        }
      );
    });

    it('should validate valid query parameters', async () => {
      const response = await request(app)
        .get('/test/search?q=test&page=2&limit=20&sort=desc&from=2024-01-01&to=2024-12-31')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        query: {
          q: 'test',
          page: 2,
          limit: 20,
          sort: 'desc',
          from: '2024-01-01',
          to: '2024-12-31'
        }
      });
    });

    it('should reject invalid pagination values', async () => {
      const response = await request(app)
        .get('/test/search?page=0&limit=200')
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ param: 'page' }),
          expect.objectContaining({ param: 'limit' })
        ])
      );
    });

    it('should reject invalid sort values', async () => {
      const response = await request(app)
        .get('/test/search?sort=invalid')
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ param: 'sort' })
        ])
      );
    });

    it('should convert string numbers to integers', async () => {
      const response = await request(app)
        .get('/test/search?page=5&limit=10')
        .expect(200);

      expect(response.body.query).toMatchObject({
        page: 5, // Should be number, not string
        limit: 10
      });
      expect(typeof response.body.query.page).toBe('number');
      expect(typeof response.body.query.limit).toBe('number');
    });
  });

  describe('URL Parameter Validation', () => {
    beforeEach(() => {
      app.get('/test/user/:id',
        param('id').isUUID(),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, id: req.params.id });
        }
      );

      app.get('/test/post/:slug',
        param('slug').matches(/^[a-z0-9-]+$/),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, slug: req.params.slug });
        }
      );
    });

    it('should validate UUID parameter', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/test/user/${validUuid}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        id: validUuid
      });
    });

    it('should reject invalid UUID', async () => {
      const response = await request(app)
        .get('/test/user/not-a-uuid')
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ param: 'id' })
        ])
      );
    });

    it('should validate slug format', async () => {
      const response = await request(app)
        .get('/test/post/valid-slug-123')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        slug: 'valid-slug-123'
      });
    });

    it('should reject invalid slug format', async () => {
      const response = await request(app)
        .get('/test/post/Invalid_Slug!')
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ param: 'slug' })
        ])
      );
    });
  });

  describe('Complex Validation Rules', () => {
    beforeEach(() => {
      app.post('/test/booking',
        body('startTime').isISO8601(),
        body('endTime').isISO8601(),
        body('attendees').isArray({ min: 1, max: 10 }),
        body('attendees.*.email').isEmail(),
        body('attendees.*.name').notEmpty(),
        body('recurrence').optional().isObject(),
        body('recurrence.frequency').optional().isIn(['daily', 'weekly', 'monthly']),
        body('recurrence.interval').optional().isInt({ min: 1, max: 30 }),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, data: req.body });
        }
      );

      // Custom validation for date comparison
      app.post('/test/date-range',
        body('startDate').isISO8601(),
        body('endDate').isISO8601().custom((value, { req }) => {
          if (new Date(value) <= new Date(req.body.startDate)) {
            throw new Error('End date must be after start date');
          }
          return true;
        }),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, data: req.body });
        }
      );
    });

    it('should validate nested array objects', async () => {
      const response = await request(app)
        .post('/test/booking')
        .send({
          startTime: '2024-01-01T10:00:00Z',
          endTime: '2024-01-01T11:00:00Z',
          attendees: [
            { email: 'user1@example.com', name: 'User One' },
            { email: 'user2@example.com', name: 'User Two' }
          ]
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          attendees: expect.arrayContaining([
            expect.objectContaining({ email: 'user1@example.com' })
          ])
        }
      });
    });

    it('should reject invalid nested data', async () => {
      const response = await request(app)
        .post('/test/booking')
        .send({
          startTime: '2024-01-01T10:00:00Z',
          endTime: '2024-01-01T11:00:00Z',
          attendees: [
            { email: 'invalid-email', name: 'User One' },
            { email: 'user2@example.com', name: '' }
          ]
        })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ param: 'attendees[0].email' }),
          expect.objectContaining({ param: 'attendees[1].name' })
        ])
      );
    });

    it('should validate custom date comparison', async () => {
      const response = await request(app)
        .post('/test/date-range')
        .send({
          startDate: '2024-01-02',
          endDate: '2024-01-01' // End before start
        })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            param: 'endDate',
            msg: expect.stringContaining('after start date')
          })
        ])
      );
    });
  });

  describe('Conditional Validation', () => {
    beforeEach(() => {
      app.post('/test/conditional',
        body('type').isIn(['email', 'sms']),
        body('email').if(body('type').equals('email')).isEmail(),
        body('phone').if(body('type').equals('sms')).isMobilePhone(),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, data: req.body });
        }
      );

      app.post('/test/one-of',
        oneOf([
          body('email').isEmail(),
          body('username').isAlphanumeric().isLength({ min: 3 })
        ]),
        body('password').isLength({ min: 8 }),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, data: req.body });
        }
      );
    });

    it('should validate conditionally based on type', async () => {
      const emailResponse = await request(app)
        .post('/test/conditional')
        .send({
          type: 'email',
          email: 'test@example.com'
        })
        .expect(200);

      expect(emailResponse.body).toMatchObject({
        success: true,
        data: {
          type: 'email',
          email: 'test@example.com'
        }
      });

      const smsResponse = await request(app)
        .post('/test/conditional')
        .send({
          type: 'sms',
          phone: '+1234567890'
        })
        .expect(200);

      expect(smsResponse.body).toMatchObject({
        success: true,
        data: {
          type: 'sms',
          phone: '+1234567890'
        }
      });
    });

    it('should validate oneOf conditions', async () => {
      // Valid with email
      const emailResponse = await request(app)
        .post('/test/one-of')
        .send({
          email: 'test@example.com',
          password: 'Password123'
        })
        .expect(200);

      expect(emailResponse.body.success).toBe(true);

      // Valid with username
      const usernameResponse = await request(app)
        .post('/test/one-of')
        .send({
          username: 'testuser',
          password: 'Password123'
        })
        .expect(200);

      expect(usernameResponse.body.success).toBe(true);
    });

    it('should reject when neither oneOf condition is met', async () => {
      const response = await request(app)
        .post('/test/one-of')
        .send({
          password: 'Password123'
          // Neither email nor username provided
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('Error Message Customization', () => {
    beforeEach(() => {
      app.post('/test/custom-messages',
        body('email')
          .isEmail().withMessage('Please provide a valid email address')
          .normalizeEmail(),
        body('age')
          .isInt({ min: 18 }).withMessage('You must be at least 18 years old')
          .toInt(),
        body('website')
          .optional()
          .isURL().withMessage('Please provide a valid URL including http:// or https://'),
        validationMiddleware,
        (req, res) => {
          res.json({ success: true, data: req.body });
        }
      );
    });

    it('should return custom error messages', async () => {
      const response = await request(app)
        .post('/test/custom-messages')
        .send({
          email: 'invalid-email',
          age: 15,
          website: 'not-a-url'
        })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            param: 'email',
            msg: 'Please provide a valid email address'
          }),
          expect.objectContaining({
            param: 'age',
            msg: 'You must be at least 18 years old'
          }),
          expect.objectContaining({
            param: 'website',
            msg: 'Please provide a valid URL including http:// or https://'
          })
        ])
      );
    });
  });
});