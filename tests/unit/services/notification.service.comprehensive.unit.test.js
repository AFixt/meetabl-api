/**
 * Comprehensive notification service unit tests
 *
 * Tests all notification service methods with realistic scenarios
 *
 * @author meetabl Team
 */

require('../test-setup');

const { v4: uuidv4 } = require('uuid');

// Mock nodemailer
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransporter: () => ({
    sendMail: mockSendMail
  })
}));

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

// Mock models
const mockNotification = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn()
};

const mockBooking = {
  findByPk: jest.fn()
};

const mockUser = {
  findByPk: jest.fn()
};

jest.mock('../../../src/models', () => ({
  Notification: mockNotification,
  Booking: mockBooking,
  User: mockUser
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn()
};

jest.mock('../../../src/config/logger', () => mockLogger);

// Import service after mocking
const notificationService = require('../../../src/services/notification.service');
const fs = require('fs').promises;

describe('Notification Service - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
    fs.readFile.mockResolvedValue('<html><body>Test template with {{name}}, {{resetUrl}}, and {{verificationUrl}}</body></html>');
    
    // Set test environment
    process.env.NODE_ENV = 'production'; // To test real email transporter
    process.env.EMAIL_FROM = 'test@example.com';
    process.env.FRONTEND_URL = 'https://test.example.com';
  });

  describe('queueNotification', () => {
    test('should create notification with default email type', async () => {
      const bookingId = uuidv4();
      const mockNotificationResponse = {
        id: uuidv4(),
        bookingId,
        type: 'email',
        status: 'pending'
      };
      
      mockNotification.create.mockResolvedValue(mockNotificationResponse);
      
      const result = await notificationService.queueNotification(bookingId);
      
      expect(mockNotification.create).toHaveBeenCalledWith({
        id: expect.any(String),
        bookingId,
        type: 'email',
        status: 'pending'
      });
      expect(result).toEqual(mockNotificationResponse);
    });

    test('should handle database errors', async () => {
      const bookingId = uuidv4();
      const dbError = new Error('Database connection failed');
      mockNotification.create.mockRejectedValue(dbError);
      
      await expect(notificationService.queueNotification(bookingId))
        .rejects.toThrow('Database connection failed');
    });

    test('should create SMS notification when type specified', async () => {
      const bookingId = uuidv4();
      mockNotification.create.mockResolvedValue({
        id: uuidv4(),
        bookingId,
        type: 'sms',
        status: 'pending'
      });
      
      await notificationService.queueNotification(bookingId, 'sms');
      
      expect(mockNotification.create).toHaveBeenCalledWith({
        id: expect.any(String),
        bookingId,
        type: 'sms',
        status: 'pending'
      });
    });
  });

  describe('sendPasswordResetEmail', () => {
    const mockUser = {
      email: 'user@example.com',
      name: 'Test User'
    };
    const resetToken = 'reset-token-123';

    test('should send password reset email successfully', async () => {
      await notificationService.sendPasswordResetEmail(mockUser, resetToken);
      
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('password-reset.html'),
        'utf8'
      );
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Meetabl" <test@example.com>',
        to: mockUser.email,
        subject: 'Password Reset Request - Meetabl',
        html: expect.any(String)
      });
    });

    test('should replace template variables correctly', async () => {
      await notificationService.sendPasswordResetEmail(mockUser, resetToken);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(mockUser.name);
      expect(emailCall.html).toContain(`https://test.example.com/reset-password?token=${resetToken}`);
    });

    test('should handle template reading errors', async () => {
      fs.readFile.mockRejectedValue(new Error('Template not found'));
      
      await expect(notificationService.sendPasswordResetEmail(mockUser, resetToken))
        .rejects.toThrow('Template not found');
    });

    test('should handle email sending errors', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));
      
      await expect(notificationService.sendPasswordResetEmail(mockUser, resetToken))
        .rejects.toThrow('SMTP connection failed');
    });
  });

  describe('sendEmailVerification', () => {
    const mockUser = {
      email: 'user@example.com',
      name: 'Test User'
    };
    const verificationToken = 'verify-token-123';

    test('should send email verification successfully', async () => {
      await notificationService.sendEmailVerification(mockUser, verificationToken);
      
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('email-verification.html'),
        'utf8'
      );
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Meetabl" <test@example.com>',
        to: mockUser.email,
        subject: 'Verify Your Email - Meetabl',
        html: expect.any(String)
      });
    });

    test('should include verification URL in email template', async () => {
      await notificationService.sendEmailVerification(mockUser, verificationToken);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(`https://test.example.com/verify-email?token=${verificationToken}`);
    });
  });

  describe('sendBookingConfirmationRequest', () => {
    const emailParams = {
      to: 'customer@example.com',
      customerName: 'John Doe',
      hostName: 'Jane Smith',
      startTime: '2024-12-01T10:00:00Z',
      endTime: '2024-12-01T11:00:00Z',
      confirmationUrl: 'https://app.example.com/confirm/abc123',
      expiresAt: '2024-12-01T10:30:00Z'
    };

    test('should send booking confirmation request email', async () => {
      await notificationService.sendBookingConfirmationRequest(emailParams);
      
      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.stringContaining('Meetabl'),
        to: emailParams.to,
        subject: `Action Required: Confirm your booking with ${emailParams.hostName}`,
        html: expect.stringContaining(emailParams.customerName)
      });
    });

    test('should format date and time in email content', async () => {
      await notificationService.sendBookingConfirmationRequest(emailParams);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain('December 1, 2024'); // Formatted date
      expect(emailCall.html).toContain(emailParams.confirmationUrl);
      expect(emailCall.html).toContain('expires in 30 minutes');
    });

    test('should handle destructuring errors gracefully', async () => {
      const incompleteParams = { to: 'test@example.com' };
      
      // Should not throw, but may have undefined values in template
      await expect(notificationService.sendBookingConfirmationRequest(incompleteParams))
        .resolves.not.toThrow();
    });
  });

  describe('sendBookingConfirmationToCustomer', () => {
    const params = {
      booking: {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        startTime: '2024-12-01T10:00:00Z',
        endTime: '2024-12-01T11:00:00Z',
        notes: 'Important meeting'
      },
      host: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com'
      }
    };

    test('should send booking confirmation to customer', async () => {
      await notificationService.sendBookingConfirmationToCustomer(params);
      
      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.stringContaining('Meetabl'),
        to: params.booking.customerEmail,
        subject: `Booking Confirmed with ${params.host.firstName} ${params.host.lastName}`,
        html: expect.stringContaining('Booking Confirmed!')
      });
    });

    test('should include all booking details', async () => {
      await notificationService.sendBookingConfirmationToCustomer(params);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(params.booking.customerName);
      expect(emailCall.html).toContain(params.host.firstName);
      expect(emailCall.html).toContain(params.booking.notes);
    });

    test('should handle missing optional fields', async () => {
      const paramsWithoutNotes = {
        ...params,
        booking: { ...params.booking, notes: undefined }
      };
      
      await expect(notificationService.sendBookingConfirmationToCustomer(paramsWithoutNotes))
        .resolves.not.toThrow();
    });
  });

  describe('sendBookingNotificationToHost', () => {
    const params = {
      booking: {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '+1234567890',
        startTime: '2024-12-01T10:00:00Z',
        endTime: '2024-12-01T11:00:00Z',
        notes: 'Important meeting'
      },
      host: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com'
      }
    };

    test('should send booking notification to host', async () => {
      await notificationService.sendBookingNotificationToHost(params);
      
      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.stringContaining('Meetabl'),
        to: params.host.email,
        subject: expect.stringContaining('New Booking:'),
        html: expect.stringContaining('New Booking Confirmed')
      });
    });

    test('should include customer contact information', async () => {
      await notificationService.sendBookingNotificationToHost(params);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(params.booking.customerName);
      expect(emailCall.html).toContain(params.booking.customerEmail);
      expect(emailCall.html).toContain(params.booking.customerPhone);
    });
  });

  describe('processNotificationQueue', () => {
    test('should process pending email notifications', async () => {
      const mockPendingNotifications = [
        {
          id: uuidv4(),
          type: 'email',
          status: 'pending',
          Booking: {
            id: uuidv4(),
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            start_time: new Date(),
            end_time: new Date(),
            status: 'confirmed',
            User: {
              id: uuidv4(),
              name: 'Jane Smith',
              email: 'jane@example.com'
            }
          }
        }
      ];
      
      mockNotification.findAll.mockResolvedValue(mockPendingNotifications);
      mockNotification.update.mockResolvedValue([1]);
      
      await notificationService.processNotificationQueue();
      
      expect(mockNotification.findAll).toHaveBeenCalledWith({
        where: { status: 'pending' },
        include: expect.any(Array)
      });
      expect(mockSendMail).toHaveBeenCalled();
      expect(mockNotification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          sent_at: expect.any(Date),
          error_message: null
        }),
        { where: { id: mockPendingNotifications[0].id } }
      );
    });

    test('should process pending SMS notifications', async () => {
      const mockPendingNotifications = [
        {
          id: uuidv4(),
          type: 'sms',
          status: 'pending',
          Booking: {
            id: uuidv4(),
            customer_phone: '+1234567890',
            start_time: new Date(),
            status: 'confirmed'
          }
        }
      ];
      
      mockNotification.findAll.mockResolvedValue(mockPendingNotifications);
      mockNotification.update.mockResolvedValue([1]);
      
      await notificationService.processNotificationQueue();
      
      expect(mockNotification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          sent_at: expect.any(Date)
        }),
        { where: { id: mockPendingNotifications[0].id } }
      );
    });

    test('should handle notification processing failures', async () => {
      const mockPendingNotifications = [
        {
          id: uuidv4(),
          type: 'email',
          status: 'pending',
          Booking: {
            id: uuidv4(),
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            start_time: new Date(),
            end_time: new Date(),
            status: 'confirmed',
            User: {
              id: uuidv4(),
              name: 'Jane Smith',
              email: 'jane@example.com'
            }
          }
        }
      ];
      
      mockNotification.findAll.mockResolvedValue(mockPendingNotifications);
      mockNotification.update.mockResolvedValue([1]);
      mockSendMail.mockRejectedValue(new Error('SMTP failed'));
      
      await notificationService.processNotificationQueue();
      
      expect(mockNotification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'SMTP failed'
        }),
        { where: { id: mockPendingNotifications[0].id } }
      );
    });

    test('should handle empty notification queue', async () => {
      mockNotification.findAll.mockResolvedValue([]);
      
      await notificationService.processNotificationQueue();
      
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockNotification.update).not.toHaveBeenCalled();
    });

    test('should handle batch update failures gracefully', async () => {
      const mockPendingNotifications = [
        {
          id: uuidv4(),
          type: 'email',
          status: 'pending',
          Booking: {
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            start_time: new Date(),
            end_time: new Date(),
            status: 'confirmed',
            User: { name: 'Jane Smith', email: 'jane@example.com' }
          }
        }
      ];
      
      mockNotification.findAll.mockResolvedValue(mockPendingNotifications);
      mockNotification.update.mockRejectedValue(new Error('Database update failed'));
      
      // Should not throw, just log error
      await expect(notificationService.processNotificationQueue())
        .resolves.not.toThrow();
    });
  });

  describe('Email template processing', () => {
    test('should handle template variable replacement correctly', async () => {
      const templateContent = 'Hello {{name}}, click {{resetUrl}} to reset your password.';
      fs.readFile.mockResolvedValue(templateContent);
      
      const user = { email: 'test@example.com', name: 'John Doe' };
      const token = 'test-token';
      
      await notificationService.sendPasswordResetEmail(user, token);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain('Hello John Doe');
      expect(emailCall.html).toContain('https://test.example.com/reset-password?token=test-token');
    });

    test('should handle multiple template variable occurrences', async () => {
      const templateContent = '{{name}} {{name}} {{name}}';
      fs.readFile.mockResolvedValue(templateContent);
      
      const user = { email: 'test@example.com', name: 'John' };
      await notificationService.sendPasswordResetEmail(user, 'token');
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toBe('John John John');
    });
  });

  describe('Error handling and resilience', () => {
    test('should handle malformed email addresses gracefully', async () => {
      const user = { email: 'invalid-email', name: 'Test User' };
      
      // Service should still attempt to send, SMTP server will reject
      await expect(notificationService.sendPasswordResetEmail(user, 'token'))
        .resolves.not.toThrow();
      
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'invalid-email' })
      );
    });

    test('should handle missing environment variables gracefully', async () => {
      delete process.env.EMAIL_FROM;
      delete process.env.FRONTEND_URL;
      
      const user = { email: 'test@example.com', name: 'Test User' };
      
      await notificationService.sendPasswordResetEmail(user, 'token');
      
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Meetabl" <noreply@meetabl.com>', // Default fallback
          html: expect.stringContaining('http://localhost:3001') // Default frontend URL
        })
      );
    });

    test('should handle concurrent notification processing', async () => {
      const mockNotifications = Array.from({ length: 5 }, (_, i) => ({
        id: uuidv4(),
        type: 'email',
        status: 'pending',
        Booking: {
          customer_name: `Customer ${i}`,
          customer_email: `customer${i}@example.com`,
          start_time: new Date(),
          end_time: new Date(),
          status: 'confirmed',
          User: { name: 'Host', email: 'host@example.com' }
        }
      }));
      
      mockNotification.findAll.mockResolvedValue(mockNotifications);
      mockNotification.update.mockResolvedValue([1]);
      
      await notificationService.processNotificationQueue();
      
      // Should have processed all notifications
      expect(mockSendMail).toHaveBeenCalledTimes(5);
      expect(mockNotification.update).toHaveBeenCalledTimes(5);
    });
  });
});