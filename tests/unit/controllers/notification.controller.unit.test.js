/**
 * Notification controller unit tests
 *
 * Tests for the notification controller functionality
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup controller mocks
setupControllerMocks();

// Import controller after mocks are set up
const {
  getNotificationHistory,
  getNotificationStats,
  markNotificationRead,
  sendTestNotification,
  resendNotification
} = require('../../../src/controllers/notification.controller');

// Ensure createMockRequest, createMockResponse are available
if (typeof global.createMockRequest !== 'function'
    || typeof global.createMockResponse !== 'function') {
  global.createMockRequest = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: 'test-user-id' },
    ...overrides
  });

  global.createMockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  };
}

describe('Notification Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotificationHistory', () => {
    test('should get notification history successfully', async () => {
      // Mock dependencies
      const { Notification, Booking } = require('../../../src/models');
      
      // Mock notification data
      const mockNotifications = {
        count: 2,
        rows: [
          {
            id: 'notif-1',
            type: 'email',
            status: 'sent',
            sent_at: new Date(),
            Booking: {
              id: 'booking-1',
              customer_name: 'John Doe',
              customer_email: 'john@example.com'
            }
          },
          {
            id: 'notif-2',
            type: 'sms',
            status: 'pending',
            sent_at: null,
            Booking: {
              id: 'booking-2',
              customer_name: 'Jane Smith',
              customer_email: 'jane@example.com'
            }
          }
        ]
      };

      Notification.findAndCountAll.mockResolvedValueOnce(mockNotifications);

      // Create request
      const req = createMockRequest({
        query: { limit: 10, offset: 0 }
      });
      const res = createMockResponse();

      // Execute the controller
      await getNotificationHistory(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        notifications: mockNotifications.rows
      });

      // Verify pagination headers
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'X-Total-Count': 2,
        'X-Total-Pages': 1
      }));
    });

    test('should filter notifications by type and status', async () => {
      // Mock dependencies
      const { Notification } = require('../../../src/models');
      
      Notification.findAndCountAll.mockResolvedValueOnce({
        count: 1,
        rows: [{ id: 'notif-1', type: 'email', status: 'sent' }]
      });

      // Create request with filters
      const req = createMockRequest({
        query: { type: 'email', status: 'sent' }
      });
      const res = createMockResponse();

      // Execute the controller
      await getNotificationHistory(req, res);

      // Verify filters were applied
      expect(Notification.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'email',
            status: 'sent'
          })
        })
      );
    });

    test('should handle database errors', async () => {
      // Mock database error
      const { Notification } = require('../../../src/models');
      Notification.findAndCountAll.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = createMockRequest();
      const res = createMockResponse();

      // Execute the controller
      await getNotificationHistory(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'internal_server_error'
        })
      }));
    });
  });

  describe('getNotificationStats', () => {
    test('should get notification statistics successfully', async () => {
      // Mock dependencies
      const { Notification } = require('../../../src/models');
      
      // Mock raw statistics data
      const mockStats = [
        { type: 'email', status: 'sent', count: '5' },
        { type: 'email', status: 'failed', count: '1' },
        { type: 'sms', status: 'sent', count: '3' },
        { type: 'sms', status: 'pending', count: '2' }
      ];

      Notification.findAll.mockResolvedValueOnce(mockStats);

      // Create request
      const req = createMockRequest({
        query: {}
      });
      const res = createMockResponse();

      // Execute the controller
      await getNotificationStats(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        statistics: expect.objectContaining({
          email: expect.objectContaining({
            sent: 5,
            failed: 1,
            pending: 0,
            total: 6
          }),
          sms: expect.objectContaining({
            sent: 3,
            pending: 2,
            failed: 0,
            total: 5
          }),
          total: expect.objectContaining({
            sent: 8,
            pending: 2,
            failed: 1,
            total: 11
          })
        })
      }));
    });

    test('should filter statistics by date range', async () => {
      // Mock dependencies
      const { Notification, sequelize } = require('../../../src/models');
      
      Notification.findAll.mockResolvedValueOnce([]);

      // Create request with date filters
      const req = createMockRequest({
        query: {
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        }
      });
      const res = createMockResponse();

      // Execute the controller
      await getNotificationStats(req, res);

      // Verify the function was called
      expect(Notification.findAll).toHaveBeenCalled();
      
      // Verify response was successful
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        period: {
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        }
      }));
    });
  });

  describe('markNotificationRead', () => {
    test('should mark notification as read successfully', async () => {
      // Mock dependencies
      const { Notification, AuditLog, sequelize } = require('../../../src/models');
      
      // Mock notification
      const mockNotification = {
        id: 'notif-1',
        booking_id: 'booking-1',
        error_message: null,
        save: jest.fn().mockResolvedValue({})
      };

      Notification.findOne.mockResolvedValueOnce(mockNotification);

      // Create request
      const req = createMockRequest({
        params: { id: 'notif-1' }
      });
      const res = createMockResponse();

      // Execute the controller
      await markNotificationRead(req, res);

      // Verify notification was updated
      expect(mockNotification.save).toHaveBeenCalled();
      expect(JSON.parse(mockNotification.error_message)).toHaveProperty('read_at');

      // Verify audit log
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user-id',
          action: 'notification.read'
        }),
        expect.any(Object)
      );

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Notification marked as read'
      }));
    });

    test('should return 404 for non-existent notification', async () => {
      // Mock notification not found
      const { Notification } = require('../../../src/models');
      Notification.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = createMockRequest({
        params: { id: 'non-existent' }
      });
      const res = createMockResponse();

      // Execute the controller
      await markNotificationRead(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'not_found'
        })
      }));
    });
  });

  describe('sendTestNotification', () => {
    test('should send test notification successfully', async () => {
      // Mock dependencies
      const { Notification, Booking, User, AuditLog } = require('../../../src/models');
      const notificationService = require('../../../src/services/notification.service');
      
      // Mock user
      User.findByPk.mockResolvedValueOnce({
        id: 'test-user-id',
        email: 'test@example.com'
      });

      // Mock booking creation
      const mockBooking = {
        id: 'test-booking-id',
        user_id: 'test-user-id'
      };
      Booking.create.mockResolvedValueOnce(mockBooking);

      // Mock notification creation
      const mockNotification = {
        id: 'test-notif-id',
        type: 'email',
        booking_id: 'test-booking-id'
      };
      Notification.create.mockResolvedValueOnce(mockNotification);

      // Create request
      const req = createMockRequest({
        body: { type: 'email' }
      });
      const res = createMockResponse();

      // Execute the controller
      await sendTestNotification(req, res);

      // Verify booking was created
      expect(Booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'test@example.com',
          description: 'TEST NOTIFICATION - This is a test booking'
        }),
        expect.any(Object)
      );

      // Verify notification was created
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email',
          status: 'pending'
        }),
        expect.any(Object)
      );

      // Verify notification was queued
      expect(notificationService.queueNotification).toHaveBeenCalledWith(
        'test-booking-id',
        'email'
      );

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test email notification queued successfully'
      }));
    });

    test('should use existing booking if provided', async () => {
      // Mock dependencies
      const { Notification, Booking } = require('../../../src/models');
      
      // Mock existing booking
      const mockBooking = {
        id: 'existing-booking-id',
        user_id: 'test-user-id'
      };
      Booking.findOne.mockResolvedValueOnce(mockBooking);

      // Mock notification creation
      Notification.create.mockResolvedValueOnce({
        id: 'test-notif-id',
        type: 'sms'
      });

      // Create request
      const req = createMockRequest({
        body: { 
          type: 'sms',
          booking_id: 'existing-booking-id'
        }
      });
      const res = createMockResponse();

      // Execute the controller
      await sendTestNotification(req, res);

      // Verify existing booking was used
      expect(Booking.create).not.toHaveBeenCalled();
      expect(Booking.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'existing-booking-id',
            user_id: 'test-user-id'
          }
        })
      );
    });

    test('should validate notification type', async () => {
      // Create request with invalid type
      const req = createMockRequest({
        body: { type: 'invalid' }
      });
      const res = createMockResponse();

      // Execute the controller
      await sendTestNotification(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'bad_request',
          message: 'Valid notification type is required (email or sms)'
        })
      }));
    });
  });

  describe('resendNotification', () => {
    test('should resend failed notification successfully', async () => {
      // Mock dependencies
      const { Notification, AuditLog } = require('../../../src/models');
      const notificationService = require('../../../src/services/notification.service');
      
      // Mock failed notification
      const mockNotification = {
        id: 'notif-1',
        booking_id: 'booking-1',
        type: 'email',
        status: 'failed',
        error_message: 'Previous error',
        save: jest.fn().mockResolvedValue({})
      };

      Notification.findOne.mockResolvedValueOnce(mockNotification);

      // Create request
      const req = createMockRequest({
        params: { id: 'notif-1' }
      });
      const res = createMockResponse();

      // Execute the controller
      await resendNotification(req, res);

      // Verify notification was reset
      expect(mockNotification.status).toBe('pending');
      expect(mockNotification.error_message).toBeNull();
      expect(mockNotification.save).toHaveBeenCalled();

      // Verify notification was queued
      expect(notificationService.queueNotification).toHaveBeenCalledWith(
        'booking-1',
        'email'
      );

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Notification queued for resend'
      }));
    });

    test('should only resend failed notifications', async () => {
      // Mock notification that's not failed
      const { Notification } = require('../../../src/models');
      Notification.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = createMockRequest({
        params: { id: 'notif-1' }
      });
      const res = createMockResponse();

      // Execute the controller
      await resendNotification(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'not_found',
          message: 'Failed notification not found'
        })
      }));
    });
  });
});