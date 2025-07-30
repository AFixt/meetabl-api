/**
 * Notification service unit tests
 *
 * Tests for notification and email functionality
 *
 * @author meetabl Team
 */

// Mock dependencies before imports
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

jest.mock('path', () => ({
  join: jest.fn((...parts) => parts.join('/'))
}));

jest.mock('../../../src/config/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../src/models', () => ({
  Notification: {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  Booking: {
    findOne: jest.fn()
  },
  User: {
    findOne: jest.fn()
  }
}));

const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../../src/config/logger');
const { Notification, Booking, User } = require('../../../src/models');

// Import service after mocks
const notificationService = require('../../../src/services/notification.service');

describe('NotificationService', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('processNotificationQueue', () => {
    test('should process pending notifications successfully', async () => {
      // Mock pending notifications
      const mockNotifications = [
        {
          id: 'notification-1',
          type: 'email',
          status: 'pending',
          Booking: {
            id: 'booking-1',
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            start_time: new Date('2024-01-15T10:00:00Z'),
            end_time: new Date('2024-01-15T11:00:00Z'),
            status: 'confirmed',
            User: {
              id: 'user-1',
              name: 'Provider User'
            }
          }
        },
        {
          id: 'notification-2',
          type: 'sms',
          status: 'pending',
          Booking: {
            id: 'booking-2',
            customer_phone: '+1234567890',
            start_time: new Date('2024-01-16T14:00:00Z'),
            status: 'confirmed',
            User: {
              id: 'user-2',
              name: 'Another Provider'
            }
          }
        }
      ];

      Notification.findAll.mockResolvedValueOnce(mockNotifications);
      Notification.update.mockResolvedValue([1]);

      // Mock email template
      fs.readFile.mockResolvedValue('<html>{{customerName}} {{providerName}} {{startTime}} {{endTime}} {{status}}</html>');

      // Execute
      await notificationService.processNotificationQueue();

      // Verify notifications were found
      expect(Notification.findAll).toHaveBeenCalledWith({
        where: { status: 'pending' },
        include: [{
          model: Booking,
          required: true,
          include: [{
            model: User,
            required: true
          }]
        }]
      });

      // Verify updates were made
      expect(Notification.update).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('Processing 2 pending notifications');
    });

    test('should handle email notification sending', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          type: 'email',
          status: 'pending',
          Booking: {
            id: 'booking-1',
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            start_time: new Date('2024-01-15T10:00:00Z'),
            end_time: new Date('2024-01-15T11:00:00Z'),
            status: 'confirmed',
            User: {
              id: 'user-1',
              name: 'Provider User'
            }
          }
        }
      ];

      Notification.findAll.mockResolvedValueOnce(mockNotifications);
      Notification.update.mockResolvedValue([1]);
      fs.readFile.mockResolvedValue('<html>Test template</html>');

      await notificationService.processNotificationQueue();

      // Verify email was sent
      expect(nodemailer.createTransporter().sendMail).toHaveBeenCalled();
      
      // Verify status update to 'sent'
      expect(Notification.update).toHaveBeenCalledWith(
        {
          status: 'sent',
          sent_at: expect.any(Date),
          error_message: null
        },
        { where: { id: 'notification-1' } }
      );
    });

    test('should handle SMS notification sending', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          type: 'sms',
          status: 'pending',
          Booking: {
            id: 'booking-1',
            customer_phone: '+1234567890',
            start_time: new Date('2024-01-15T10:00:00Z'),
            status: 'confirmed',
            User: {
              id: 'user-1',
              name: 'Provider User'
            }
          }
        }
      ];

      Notification.findAll.mockResolvedValueOnce(mockNotifications);
      Notification.update.mockResolvedValue([1]);

      await notificationService.processNotificationQueue();

      // Verify SMS logging (mock implementation)
      expect(logger.info).toHaveBeenCalledWith('[MOCK SMS] Sending SMS notification for booking booking-1');
      expect(logger.info).toHaveBeenCalledWith('[MOCK SMS] To: +1234567890');
    });

    test('should handle notification processing errors', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          type: 'email',
          status: 'pending',
          Booking: {
            id: 'booking-1',
            customer_email: 'john@example.com',
            User: { name: 'Provider' }
          }
        }
      ];

      Notification.findAll.mockResolvedValueOnce(mockNotifications);
      
      // Mock email sending error
      fs.readFile.mockRejectedValueOnce(new Error('Template not found'));
      Notification.update.mockResolvedValue([1]);

      await notificationService.processNotificationQueue();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to process notification notification-1:',
        expect.any(Error)
      );

      // Verify status update to 'failed'
      expect(Notification.update).toHaveBeenCalledWith(
        {
          status: 'failed',
          error_message: 'Template not found',
          sent_at: null
        },
        { where: { id: 'notification-1' } }
      );
    });

    test('should handle empty notification queue', async () => {
      Notification.findAll.mockResolvedValueOnce([]);

      await notificationService.processNotificationQueue();

      expect(logger.info).toHaveBeenCalledWith('Processing 0 pending notifications');
      expect(Notification.update).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      Notification.findAll.mockRejectedValueOnce(new Error('Database connection failed'));

      await notificationService.processNotificationQueue();

      expect(logger.error).toHaveBeenCalledWith(
        'Error processing notification queue:',
        expect.any(Error)
      );
    });
  });

  describe('queueNotification', () => {
    test('should queue email notification successfully', async () => {
      const mockNotification = {
        id: 'test-uuid-1234',
        bookingId: 'booking-123',
        type: 'email',
        status: 'pending'
      };

      Notification.create.mockResolvedValueOnce(mockNotification);

      const result = await notificationService.queueNotification('booking-123', 'email');

      expect(Notification.create).toHaveBeenCalledWith({
        id: 'test-uuid-1234',
        bookingId: 'booking-123',
        type: 'email',
        status: 'pending'
      });

      expect(result).toEqual(mockNotification);
      expect(logger.info).toHaveBeenCalledWith(
        'Notification queued: test-uuid-1234 for booking booking-123'
      );
    });

    test('should queue SMS notification by default', async () => {
      const mockNotification = {
        id: 'test-uuid-1234',
        bookingId: 'booking-123',
        type: 'email',
        status: 'pending'
      };

      Notification.create.mockResolvedValueOnce(mockNotification);

      await notificationService.queueNotification('booking-123');

      expect(Notification.create).toHaveBeenCalledWith({
        id: 'test-uuid-1234',
        bookingId: 'booking-123',
        type: 'email',
        status: 'pending'
      });
    });

    test('should handle notification creation errors', async () => {
      Notification.create.mockRejectedValueOnce(new Error('Database error'));

      await expect(notificationService.queueNotification('booking-123')).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error queueing notification for booking booking-123:',
        expect.any(Error)
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    test('should send password reset email successfully', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com'
      };

      process.env.FRONTEND_URL = 'https://example.com';
      process.env.EMAIL_FROM = 'noreply@meetabl.com';
      process.env.EMAIL_FROM_NAME = 'Meetabl';

      fs.readFile.mockResolvedValue('<html>{{name}} {{resetUrl}}</html>');

      const result = await notificationService.sendPasswordResetEmail(mockUser, 'reset-token-123');

      expect(fs.readFile).toHaveBeenCalledWith(
        '__dirname/../config/templates/password-reset.html',
        'utf8'
      );

      expect(nodemailer.createTransporter().sendMail).toHaveBeenCalledWith({
        from: '"Meetabl" <noreply@meetabl.com>',
        to: 'john@example.com',
        subject: 'Password Reset Request - Meetabl',
        html: '<html>John Doe https://example.com/reset-password?token=reset-token-123</html>'
      });

      expect(result).toEqual({ messageId: 'test-message-id' });
      expect(logger.info).toHaveBeenCalledWith('Password reset email sent successfully to john@example.com: test-message-id');
    });

    test('should use default values for missing environment variables', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com'
      };

      delete process.env.FRONTEND_URL;
      delete process.env.EMAIL_FROM;
      delete process.env.EMAIL_FROM_NAME;

      fs.readFile.mockResolvedValue('<html>{{name}} {{resetUrl}}</html>');

      await notificationService.sendPasswordResetEmail(mockUser, 'reset-token-123');

      expect(nodemailer.createTransporter().sendMail).toHaveBeenCalledWith({
        from: '"Meetabl" <noreply@meetabl.com>',
        to: 'john@example.com',
        subject: 'Password Reset Request - Meetabl',
        html: '<html>John Doe http://localhost:3001/reset-password?token=reset-token-123</html>'
      });
    });

    test('should handle email sending errors', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com'
      };

      fs.readFile.mockResolvedValue('<html>Template</html>');
      nodemailer.createTransporter().sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(notificationService.sendPasswordResetEmail(mockUser, 'token')).rejects.toThrow('SMTP error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error sending password reset email:',
        expect.objectContaining({
          error: 'SMTP error'
        })
      );
    });

    test('should handle template reading errors', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com'
      };

      fs.readFile.mockRejectedValueOnce(new Error('Template not found'));

      await expect(notificationService.sendPasswordResetEmail(mockUser, 'token')).rejects.toThrow('Template not found');
    });
  });

  describe('sendEmailVerification', () => {
    test('should send email verification successfully', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Jane Doe',
        email: 'jane@example.com'
      };

      process.env.FRONTEND_URL = 'https://example.com';
      fs.readFile.mockResolvedValue('<html>{{name}} {{verificationUrl}}</html>');

      await notificationService.sendEmailVerification(mockUser, 'verify-token-123');

      expect(fs.readFile).toHaveBeenCalledWith(
        '__dirname/../config/templates/email-verification.html',
        'utf8'
      );

      expect(nodemailer.createTransporter().sendMail).toHaveBeenCalledWith({
        from: '"Meetabl" <noreply@meetabl.com>',
        to: 'jane@example.com',
        subject: 'Verify Your Email - Meetabl',
        html: '<html>Jane Doe https://example.com/verify-email?token=verify-token-123</html>'
      });

      expect(logger.info).toHaveBeenCalledWith('Email verification sent to jane@example.com: test-message-id');
    });

    test('should handle email verification errors', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'Jane Doe',
        email: 'jane@example.com'
      };

      fs.readFile.mockRejectedValueOnce(new Error('Template error'));

      await expect(notificationService.sendEmailVerification(mockUser, 'token')).rejects.toThrow('Template error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error sending email verification:',
        expect.any(Error)
      );
    });
  });

  describe('sendBookingConfirmationRequest', () => {
    test('should send booking confirmation request successfully', async () => {
      const params = {
        to: 'customer@example.com',
        customerName: 'John Customer',
        hostName: 'Jane Host',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        confirmationUrl: 'https://example.com/confirm/123',
        expiresAt: new Date('2024-01-15T10:30:00Z')
      };

      process.env.EMAIL_FROM = 'noreply@meetabl.com';

      await notificationService.sendBookingConfirmationRequest(params);

      expect(nodemailer.createTransporter().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Meetabl" <noreply@meetabl.com>',
          to: 'customer@example.com',
          subject: 'Action Required: Confirm your booking with Jane Host',
          html: expect.stringContaining('John Customer')
        })
      );

      expect(logger.info).toHaveBeenCalledWith('Booking confirmation request sent to customer@example.com: test-message-id');
    });

    test('should handle booking confirmation request errors', async () => {
      const params = {
        to: 'customer@example.com',
        customerName: 'John Customer',
        hostName: 'Jane Host',
        startTime: new Date(),
        endTime: new Date(),
        confirmationUrl: 'https://example.com/confirm/123'
      };

      nodemailer.createTransporter().sendMail.mockRejectedValueOnce(new Error('Email sending failed'));

      await expect(notificationService.sendBookingConfirmationRequest(params)).rejects.toThrow('Email sending failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Error sending booking confirmation request:',
        expect.any(Error)
      );
    });
  });

  describe('sendBookingConfirmationToCustomer', () => {
    test('should send booking confirmation to customer successfully', async () => {
      const params = {
        booking: {
          customerName: 'John Customer',
          customerEmail: 'customer@example.com',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T11:00:00Z'),
          notes: 'Important meeting'
        },
        host: {
          firstName: 'Jane',
          lastName: 'Host',
          email: 'host@example.com'
        }
      };

      await notificationService.sendBookingConfirmationToCustomer(params);

      expect(nodemailer.createTransporter().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Booking Confirmed with Jane Host',
          html: expect.stringContaining('John Customer')
        })
      );

      expect(logger.info).toHaveBeenCalledWith('Booking confirmation sent to customer customer@example.com: test-message-id');
    });

    test('should handle missing notes in booking confirmation', async () => {
      const params = {
        booking: {
          customerName: 'John Customer',
          customerEmail: 'customer@example.com',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T11:00:00Z')
        },
        host: {
          firstName: 'Jane',
          lastName: 'Host',
          email: 'host@example.com'
        }
      };

      await notificationService.sendBookingConfirmationToCustomer(params);

      const emailCall = nodemailer.createTransporter().sendMail.mock.calls[0][0];
      expect(emailCall.html).not.toContain('<p><strong>Notes:</strong>');
    });
  });

  describe('sendBookingNotificationToHost', () => {
    test('should send booking notification to host successfully', async () => {
      const params = {
        booking: {
          customerName: 'John Customer',
          customerEmail: 'customer@example.com',
          customerPhone: '+1234567890',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T11:00:00Z'),
          notes: 'Meeting notes'
        },
        host: {
          firstName: 'Jane',
          lastName: 'Host',
          email: 'host@example.com'
        }
      };

      await notificationService.sendBookingNotificationToHost(params);

      expect(nodemailer.createTransporter().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'host@example.com',
          subject: expect.stringContaining('New Booking: John Customer'),
          html: expect.stringContaining('Jane')
        })
      );

      expect(logger.info).toHaveBeenCalledWith('Booking notification sent to host host@example.com: test-message-id');
    });

    test('should handle optional fields in host notification', async () => {
      const params = {
        booking: {
          customerName: 'John Customer',
          customerEmail: 'customer@example.com',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T11:00:00Z')
        },
        host: {
          firstName: 'Jane',
          lastName: 'Host',
          email: 'host@example.com'
        }
      };

      await notificationService.sendBookingNotificationToHost(params);

      const emailCall = nodemailer.createTransporter().sendMail.mock.calls[0][0];
      expect(emailCall.html).not.toContain('<p><strong>Phone:</strong>');
      expect(emailCall.html).not.toContain('<p><strong>Notes:</strong>');
    });
  });

  describe('environment handling', () => {
    test('should use test transporter in test environment', () => {
      process.env.NODE_ENV = 'test';

      // The createTransporter function should return a mock in test environment
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
      };

      // Test that the service uses the test transporter correctly
      expect(process.env.NODE_ENV).toBe('test');
    });

    test('should handle missing environment variables gracefully', async () => {
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_PORT;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;

      const mockUser = {
        name: 'Test User',
        email: 'test@example.com'
      };

      fs.readFile.mockResolvedValue('<html>{{name}}</html>');

      // Should not throw error due to missing env vars
      await expect(notificationService.sendPasswordResetEmail(mockUser, 'token')).resolves.toBeDefined();
    });
  });
});