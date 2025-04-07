/**
 * Notification service tests
 * 
 * @author AccessMeet Team
 */

const { queueNotification, processNotificationQueue } = require('../../../src/services/notification.service');
const { Notification, Booking } = require('../../../src/models');
const logger = require('../../../src/config/logger');
const { 
  setupTestDatabase, 
  clearDatabase, 
  createTestUser, 
  createBooking, 
  createNotification 
} = require('../../fixtures/db');

describe('Notification Service', () => {
  let user;
  let booking;

  // Setup and teardown
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    user = await createTestUser();
    booking = await createBooking(user.id);
  });

  afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
  });

  describe('queueNotification', () => {
    test('should queue email notification successfully', async () => {
      const notification = await queueNotification(booking.id, 'email');
      
      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.booking_id).toBe(booking.id);
      expect(notification.type).toBe('email');
      expect(notification.status).toBe('pending');
      
      // Check notification was created in database
      const dbNotification = await Notification.findByPk(notification.id);
      expect(dbNotification).toBeDefined();
    });

    test('should queue SMS notification successfully', async () => {
      const notification = await queueNotification(booking.id, 'sms');
      
      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.booking_id).toBe(booking.id);
      expect(notification.type).toBe('sms');
      expect(notification.status).toBe('pending');
    });

    test('should throw error for non-existent booking', async () => {
      try {
        await queueNotification('non-existent-booking-id', 'email');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('processNotificationQueue', () => {
    test('should process pending notifications', async () => {
      // Create pending notification
      await createNotification(booking.id, { status: 'pending' });
      
      // Process queue
      await processNotificationQueue();
      
      // Check notification was updated
      const notifications = await Notification.findAll({
        where: { booking_id: booking.id }
      });
      
      expect(notifications).toHaveLength(1);
      expect(notifications[0].status).toBe('sent');
      expect(notifications[0].sent_at).toBeDefined();
    });

    test('should handle errors and mark notifications as failed', async () => {
      // Mock Booking.findOne to throw error
      const originalFindOne = Booking.findOne;
      Booking.findOne = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // Create pending notification
      const notification = await createNotification(booking.id, { status: 'pending' });
      
      // Process queue
      await processNotificationQueue();
      
      // Check notification was marked as failed
      const updatedNotification = await Notification.findByPk(notification.id);
      expect(updatedNotification.status).toBe('failed');
      expect(updatedNotification.error_message).toBeDefined();
      
      // Restore original method
      Booking.findOne = originalFindOne;
    });

    test('should handle empty queue', async () => {
      // No notifications in the queue
      
      // Spy on logger
      const infoSpy = jest.spyOn(logger, 'info');
      
      // Process queue
      await processNotificationQueue();
      
      // Check log message
      expect(infoSpy).toHaveBeenCalledWith('Processing 0 pending notifications');
    });
  });
});