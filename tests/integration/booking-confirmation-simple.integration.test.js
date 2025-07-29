/**
 * Booking Confirmation Integration Tests - Simplified
 *
 * Tests the /api/bookings/confirm/:token endpoint with minimal setup
 *
 * @author meetabl Team
 */

// Set test environment before any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'TestJwtSecret123ForIntegrationTests456';
process.env.JWT_REFRESH_SECRET = 'TestJwtRefreshSecret789ForIntegrationTests012';
process.env.SESSION_SECRET = 'TestSessionSecret123ForIntegrationTests456';

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../../src/config/database');
const { User, Booking, BookingRequest, Notification, AuditLog } = require('../../src/models');
const { generateBookingConfirmationToken } = require('../../src/utils/crypto');

// Mock external services to prevent actual email/calendar operations
jest.mock('../../src/services/notification.service', () => ({
  sendBookingConfirmationToCustomer: jest.fn().mockResolvedValue(),
  sendBookingNotificationToHost: jest.fn().mockResolvedValue()
}));

jest.mock('../../src/services/calendar.service', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue()
}));

// Mock performance monitoring completely
jest.mock('../../src/middlewares/performance', () => ({
  requestPerformanceMiddleware: (req, res, next) => next(),
  databasePerformanceWrapper: (fn) => fn,
  bookingPerformanceWrapper: (fn) => fn,
  initializePerformanceMonitoring: jest.fn(),
  shutdownPerformanceMonitoring: jest.fn()
}));

// Mock express-status-monitor
jest.mock('express-status-monitor', () => ({
  middleware: (req, res, next) => next()
}));

// Create express app directly instead of importing full app
const express = require('express');
const bookingRoutes = require('../../src/routes/booking.routes');
const { errorHandler } = require('../../src/utils/error-response');

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingRoutes);
  app.use(errorHandler);
  return app;
};

const notificationService = require('../../src/services/notification.service');
const calendarService = require('../../src/services/calendar.service');

describe('Booking Confirmation Integration Tests - Simple', () => {
  let testUser;
  let testBookingRequest;
  let validToken;
  let app;

  beforeAll(async () => {
    // Create test app
    app = createTestApp();
    
    // Wait for database connection
    await sequelize.authenticate();
    
    // Sync database schema
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create test user directly without complex setup
    testUser = await User.create({
      id: uuidv4(),
      firstName: 'Jane',
      lastName: 'Host',
      email: `jane.host.${Date.now()}@example.com`,
      password: 'hashedpassword123',
      timezone: 'America/New_York',
      email_verified: true,
      role: 'user',
      status: 'active'
    });

    // Create test booking request
    validToken = generateBookingConfirmationToken();
    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    const endTime = new Date(futureTime.getTime() + 60 * 60 * 1000); // 1 hour later
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    testBookingRequest = await BookingRequest.create({
      id: uuidv4(),
      userId: testUser.id,
      customerName: 'John Customer',
      customerEmail: 'john@customer.com',
      customerPhone: '+1234567890',
      startTime: futureTime,
      endTime: endTime,
      notes: 'Important meeting about project',
      confirmationToken: validToken,
      status: 'pending',
      expiresAt: expiresAt
    });
  });

  afterEach(async () => {
    // Clean up test data in correct order
    await AuditLog.destroy({ where: {}, force: true });
    await Notification.destroy({ where: {}, force: true });
    await Booking.destroy({ where: {}, force: true });
    await BookingRequest.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/bookings/confirm/:token', () => {
    test('should confirm booking request with valid token', async () => {
      const response = await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Booking confirmed successfully',
        data: {
          booking: {
            id: expect.any(String),
            customerName: 'John Customer',
            startTime: expect.any(String),
            endTime: expect.any(String),
            status: 'confirmed'
          },
          host: {
            name: 'Jane Host',
            email: testUser.email
          }
        }
      });

      // Verify booking was created
      const booking = await Booking.findOne({
        where: { customerEmail: 'john@customer.com' }
      });
      expect(booking).toBeTruthy();
      expect(booking.status).toBe('confirmed');
      expect(booking.customerName).toBe('John Customer');
      expect(booking.userId).toBe(testUser.id);

      // Verify booking request was updated
      await testBookingRequest.reload();
      expect(testBookingRequest.status).toBe('confirmed');
      expect(testBookingRequest.confirmedAt).toBeTruthy();

      // Verify external services were called
      expect(notificationService.sendBookingConfirmationToCustomer).toHaveBeenCalled();
      expect(notificationService.sendBookingNotificationToHost).toHaveBeenCalled();
      expect(calendarService.createCalendarEvent).toHaveBeenCalled();
    });

    test('should return 404 for invalid token', async () => {
      const invalidToken = generateBookingConfirmationToken();

      const response = await request(app)
        .get(`/api/bookings/confirm/${invalidToken}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Invalid or expired confirmation link'
        }
      });

      // Verify no booking was created
      const bookings = await Booking.findAll();
      expect(bookings).toHaveLength(0);
    });

    test('should return 400 for expired booking request', async () => {
      // Set expiration time to past
      testBookingRequest.expiresAt = new Date(Date.now() - 60 * 1000); // 1 minute ago
      await testBookingRequest.save();

      const response = await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [{
            field: 'token',
            message: 'This booking confirmation link has expired. Please request a new booking.'
          }]
        }
      });

      // Verify booking request was marked as expired
      await testBookingRequest.reload();
      expect(testBookingRequest.status).toBe('expired');
    });

    test('should return 409 for time slot conflict', async () => {
      // Create a conflicting booking in the same time slot
      await Booking.create({
        id: uuidv4(),
        userId: testUser.id,
        customerName: 'Conflicting Customer',
        customerEmail: 'conflict@customer.com',
        startTime: testBookingRequest.startTime,
        endTime: testBookingRequest.endTime,
        status: 'confirmed'
      });

      const response = await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'time_slot_taken',
          message: 'Sorry, this time slot is no longer available. Someone else has booked it.',
          data: {
            userId: testUser.id,
            date: testBookingRequest.startTime.toISOString(),
            suggestAlternative: true
          }
        }
      });

      // Verify booking request was marked as cancelled
      await testBookingRequest.reload();
      expect(testBookingRequest.status).toBe('cancelled');
    });

    test('should handle partial overlap conflicts', async () => {
      // Create a booking that partially overlaps
      const conflictStart = new Date(testBookingRequest.startTime.getTime() - 30 * 60 * 1000); // 30 min before
      const conflictEnd = new Date(testBookingRequest.startTime.getTime() + 30 * 60 * 1000); // 30 min after start
      
      await Booking.create({
        id: uuidv4(),
        userId: testUser.id,
        customerName: 'Partial Conflict',
        customerEmail: 'partial@conflict.com',
        startTime: conflictStart,
        endTime: conflictEnd,
        status: 'confirmed'
      });

      const response = await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(409);

      expect(response.body.error.code).toBe('time_slot_taken');
    });

    test('should complete confirmation even if email notifications fail', async () => {
      // Mock email service to fail
      notificationService.sendBookingConfirmationToCustomer.mockRejectedValue(
        new Error('Email service unavailable')
      );
      notificationService.sendBookingNotificationToHost.mockRejectedValue(
        new Error('Email service unavailable')
      );

      const response = await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify booking was still created despite email failures
      const booking = await Booking.findOne({
        where: { customerEmail: 'john@customer.com' }
      });
      expect(booking).toBeTruthy();
      expect(booking.status).toBe('confirmed');
    });

    test('should complete confirmation even if calendar integration fails', async () => {
      // Mock calendar service to fail
      calendarService.createCalendarEvent.mockRejectedValue(
        new Error('Calendar service unavailable')
      );

      const response = await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify booking was still created despite calendar failure
      const booking = await Booking.findOne({
        where: { customerEmail: 'john@customer.com' }
      });
      expect(booking).toBeTruthy();
      expect(booking.status).toBe('confirmed');
    });

    test('should handle race condition between simultaneous confirmations', async () => {
      // Create another booking request for the same time slot
      const token2 = generateBookingConfirmationToken();
      const request2 = await BookingRequest.create({
        id: uuidv4(),
        userId: testUser.id,
        customerName: 'Customer Two',
        customerEmail: 'customer2@race.com',
        startTime: testBookingRequest.startTime,
        endTime: testBookingRequest.endTime,
        confirmationToken: token2,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });

      // Attempt to confirm both simultaneously
      const [response1, response2] = await Promise.all([
        request(app).get(`/api/bookings/confirm/${validToken}`),
        request(app).get(`/api/bookings/confirm/${token2}`)
      ]);

      // One should succeed, one should fail with conflict
      const statusCodes = [response1.status, response2.status];
      expect(statusCodes).toContain(200); // One success
      expect(statusCodes).toContain(409); // One conflict

      // Verify only one booking was created
      const bookings = await Booking.findAll({
        where: {
          startTime: testBookingRequest.startTime,
          userId: testUser.id
        }
      });
      expect(bookings).toHaveLength(1);
    });

    test('should handle already confirmed booking request', async () => {
      // Mark booking request as already confirmed
      testBookingRequest.status = 'confirmed';
      testBookingRequest.confirmedAt = new Date();
      await testBookingRequest.save();

      const response = await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('should preserve all booking request data in confirmed booking', async () => {
      const response = await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(200);

      const booking = await Booking.findOne({
        where: { customerEmail: 'john@customer.com' }
      });

      // Verify all data was transferred correctly
      expect(booking.customerName).toBe(testBookingRequest.customerName);
      expect(booking.customerEmail).toBe(testBookingRequest.customerEmail);
      expect(booking.customerPhone).toBe(testBookingRequest.customerPhone);
      expect(booking.startTime.toISOString()).toBe(testBookingRequest.startTime.toISOString());
      expect(booking.endTime.toISOString()).toBe(testBookingRequest.endTime.toISOString());
      expect(booking.notes).toBe(testBookingRequest.notes);
      expect(booking.userId).toBe(testBookingRequest.userId);
    });

    test('should create notifications for both host and customer', async () => {
      await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(200);

      const booking = await Booking.findOne({
        where: { customerEmail: 'john@customer.com' }
      });

      const notifications = await Notification.findAll({
        where: { bookingId: booking.id }
      });

      expect(notifications).toHaveLength(2);
      
      const hostNotification = notifications.find(n => n.recipientType === 'host');
      const customerNotification = notifications.find(n => n.recipientType === 'customer');
      
      expect(hostNotification).toBeTruthy();
      expect(hostNotification.recipientEmail).toBe(testUser.email);
      expect(customerNotification).toBeTruthy();
      expect(customerNotification.recipientEmail).toBe('john@customer.com');
    });

    test('should create audit log entry', async () => {
      await request(app)
        .get(`/api/bookings/confirm/${validToken}`)
        .expect(200);

      const booking = await Booking.findOne({
        where: { customerEmail: 'john@customer.com' }
      });

      const auditLog = await AuditLog.findOne({
        where: { action: 'booking.confirm' }
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.userId).toBe(testUser.id);
      expect(auditLog.metadata.bookingId).toBe(booking.id);
      expect(auditLog.metadata.bookingRequestId).toBe(testBookingRequest.id);
      expect(auditLog.metadata.customer_email).toBe('john@customer.com');
    });
  });
});