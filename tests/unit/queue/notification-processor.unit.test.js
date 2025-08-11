/**
 * Queue notification processor unit tests
 *
 * Tests for BullMQ notification queue processor
 *
 * @author meetabl Team
 */

// Import test setup
require('../test-setup');

// Mock dependencies
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../src/services/notification.service', () => ({
  sendEmail: jest.fn(),
  sendSMS: jest.fn()
}));

jest.mock('../../../src/queue/index', () => ({
  createWorker: jest.fn()
}));

// Import after mocks
const notificationProcessor = require('../../../src/queue/notification-processor');
const logger = require('../../../src/config/logger');
const notificationService = require('../../../src/services/notification.service');
const { createWorker } = require('../../../src/queue/index');

describe('Queue Notification Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processNotification', () => {
    test('should process email notification successfully', async () => {
      // Mock job data for email
      const mockJob = {
        id: 'job-123',
        data: {
          type: 'email',
          bookingId: 'booking-456',
          templateName: 'booking_confirmation',
          recipient: 'test@example.com',
          templateData: { customerName: 'John Doe' }
        }
      };

      // Mock successful email service call
      notificationService.sendEmail.mockResolvedValueOnce();

      // Execute processor
      await notificationProcessor.processNotification(mockJob);

      // Verify service was called with correct parameters
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        'booking-456',
        'booking_confirmation',
        'test@example.com',
        { customerName: 'John Doe' }
      );

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Processing notification job:', {
        id: 'job-123',
        type: 'email'
      });
      expect(logger.info).toHaveBeenCalledWith('Notification sent successfully', {
        id: 'job-123'
      });

      // Verify SMS service was not called
      expect(notificationService.sendSMS).not.toHaveBeenCalled();
    });

    test('should process SMS notification successfully', async () => {
      // Mock job data for SMS
      const mockJob = {
        id: 'job-789',
        data: {
          type: 'sms',
          bookingId: 'booking-123',
          recipient: '+1234567890',
          message: 'Your booking is confirmed'
        }
      };

      // Mock successful SMS service call
      notificationService.sendSMS.mockResolvedValueOnce();

      // Execute processor
      await notificationProcessor.processNotification(mockJob);

      // Verify service was called with correct parameters
      expect(notificationService.sendSMS).toHaveBeenCalledWith(
        'booking-123',
        '+1234567890',
        'Your booking is confirmed'
      );

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Processing notification job:', {
        id: 'job-789',
        type: 'sms'
      });
      expect(logger.info).toHaveBeenCalledWith('Notification sent successfully', {
        id: 'job-789'
      });

      // Verify email service was not called
      expect(notificationService.sendEmail).not.toHaveBeenCalled();
    });

    test('should throw error for unknown notification type', async () => {
      // Mock job data with unknown type
      const mockJob = {
        id: 'job-unknown',
        data: {
          type: 'push',
          message: 'Push notification'
        }
      };

      // Execute processor and expect error
      await expect(notificationProcessor.processNotification(mockJob))
        .rejects.toThrow('Unknown notification type: push');

      // Verify error logging
      expect(logger.error).toHaveBeenCalledWith('Error processing notification:', expect.any(Error));

      // Verify no services were called
      expect(notificationService.sendEmail).not.toHaveBeenCalled();
      expect(notificationService.sendSMS).not.toHaveBeenCalled();
    });

    test('should handle email service errors', async () => {
      // Mock job data for email
      const mockJob = {
        id: 'job-email-error',
        data: {
          type: 'email',
          bookingId: 'booking-456',
          templateName: 'booking_confirmation',
          recipient: 'test@example.com',
          templateData: {}
        }
      };

      // Mock email service error
      const serviceError = new Error('SMTP connection failed');
      notificationService.sendEmail.mockRejectedValueOnce(serviceError);

      // Execute processor and expect error
      await expect(notificationProcessor.processNotification(mockJob))
        .rejects.toThrow('SMTP connection failed');

      // Verify service was called
      expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);

      // Verify error logging
      expect(logger.error).toHaveBeenCalledWith('Error processing notification:', serviceError);

      // Verify success log was not called
      expect(logger.info).not.toHaveBeenCalledWith('Notification sent successfully', expect.any(Object));
    });

    test('should handle SMS service errors', async () => {
      // Mock job data for SMS
      const mockJob = {
        id: 'job-sms-error',
        data: {
          type: 'sms',
          bookingId: 'booking-123',
          recipient: '+1234567890',
          message: 'Test message'
        }
      };

      // Mock SMS service error
      const serviceError = new Error('Twilio API error');
      notificationService.sendSMS.mockRejectedValueOnce(serviceError);

      // Execute processor and expect error
      await expect(notificationProcessor.processNotification(mockJob))
        .rejects.toThrow('Twilio API error');

      // Verify service was called
      expect(notificationService.sendSMS).toHaveBeenCalledTimes(1);

      // Verify error logging
      expect(logger.error).toHaveBeenCalledWith('Error processing notification:', serviceError);
    });

    test('should handle missing job data gracefully', async () => {
      // Mock job with missing data
      const mockJob = {
        id: 'job-missing-data',
        data: {
          type: 'email'
          // Missing required fields
        }
      };

      // Mock service error due to missing data
      notificationService.sendEmail.mockRejectedValueOnce(new Error('Missing required parameters'));

      // Execute processor and expect error
      await expect(notificationProcessor.processNotification(mockJob))
        .rejects.toThrow('Missing required parameters');

      // Verify error logging
      expect(logger.error).toHaveBeenCalledWith('Error processing notification:', expect.any(Error));
    });

    test('should handle job with malformed data', async () => {
      // Mock job with malformed data structure
      const mockJob = {
        id: 'job-malformed',
        data: {
          // Missing type property
          recipient: 'test@example.com'
        }
      };

      // Execute processor and expect error
      await expect(notificationProcessor.processNotification(mockJob))
        .rejects.toThrow('Unknown notification type: undefined');

      // Verify error logging occurred
      expect(logger.error).toHaveBeenCalledWith('Error processing notification:', expect.any(Error));
    });
  });

  describe('startWorker', () => {
    test('should start notification worker successfully', () => {
      // Mock worker instance
      const mockWorker = {
        on: jest.fn(),
        close: jest.fn()
      };
      createWorker.mockReturnValueOnce(mockWorker);

      // Execute startWorker
      const worker = notificationProcessor.startWorker();

      // Verify createWorker was called with correct parameters
      expect(createWorker).toHaveBeenCalledWith('notification', notificationProcessor.processNotification);

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Starting notification queue worker');

      // Verify worker was returned
      expect(worker).toBe(mockWorker);
    });

    test('should handle worker creation errors', () => {
      // Mock createWorker error
      const workerError = new Error('Failed to create worker');
      createWorker.mockImplementation(() => {
        throw workerError;
      });

      // Execute startWorker and expect error
      expect(() => notificationProcessor.startWorker()).toThrow('Failed to create worker');

      // Verify createWorker was called
      expect(createWorker).toHaveBeenCalledWith('notification', notificationProcessor.processNotification);

      // Verify start logging
      expect(logger.info).toHaveBeenCalledWith('Starting notification queue worker');
    });
  });
});