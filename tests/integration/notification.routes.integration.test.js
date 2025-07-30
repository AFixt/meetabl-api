/**
 * Notification Routes Integration Tests
 * Tests for notification management endpoints
 */

const request = require('supertest');
const { getTestApp } = require('./test-app');
const { User, Notification, Booking } = require('../../src/models');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

// Mock email and SMS services
jest.mock('../../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-email-id' })
}));

jest.mock('../../src/services/sms.service', () => ({
  sendSMS: jest.fn().mockResolvedValue({ sid: 'test-sms-id' })
}));

describe('Notification Routes Integration Tests', () => {
  let app;
  let testUser;
  let authToken;
  let testNotification;
  let testBooking;

  beforeAll(async () => {
    // Initialize app
    app = await getTestApp();
    
    // Create test user
    testUser = await User.create({
      id: uuidv4(),
      firstName: 'Notification',
      lastName: 'Test',
      email: 'notification-test@meetabl.com',
      password: await bcrypt.hash('NotificationTest123!', 10),
      timezone: 'America/New_York',
      isActive: true,
      isEmailVerified: true,
      phoneNumber: '+1234567890'
    });

    // Generate auth token
    authToken = jwt.sign(
      { 
        id: testUser.id, 
        email: testUser.email,
        type: 'access'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test booking for notifications
    testBooking = await Booking.create({
      id: uuidv4(),
      hostId: testUser.id,
      attendeeEmail: 'attendee@example.com',
      attendeeName: 'Test Attendee',
      startTime: new Date(Date.now() + 86400000), // Tomorrow
      endTime: new Date(Date.now() + 90000000), // Tomorrow + 1 hour
      title: 'Test Meeting',
      status: 'confirmed',
      duration: 60,
      location: 'Online'
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testNotification) {
      await Notification.destroy({ where: { id: testNotification.id } });
    }
    if (testBooking) {
      await Booking.destroy({ where: { id: testBooking.id } });
    }
    if (testUser) {
      await User.destroy({ where: { id: testUser.id } });
    }
  });

  describe('GET /api/notifications', () => {
    beforeAll(async () => {
      // Create test notifications
      const notifications = [];
      for (let i = 0; i < 5; i++) {
        notifications.push({
          id: uuidv4(),
          userId: testUser.id,
          type: i % 2 === 0 ? 'email' : 'sms',
          template: 'booking_confirmation',
          recipient: i % 2 === 0 ? testUser.email : testUser.phoneNumber,
          subject: `Test Notification ${i + 1}`,
          status: i === 0 ? 'failed' : 'sent',
          metadata: {
            bookingId: testBooking.id,
            attemptCount: i === 0 ? 3 : 1
          },
          sentAt: i === 0 ? null : new Date(),
          createdAt: new Date(Date.now() - (i * 3600000)) // Stagger creation times
        });
      }
      await Notification.bulkCreate(notifications);
      testNotification = notifications[0];
    });

    it('should retrieve notification history', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          notifications: expect.arrayContaining([
            expect.objectContaining({
              userId: testUser.id,
              type: expect.stringMatching(/^(email|sms)$/),
              status: expect.stringMatching(/^(sent|failed)$/)
            })
          ])
        }
      });

      expect(response.body.data.notifications).toHaveLength(5);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/notifications?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          notifications: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            limit: 2,
            total: 5,
            pages: 3
          })
        }
      });

      expect(response.body.data.notifications).toHaveLength(2);
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/notifications?type=email')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.notifications).toSatisfyAll(
        notification => notification.type === 'email'
      );
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/notifications?status=failed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.notifications[0].status).toBe('failed');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/notifications')
        .expect(401);
    });
  });

  describe('GET /api/notifications/stats', () => {
    it('should retrieve notification statistics', async () => {
      const response = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          stats: expect.objectContaining({
            total: 5,
            byType: expect.objectContaining({
              email: 3,
              sms: 2
            }),
            byStatus: expect.objectContaining({
              sent: 4,
              failed: 1
            }),
            successRate: 0.8,
            recentActivity: expect.any(Array)
          })
        }
      });
    });

    it('should include time-based statistics', async () => {
      const response = await request(app)
        .get('/api/notifications/stats?period=week')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.stats).toHaveProperty('byDay');
      expect(response.body.data.stats.byDay).toBeInstanceOf(Array);
      expect(response.body.data.stats.byDay).toHaveLength(7);
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      // Create an unread notification
      const unreadNotification = await Notification.create({
        id: uuidv4(),
        userId: testUser.id,
        type: 'email',
        template: 'booking_reminder',
        recipient: testUser.email,
        subject: 'Unread Notification',
        status: 'sent',
        isRead: false
      });

      const response = await request(app)
        .put(`/api/notifications/${unreadNotification.id}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Notification marked as read',
        data: {
          notification: expect.objectContaining({
            id: unreadNotification.id,
            isRead: true
          })
        }
      });

      // Verify in database
      const updated = await Notification.findByPk(unreadNotification.id);
      expect(updated.isRead).toBe(true);

      // Clean up
      await Notification.destroy({ where: { id: unreadNotification.id } });
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .put(`/api/notifications/${fakeId}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Notification not found'
      });
    });

    it('should prevent marking other user\'s notifications', async () => {
      // Create another user's notification
      const otherUser = await User.create({
        id: uuidv4(),
        firstName: 'Other',
        lastName: 'User',
        email: 'other-user@meetabl.com',
        password: await bcrypt.hash('OtherUser123!', 10),
        timezone: 'America/New_York'
      });

      const otherNotification = await Notification.create({
        id: uuidv4(),
        userId: otherUser.id,
        type: 'email',
        template: 'booking_confirmation',
        recipient: otherUser.email,
        subject: 'Other User Notification',
        status: 'sent'
      });

      await request(app)
        .put(`/api/notifications/${otherNotification.id}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      // Clean up
      await Notification.destroy({ where: { id: otherNotification.id } });
      await User.destroy({ where: { id: otherUser.id } });
    });
  });

  describe('POST /api/notifications/:id/resend', () => {
    it('should resend failed notification', async () => {
      // Create a failed notification
      const failedNotification = await Notification.create({
        id: uuidv4(),
        userId: testUser.id,
        type: 'email',
        template: 'booking_confirmation',
        recipient: testUser.email,
        subject: 'Failed Notification',
        status: 'failed',
        metadata: {
          bookingId: testBooking.id,
          attemptCount: 1
        }
      });

      const response = await request(app)
        .post(`/api/notifications/${failedNotification.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Notification resent successfully',
        data: {
          notification: expect.objectContaining({
            id: failedNotification.id,
            status: 'sent',
            metadata: expect.objectContaining({
              attemptCount: 2,
              resentAt: expect.any(String)
            })
          })
        }
      });

      // Clean up
      await Notification.destroy({ where: { id: failedNotification.id } });
    });

    it('should not resend already sent notifications', async () => {
      // Create a sent notification
      const sentNotification = await Notification.create({
        id: uuidv4(),
        userId: testUser.id,
        type: 'email',
        template: 'booking_confirmation',
        recipient: testUser.email,
        subject: 'Sent Notification',
        status: 'sent',
        sentAt: new Date()
      });

      const response = await request(app)
        .post(`/api/notifications/${sentNotification.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Only failed notifications can be resent'
      });

      // Clean up
      await Notification.destroy({ where: { id: sentNotification.id } });
    });

    it('should respect retry limits', async () => {
      // Create a notification that has reached retry limit
      const maxRetriesNotification = await Notification.create({
        id: uuidv4(),
        userId: testUser.id,
        type: 'email',
        template: 'booking_confirmation',
        recipient: testUser.email,
        subject: 'Max Retries Notification',
        status: 'failed',
        metadata: {
          attemptCount: 5 // Assuming max retries is 5
        }
      });

      const response = await request(app)
        .post(`/api/notifications/${maxRetriesNotification.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Maximum retry attempts reached'
      });

      // Clean up
      await Notification.destroy({ where: { id: maxRetriesNotification.id } });
    });
  });

  describe('POST /api/notifications/test', () => {
    it('should send test email notification', async () => {
      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'email',
          template: 'test_notification'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Test notification sent successfully',
        data: {
          notification: expect.objectContaining({
            type: 'email',
            recipient: testUser.email,
            template: 'test_notification',
            status: 'sent'
          })
        }
      });
    });

    it('should send test SMS notification', async () => {
      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'sms',
          template: 'test_notification'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Test notification sent successfully',
        data: {
          notification: expect.objectContaining({
            type: 'sms',
            recipient: testUser.phoneNumber,
            template: 'test_notification',
            status: 'sent'
          })
        }
      });
    });

    it('should validate notification type', async () => {
      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'invalid',
          template: 'test_notification'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid notification type')
      });
    });

    it('should require phone number for SMS', async () => {
      // Create user without phone
      const userNoPhone = await User.create({
        id: uuidv4(),
        firstName: 'No',
        lastName: 'Phone',
        email: 'no-phone@meetabl.com',
        password: await bcrypt.hash('NoPhone123!', 10),
        timezone: 'America/New_York'
      });

      const noPhoneToken = jwt.sign(
        { 
          id: userNoPhone.id, 
          email: userNoPhone.email,
          type: 'access'
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${noPhoneToken}`)
        .send({
          type: 'sms',
          template: 'test_notification'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Phone number required for SMS notifications'
      });

      // Clean up
      await User.destroy({ where: { id: userNoPhone.id } });
    });
  });
});