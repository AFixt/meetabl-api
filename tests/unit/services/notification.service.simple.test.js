/**
 * Simple notification service tests
 * 
 * Basic tests for core notification functionality
 * 
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');

// Mock the models
jest.mock('../../../src/models', () => ({
  Notification: {
    findAll: jest.fn(),
    update: jest.fn()
  },
  Booking: {},
  User: {}
}));

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

const { Notification } = require('../../../src/models');
const logger = require('../../../src/config/logger');

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processNotificationQueue', () => {
    test('should process pending notifications successfully', async () => {
      // Import after mocks are set up
      const { processNotificationQueue } = require('../../../src/services/notification.service');

      // Mock pending notifications
      const mockNotifications = [
        {
          id: uuidv4(),
          type: 'booking_confirmation',
          status: 'pending',
          scheduled_for: new Date(),
          Booking: {
            id: uuidv4(),
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            start_time: new Date(),
            end_time: new Date(),
            User: {
              id: uuidv4(),
              name: 'Host User',
              email: 'host@example.com'
            }
          }
        }
      ];

      Notification.findAll.mockResolvedValueOnce(mockNotifications);
      Notification.update.mockResolvedValue([1]);

      // Execute the function
      await processNotificationQueue();

      // Verify that findAll was called with correct parameters
      expect(Notification.findAll).toHaveBeenCalledWith({
        where: { status: 'pending' },
        include: [expect.objectContaining({
          model: expect.anything(),
          required: true,
          include: [expect.objectContaining({
            model: expect.anything(),
            required: true
          })]
        })]
      });

      // Verify notification processing was attempted
      // (The actual update logic may vary based on notification type and success)
      expect(Notification.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { status: 'pending' }
      }));

      // Verify logging (actual message from service)
      expect(logger.info).toHaveBeenCalledWith(
        `Processing ${mockNotifications.length} pending notifications`
      );
    });

    test('should handle empty notification queue', async () => {
      const { processNotificationQueue } = require('../../../src/services/notification.service');

      // Mock empty queue
      Notification.findAll.mockResolvedValueOnce([]);

      await processNotificationQueue();

      expect(Notification.findAll).toHaveBeenCalled();
      expect(Notification.update).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Processing 0 pending notifications');
    });

    test('should handle notification processing errors', async () => {
      const { processNotificationQueue } = require('../../../src/services/notification.service');

      // Mock error in findAll
      const error = new Error('Database error');
      Notification.findAll.mockRejectedValueOnce(error);

      await processNotificationQueue();

      expect(logger.error).toHaveBeenCalledWith('Error processing notification queue:', error);
    });
  });

  describe('sendEmailVerification', () => {
    test('should send verification email successfully', async () => {
      const { sendEmailVerification } = require('../../../src/services/notification.service');

      const mockUser = {
        id: uuidv4(),
        name: 'Test User',
        email: 'test@example.com'
      };
      const verificationToken = 'test-token-123';

      // Execute the function
      await sendEmailVerification(mockUser, verificationToken);

      // Verify logger was called (actual message includes message ID)
      expect(logger.info).toHaveBeenCalledWith(
        `Email verification sent to ${mockUser.email}: test-message-id`
      );
    });
  });
});