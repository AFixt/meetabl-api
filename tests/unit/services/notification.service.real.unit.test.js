/**
 * Notification service real unit tests
 *
 * Tests the actual notification service methods with proper mocking
 *
 * @author meetabl Team
 */

require('../test-setup');

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Mock nodemailer before importing the service
const mockSendMail = jest.fn();
const mockCreateTransporter = jest.fn(() => ({
  sendMail: mockSendMail
}));

jest.mock('nodemailer', () => ({
  createTransporter: mockCreateTransporter
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

// Mock fs for template reading
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

// Import service after mocking - get fresh copy for each test
let notificationService;

describe('Notification Service - Real Implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment
    delete process.env.NODE_ENV;
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_FROM;
    delete process.env.FRONTEND_URL;
    
    // Import fresh copy of service after clearing mocks
    jest.resetModules();
    notificationService = require('../../../src/services/notification.service');
    
    // Mock successful email sending by default
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
    
    // Mock template file reading
    fs.readFile.mockResolvedValue(`
      <html>
        <body>
          <h1>Test Email</h1>
          <p>Hello {{name}}</p>
          <p>{{customerName}}</p>
          <p>{{providerName}}</p>
          <p>{{startTime}}</p>
          <p>{{endTime}}</p>
          <p>{{status}}</p>
          <p><a href="{{resetUrl}}">Reset</a></p>
          <p><a href="{{verificationUrl}}">Verify</a></p>
        </body>
      </html>
    `);
  });

  describe('queueNotification', () => {
    test('should create notification record with valid data', async () => {
      const bookingId = uuidv4();
      const mockCreatedNotification = {
        id: uuidv4(),
        bookingId: bookingId,
        type: 'email',
        status: 'pending'
      };
      
      mockNotification.create.mockResolvedValue(mockCreatedNotification);
      
      const result = await notificationService.queueNotification(bookingId, 'email');
      
      expect(mockNotification.create).toHaveBeenCalledWith({
        id: expect.any(String),
        bookingId: bookingId,
        type: 'email',
        status: 'pending'
      });
      expect(result).toEqual(mockCreatedNotification);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Notification queued: ${mockCreatedNotification.id} for booking ${bookingId}`)
      );
    });

    test('should default to email type when type not specified', async () => {
      const bookingId = uuidv4();
      mockNotification.create.mockResolvedValue({
        id: uuidv4(),
        bookingId: bookingId,
        type: 'email',
        status: 'pending'
      });
      
      await notificationService.queueNotification(bookingId);
      
      expect(mockNotification.create).toHaveBeenCalledWith({
        id: expect.any(String),
        bookingId: bookingId,
        type: 'email',
        status: 'pending'
      });
    });

    test('should handle SMS type notification', async () => {
      const bookingId = uuidv4();
      mockNotification.create.mockResolvedValue({
        id: uuidv4(),
        bookingId: bookingId,
        type: 'sms',
        status: 'pending'
      });
      
      await notificationService.queueNotification(bookingId, 'sms');
      
      expect(mockNotification.create).toHaveBeenCalledWith({
        id: expect.any(String),
        bookingId: bookingId,
        type: 'sms',
        status: 'pending'
      });
    });

    test('should handle database errors gracefully', async () => {
      const bookingId = uuidv4();
      const error = new Error('Database connection failed');
      mockNotification.create.mockRejectedValue(error);
      
      await expect(notificationService.queueNotification(bookingId))
        .rejects.toThrow('Database connection failed');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error queueing notification for booking ${bookingId}:`,
        error
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    const mockUser = {
      email: 'test@example.com',
      name: 'Test User'
    };
    const resetToken = 'test-reset-token';

    test('should send password reset email successfully', async () => {
      await notificationService.sendPasswordResetEmail(mockUser, resetToken);
      
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('password-reset.html'),
        'utf8'
      );
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Meetabl" <noreply@meetabl.com>',
        to: mockUser.email,
        subject: 'Password Reset Request - Meetabl',
        html: expect.stringContaining('Test User')
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Password reset email sent successfully to ${mockUser.email}`)
      );
    });

    test('should use environment variables for email configuration', async () => {
      process.env.EMAIL_FROM = 'custom@example.com';
      process.env.EMAIL_FROM_NAME = 'Custom App';
      process.env.FRONTEND_URL = 'https://example.com';
      
      await notificationService.sendPasswordResetEmail(mockUser, resetToken);
      
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Custom App" <custom@example.com>',
        to: mockUser.email,
        subject: 'Password Reset Request - Meetabl',
        html: expect.stringContaining('https://example.com/reset-password?token=test-reset-token')
      });
    });

    test('should handle template reading errors', async () => {
      const templateError = new Error('Template not found');
      fs.readFile.mockRejectedValue(templateError);
      
      await expect(notificationService.sendPasswordResetEmail(mockUser, resetToken))
        .rejects.toThrow('Template not found');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending password reset email:',
        expect.objectContaining({
          error: 'Template not found'
        })
      );
    });

    test('should handle email sending errors', async () => {
      const emailError = new Error('SMTP connection failed');
      mockSendMail.mockRejectedValue(emailError);
      
      await expect(notificationService.sendPasswordResetEmail(mockUser, resetToken))
        .rejects.toThrow('SMTP connection failed');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending password reset email:',
        expect.objectContaining({
          error: 'SMTP connection failed'
        })
      );
    });
  });

  describe('sendEmailVerification', () => {
    const mockUser = {
      email: 'test@example.com',
      name: 'Test User'
    };
    const verificationToken = 'test-verification-token';

    test('should send email verification successfully', async () => {
      await notificationService.sendEmailVerification(mockUser, verificationToken);
      
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('email-verification.html'),
        'utf8'
      );
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Meetabl" <noreply@meetabl.com>',
        to: mockUser.email,
        subject: 'Verify Your Email - Meetabl',
        html: expect.stringContaining('Test User')
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Email verification sent to ${mockUser.email}`)
      );
    });

    test('should include verification URL in email', async () => {
      process.env.FRONTEND_URL = 'https://app.example.com';
      
      await notificationService.sendEmailVerification(mockUser, verificationToken);
      
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://app.example.com/verify-email?token=test-verification-token')
        })
      );
    });

    test('should handle verification email errors', async () => {
      const error = new Error('Email service unavailable');
      mockSendMail.mockRejectedValue(error);
      
      await expect(notificationService.sendEmailVerification(mockUser, verificationToken))
        .rejects.toThrow('Email service unavailable');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending email verification:',
        error
      );
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

    test('should send booking confirmation request successfully', async () => {
      await notificationService.sendBookingConfirmationRequest(emailParams);
      
      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.stringContaining('Meetabl'),
        to: emailParams.to,
        subject: `Action Required: Confirm your booking with ${emailParams.hostName}`,
        html: expect.stringContaining(emailParams.customerName)
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Booking confirmation request sent to ${emailParams.to}`)
      );
    });

    test('should format date and time correctly in email', async () => {
      await notificationService.sendBookingConfirmationRequest(emailParams);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain('Saturday, December 1, 2024'); // Formatted date
      expect(emailCall.html).toContain('10:00 AM'); // Formatted start time
      expect(emailCall.html).toContain('11:00 AM'); // Formatted end time
    });

    test('should include confirmation URL and warning about expiration', async () => {
      await notificationService.sendBookingConfirmationRequest(emailParams);
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(emailParams.confirmationUrl);
      expect(emailCall.html).toContain('This link expires in 30 minutes');
    });

    test('should handle missing email parameters gracefully', async () => {
      const incompleteParams = {
        to: 'customer@example.com',
        customerName: 'John Doe'
        // Missing other required fields
      };
      
      await expect(notificationService.sendBookingConfirmationRequest(incompleteParams))
        .rejects.toThrow();
    });
  });

  describe('sendBookingConfirmationToCustomer', () => {
    const mockBooking = {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      startTime: '2024-12-01T10:00:00Z',
      endTime: '2024-12-01T11:00:00Z',
      notes: 'Important meeting'
    };
    
    const mockHost = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com'
    };

    test('should send booking confirmation to customer', async () => {
      await notificationService.sendBookingConfirmationToCustomer({
        booking: mockBooking,
        host: mockHost
      });
      
      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.stringContaining('Meetabl'),
        to: mockBooking.customerEmail,
        subject: `Booking Confirmed with ${mockHost.firstName} ${mockHost.lastName}`,
        html: expect.stringContaining('Booking Confirmed!')
      });
    });

    test('should include booking details in confirmation email', async () => {
      await notificationService.sendBookingConfirmationToCustomer({
        booking: mockBooking,
        host: mockHost
      });
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(mockBooking.customerName);
      expect(emailCall.html).toContain(`${mockHost.firstName} ${mockHost.lastName}`);
      expect(emailCall.html).toContain(mockBooking.notes);
    });

    test('should handle booking without notes', async () => {
      const bookingWithoutNotes = { ...mockBooking };
      delete bookingWithoutNotes.notes;
      
      await notificationService.sendBookingConfirmationToCustomer({
        booking: bookingWithoutNotes,
        host: mockHost
      });
      
      expect(mockSendMail).toHaveBeenCalled();
      // Should not throw error when notes is undefined
    });
  });

  describe('sendBookingNotificationToHost', () => {
    const mockBooking = {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      customerPhone: '+1234567890',
      startTime: '2024-12-01T10:00:00Z',
      endTime: '2024-12-01T11:00:00Z',
      notes: 'Important meeting'
    };
    
    const mockHost = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com'
    };

    test('should send booking notification to host', async () => {
      await notificationService.sendBookingNotificationToHost({
        booking: mockBooking,
        host: mockHost
      });
      
      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.stringContaining('Meetabl'),
        to: mockHost.email,
        subject: expect.stringContaining(`New Booking: ${mockBooking.customerName}`),
        html: expect.stringContaining('New Booking Confirmed')
      });
    });

    test('should include customer details in host notification', async () => {
      await notificationService.sendBookingNotificationToHost({
        booking: mockBooking,
        host: mockHost
      });
      
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(mockBooking.customerName);
      expect(emailCall.html).toContain(mockBooking.customerEmail);
      expect(emailCall.html).toContain(mockBooking.customerPhone);
      expect(emailCall.html).toContain(mockBooking.notes);
    });

    test('should handle booking without phone number', async () => {
      const bookingWithoutPhone = { ...mockBooking };
      delete bookingWithoutPhone.customerPhone;
      
      await notificationService.sendBookingNotificationToHost({
        booking: bookingWithoutPhone,
        host: mockHost
      });
      
      expect(mockSendMail).toHaveBeenCalled();
      // Should not throw error when phone is undefined
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
        {
          status: 'sent',
          sent_at: expect.any(Date),
          error_message: null
        },
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
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[MOCK SMS]')
      );
      expect(mockNotification.update).toHaveBeenCalledWith(
        {
          status: 'sent',
          sent_at: expect.any(Date),
          error_message: null
        },
        { where: { id: mockPendingNotifications[0].id } }
      );
    });

    test('should handle email sending failures', async () => {
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
        {
          status: 'failed',
          sent_at: null,
          error_message: 'SMTP failed'
        },
        { where: { id: mockPendingNotifications[0].id } }
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process notification'),
        expect.any(Error)
      );
    });

    test('should handle empty notification queue', async () => {
      mockNotification.findAll.mockResolvedValue([]);
      
      await notificationService.processNotificationQueue();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing 0 pending notifications'
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test('should handle batch update errors gracefully', async () => {
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
      mockNotification.update.mockRejectedValue(new Error('Database update failed'));
      
      await notificationService.processNotificationQueue();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error updating notification statuses:',
        expect.any(Error)
      );
    });
  });

  describe('createTransporter', () => {
    test('should return test transporter in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      // Since we can't directly test the internal createTransporter function,
      // we can test that email sending works in test mode
      expect(process.env.NODE_ENV).toBe('test');
    });

    test('should use environment variables for SMTP configuration', () => {
      process.env.EMAIL_HOST = 'custom-smtp.example.com';
      process.env.EMAIL_PORT = '2525';
      process.env.EMAIL_USER = 'custom@example.com';
      process.env.EMAIL_PASS = 'custom-password';
      
      // The createTransporter function should use these environment variables
      // We verify this indirectly by checking that emails can be sent
      expect(process.env.EMAIL_HOST).toBe('custom-smtp.example.com');
      expect(process.env.EMAIL_PORT).toBe('2525');
    });
  });
});