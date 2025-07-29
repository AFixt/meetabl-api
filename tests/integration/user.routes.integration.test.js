/**
 * User Routes Integration Tests
 * Tests for user management endpoints
 */

const request = require('supertest');
const app = require('../../src/app');
const { User } = require('../../src/models');
const { v4: uuidv4 } = require('uuid');

describe('User Routes Integration Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      id: uuidv4(),
      firstName: 'User',
      lastName: 'Routes',
      email: `user-routes-${Date.now()}@meetabl.com`,
      password: 'UserRoutes123!',
      isActive: true,
      emailVerified: true,
      timezone: 'America/New_York'
    });

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'UserRoutes123!'
      });

    authToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await User.destroy({ where: { id: testUser.id } });
    }
  });

  describe('GET /api/users/profile', () => {
    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User profile retrieved successfully',
        data: {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          timezone: testUser.timezone
        }
      });

      // Should not include sensitive fields
      expect(response.body.data.password).toBeUndefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        timezone: 'Europe/London',
        bio: 'Updated bio'
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Profile updated successfully',
        data: {
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          timezone: updateData.timezone,
          bio: updateData.bio
        }
      });
    });

    it('should prevent email updates via profile endpoint', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'newemail@meetabl.com' })
        .expect(200);

      // Email should not be updated
      expect(response.body.data.email).toBe(testUser.email);
    });

    it('should validate timezone format', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ timezone: 'Invalid/Timezone' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('PUT /api/users/password', () => {
    it('should update password with correct current password', async () => {
      const passwordData = {
        currentPassword: 'UserRoutes123!',
        newPassword: 'NewUserRoutes123!',
        confirmPassword: 'NewUserRoutes123!'
      };

      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password updated successfully'
      });

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewUserRoutes123!'
        })
        .expect(200);

      // Update auth token
      authToken = loginResponse.body.data.accessToken;

      // Change password back
      await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'NewUserRoutes123!',
          newPassword: 'UserRoutes123!',
          confirmPassword: 'UserRoutes123!'
        });
    });

    it('should reject incorrect current password', async () => {
      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'UserRoutes123!',
          newPassword: 'weak',
          confirmPassword: 'weak'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should ensure passwords match', async () => {
      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'UserRoutes123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'DifferentPassword123!'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('POST /api/users/avatar', () => {
    it('should validate file upload', async () => {
      const response = await request(app)
        .post('/api/users/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    it('should require authentication for avatar upload', async () => {
      const response = await request(app)
        .post('/api/users/avatar')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });
  });

  describe('DELETE /api/users/account', () => {
    let userToDelete;
    let deleteAuthToken;

    beforeAll(async () => {
      // Create a separate user for deletion test
      userToDelete = await User.create({
        id: uuidv4(),
        firstName: 'Delete',
        lastName: 'Me',
        email: `delete-me-${Date.now()}@meetabl.com`,
        password: 'DeleteMe123!',
        isActive: true,
        emailVerified: true
      });

      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userToDelete.email,
          password: 'DeleteMe123!'
        });

      deleteAuthToken = loginResponse.body.data.accessToken;
    });

    it('should soft delete user account', async () => {
      const response = await request(app)
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${deleteAuthToken}`)
        .send({ 
          password: 'DeleteMe123!',
          reason: 'Testing account deletion'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Account deleted successfully'
      });

      // Verify cannot login after deletion
      await request(app)
        .post('/api/auth/login')
        .send({
          email: userToDelete.email,
          password: 'DeleteMe123!'
        })
        .expect(401);
    });

    it('should require correct password for deletion', async () => {
      const response = await request(app)
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          password: 'WrongPassword123!',
          reason: 'Should not delete'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'UNAUTHORIZED'
      });
    });
  });

  describe('GET /api/users/settings', () => {
    it('should get user settings', async () => {
      const response = await request(app)
        .get('/api/users/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User settings retrieved successfully',
        data: {
          userId: testUser.id,
          email_notifications: expect.any(Boolean),
          sms_notifications: expect.any(Boolean),
          calendar_sync: expect.any(Boolean)
        }
      });
    });
  });

  describe('PUT /api/users/settings', () => {
    it('should update user settings', async () => {
      const settingsData = {
        email_notifications: false,
        sms_notifications: true,
        calendar_sync: true,
        booking_buffer_time: 15,
        default_meeting_duration: 60
      };

      const response = await request(app)
        .put('/api/users/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(settingsData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Settings updated successfully',
        data: settingsData
      });
    });

    it('should validate settings values', async () => {
      const response = await request(app)
        .put('/api/users/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          booking_buffer_time: -10 // Invalid negative value
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    });
  });

  describe('GET /api/users/availability', () => {
    it('should get user availability', async () => {
      const response = await request(app)
        .get('/api/users/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should filter availability by date range', async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .get(`/api/users/availability?start=${startDate}&end=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });
    });
  });
});