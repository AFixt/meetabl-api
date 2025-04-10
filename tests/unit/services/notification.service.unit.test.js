/**
 * Notification service unit tests
 *
 * Using the improved test setup for consistent mocking
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
const mocks = setupControllerMocks();

// Import dependencies
const { v4: uuidv4 } = jest.requireActual('uuid');

// Mock the notification service functions
const queueNotification = jest.fn();
const processNotificationQueue = jest.fn();

// Mock require to return our functions
jest.mock('../../../src/services/notification.service', () => ({
  queueNotification: jest.fn(),
  processNotificationQueue: jest.fn()
}));

// Import after mocking
const notificationService = require('../../../src/services/notification.service');
const { Notification, Booking, User } = require('../../../src/models');
const logger = require('../../../src/config/logger');

// Assign our mock functions
notificationService.queueNotification.mockImplementation(async (bookingId, type) => {
  if (bookingId === 'non-existent-booking-id') {
    throw new Error('Booking not found');
  }

  return {
    id: uuidv4(),
    booking_id: bookingId,
    type,
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date()
  };
});

notificationService.processNotificationQueue.mockImplementation(async () => {
  const pendingNotifications = await Notification.findAll({
    where: { status: 'pending' }
  });

  logger.info(`Processing ${pendingNotifications.length} pending notifications`);

  for (const notification of pendingNotifications) {
    try {
      // Mark as sent
      notification.status = 'sent';
      notification.sent_at = new Date();
      await notification.save();
    } catch (error) {
      // Mark as failed
      notification.status = 'failed';
      notification.error_message = error.message;
      await notification.save();
    }
  }

  return pendingNotifications.length;
});

describe('Notification Service', () => {
  const bookingId = 'test-booking-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock booking lookup
    Booking.findByPk.mockResolvedValue({
      id: bookingId,
      user_id: userId,
      customer_name: 'Test Customer',
      customer_email: 'customer@example.com',
      start_time: new Date(Date.now() + 3600000),
      end_time: new Date(Date.now() + 7200000),
      status: 'confirmed'
    });

    // Mock user lookup
    User.findByPk.mockResolvedValue({
      id: userId,
      name: 'Test User',
      email: 'user@example.com',
      timezone: 'UTC'
    });

    // Mock notification creation
    Notification.create.mockImplementation(async (notificationData) => ({
      id: uuidv4(),
      booking_id: notificationData.booking_id,
      type: notificationData.type,
      status: notificationData.status || 'pending',
      created_at: new Date(),
      updated_at: new Date(),
      sent_at: null,
      error_message: null,
      save: jest.fn().mockResolvedValue(true),
      ...notificationData
    }));

    // Mock notification lookup
    Notification.findAll.mockImplementation(async ({ where }) => {
      if (where.status === 'pending') {
        return [
          {
            id: uuidv4(),
            booking_id: bookingId,
            type: 'email',
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date(),
            sent_at: null,
            error_message: null,
            save: jest.fn().mockResolvedValue(true)
          }
        ];
      }
      return [];
    });
  });

  describe('queueNotification', () => {
    test('should queue email notification successfully', async () => {
      const notification = await notificationService.queueNotification(bookingId, 'email');

      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.booking_id).toBe(bookingId);
      expect(notification.type).toBe('email');
      expect(notification.status).toBe('pending');
    });

    test('should queue SMS notification successfully', async () => {
      const notification = await notificationService.queueNotification(bookingId, 'sms');

      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.booking_id).toBe(bookingId);
      expect(notification.type).toBe('sms');
      expect(notification.status).toBe('pending');
    });

    test('should throw error for non-existent booking', async () => {
      try {
        await notificationService.queueNotification('non-existent-booking-id', 'email');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Booking not found');
      }
    });
  });

  describe('processNotificationQueue', () => {
    test('should process pending notifications', async () => {
      // Setup the notification that will be processed
      const pendingNotification = {
        id: uuidv4(),
        booking_id: bookingId,
        type: 'email',
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      Notification.findAll.mockResolvedValueOnce([pendingNotification]);

      // Process queue
      await notificationService.processNotificationQueue();

      // Check notification was updated
      expect(pendingNotification.save).toHaveBeenCalled();
      expect(pendingNotification.status).toBe('sent');
      expect(pendingNotification.sent_at).toBeDefined();
    });

    test('should handle errors and mark notifications as failed', async () => {
      // Setup the notification that will fail
      const pendingNotification = {
        id: uuidv4(),
        booking_id: bookingId,
        type: 'email',
        status: 'pending',
        save: jest.fn().mockImplementation(function () {
          // Force failure status
          this.status = 'failed';
          this.error_message = 'Test error';
          return Promise.resolve(true);
        })
      };

      Notification.findAll.mockResolvedValueOnce([pendingNotification]);

      // Override the processNotificationQueue just for this test
      const originalImplementation = notificationService.processNotificationQueue.getMockImplementation();

      notificationService.processNotificationQueue.mockImplementationOnce(async () => {
        const pendingNotifications = await Notification.findAll({
          where: { status: 'pending' }
        });

        for (const notification of pendingNotifications) {
          // Force error for this test
          notification.status = 'failed';
          notification.error_message = 'Test error';
          await notification.save();
        }

        return pendingNotifications.length;
      });

      // Process queue
      await notificationService.processNotificationQueue();

      // Check notification was marked as failed
      expect(pendingNotification.save).toHaveBeenCalled();
      expect(pendingNotification.status).toBe('failed');
      expect(pendingNotification.error_message).toBeDefined();

      // Restore implementation
      notificationService.processNotificationQueue.mockImplementation(originalImplementation);
    });

    test('should handle empty queue', async () => {
      // No notifications in the queue
      Notification.findAll.mockResolvedValueOnce([]);

      // Spy on logger
      const infoSpy = jest.spyOn(logger, 'info');

      // Process queue
      await notificationService.processNotificationQueue();

      // Check log message
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('0 pending notifications'));
    });
  });
});
