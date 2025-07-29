/**
 * Availability Routes Integration Tests
 * Tests for availability management endpoints
 */

const request = require('supertest');
const app = require('../../src/app');
const { User, AvailabilityRule } = require('../../src/models');
const { v4: uuidv4 } = require('uuid');

describe('Availability Routes Integration Tests', () => {
  let authToken;
  let testUser;
  let testAvailabilityRule;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      id: uuidv4(),
      firstName: 'Availability',
      lastName: 'Test',
      email: `availability-test-${Date.now()}@meetabl.com`,
      password: 'AvailabilityTest123!',
      isActive: true,
      emailVerified: true,
      timezone: 'America/New_York'
    });

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'AvailabilityTest123!'
      });

    authToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    if (testAvailabilityRule) {
      await AvailabilityRule.destroy({ where: { id: testAvailabilityRule.id } });
    }
    if (testUser) {
      await User.destroy({ where: { id: testUser.id } });
    }
  });

  describe('GET /api/availability', () => {
    it('should get user availability rules', async () => {
      const response = await request(app)
        .get('/api/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Availability rules retrieved successfully',
        data: expect.any(Array)
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/availability')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });
  });

  describe('POST /api/availability', () => {
    it('should create availability rule', async () => {
      const availabilityData = {
        day_of_week: 1, // Monday
        start_time: '09:00',
        end_time: '17:00',
        is_available: true
      };

      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .send(availabilityData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Availability rule created successfully',
        data: {
          id: expect.any(String),
          userId: testUser.id,
          day_of_week: availabilityData.day_of_week,
          start_time: availabilityData.start_time,
          end_time: availabilityData.end_time,
          is_available: availabilityData.is_available
        }
      });

      // Store for cleanup
      testAvailabilityRule = response.body.data;
    });

    it('should validate day of week', async () => {
      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          day_of_week: 8, // Invalid (should be 0-6)
          start_time: '09:00',
          end_time: '17:00'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should validate time format', async () => {
      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          day_of_week: 2,
          start_time: 'invalid-time',
          end_time: '17:00'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should ensure end time is after start time', async () => {
      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          day_of_week: 3,
          start_time: '17:00',
          end_time: '09:00' // End before start
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should prevent duplicate rules for same day/time', async () => {
      // Try to create duplicate rule
      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          day_of_week: 1, // Same as existing rule
          start_time: '09:00',
          end_time: '17:00'
        })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'CONFLICT'
      });
    });
  });

  describe('PUT /api/availability/:id', () => {
    it('should update availability rule', async () => {
      const updateData = {
        start_time: '10:00',
        end_time: '18:00'
      };

      const response = await request(app)
        .put(`/api/availability/${testAvailabilityRule.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Availability rule updated successfully',
        data: {
          id: testAvailabilityRule.id,
          start_time: updateData.start_time,
          end_time: updateData.end_time
        }
      });
    });

    it('should prevent updating non-existent rule', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .put(`/api/availability/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ start_time: '11:00' })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'NOT_FOUND'
      });
    });

    it('should validate updated times', async () => {
      const response = await request(app)
        .put(`/api/availability/${testAvailabilityRule.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          start_time: '18:00',
          end_time: '10:00' // Invalid: end before start
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('DELETE /api/availability/:id', () => {
    let ruleToDelete;

    beforeAll(async () => {
      // Create a rule to delete
      const response = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          day_of_week: 5, // Friday
          start_time: '09:00',
          end_time: '17:00'
        });

      ruleToDelete = response.body.data;
    });

    it('should delete availability rule', async () => {
      const response = await request(app)
        .delete(`/api/availability/${ruleToDelete.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Availability rule deleted successfully'
      });

      // Verify deletion
      await request(app)
        .get(`/api/availability/${ruleToDelete.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent rule', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .delete(`/api/availability/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'NOT_FOUND'
      });
    });
  });

  describe('GET /api/availability/slots', () => {
    it('should get available time slots', async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .get(`/api/availability/slots?start=${startDate}&end=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Available slots retrieved successfully',
        data: expect.any(Array)
      });
    });

    it('should require date range parameters', async () => {
      const response = await request(app)
        .get('/api/availability/slots')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should validate date formats', async () => {
      const response = await request(app)
        .get('/api/availability/slots?start=invalid-date&end=also-invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should limit date range to prevent abuse', async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

      const response = await request(app)
        .get(`/api/availability/slots?start=${startDate}&end=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: expect.stringContaining('date range')
      });
    });
  });

  describe('POST /api/availability/bulk', () => {
    it('should create multiple availability rules', async () => {
      const bulkData = {
        rules: [
          {
            day_of_week: 2, // Tuesday
            start_time: '09:00',
            end_time: '17:00'
          },
          {
            day_of_week: 4, // Thursday
            start_time: '10:00',
            end_time: '16:00'
          }
        ]
      };

      const response = await request(app)
        .post('/api/availability/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('created successfully'),
        data: {
          created: 2,
          rules: expect.any(Array)
        }
      });

      // Clean up
      for (const rule of response.body.data.rules) {
        await AvailabilityRule.destroy({ where: { id: rule.id } });
      }
    });

    it('should validate all rules in bulk request', async () => {
      const response = await request(app)
        .post('/api/availability/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rules: [
            {
              day_of_week: 1,
              start_time: '09:00',
              end_time: '17:00'
            },
            {
              day_of_week: 8, // Invalid
              start_time: '10:00',
              end_time: '16:00'
            }
          ]
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should limit bulk operations', async () => {
      const tooManyRules = Array(51).fill({
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00'
      });

      const response = await request(app)
        .post('/api/availability/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rules: tooManyRules })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: expect.stringContaining('limit')
      });
    });
  });
});