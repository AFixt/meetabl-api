/**
 * Booking Confirmation Integration Tests
 *
 * Tests the /api/bookings/confirm/:token endpoint with real database operations
 *
 * @author meetabl Team
 */

// Import test setup
const setup = require('./setup');
const { request, sequelize, utils } = setup;
const { resetDatabase, createTestUser, cleanup, uuidv4 } = utils;

// Import app and additional models
const { app } = require('../../src/app');
const { User, Booking, BookingRequest, Notification, AuditLog } = require('../../src/models');
const { generateBookingConfirmationToken } = require('../../src/utils/crypto');

// Mock external services
jest.mock('../../src/services/notification.service', () => ({
  sendBookingConfirmationToCustomer: jest.fn().mockResolvedValue(),
  sendBookingNotificationToHost: jest.fn().mockResolvedValue()
}));

jest.mock('../../src/services/calendar.service', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue()
}));

const notificationService = require('../../src/services/notification.service');
const calendarService = require('../../src/services/calendar.service');

describe('Booking Confirmation Integration Tests', () => {
  let testUser;
  let testBookingRequest;
  let validToken;

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create test user
    testUser = await createTestUser({
      firstName: 'Jane',
      lastName: 'Host',
      email: 'jane.host@example.com'
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
    // Clean up test data
    await Booking.destroy({ where: {}, force: true });
    await BookingRequest.destroy({ where: {}, force: true });
    await Notification.destroy({ where: {}, force: true });
    await AuditLog.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('GET /api/bookings/confirm/:token', () => {
    describe('Successful confirmation', () => {
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
              email: 'jane.host@example.com'
            }
          }
        });

        // Verify booking was created in database
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

        // Verify notifications were created
        const notifications = await Notification.findAll({
          where: { bookingId: booking.id }
        });
        expect(notifications).toHaveLength(2);
        
        const hostNotification = notifications.find(n => n.recipientType === 'host');
        const customerNotification = notifications.find(n => n.recipientType === 'customer');
        expect(hostNotification).toBeTruthy();
        expect(customerNotification).toBeTruthy();

        // Verify audit log was created
        const auditLog = await AuditLog.findOne({
          where: { action: 'booking.confirm' }
        });
        expect(auditLog).toBeTruthy();
        expect(auditLog.metadata.bookingId).toBe(booking.id);

        // Verify external services were called
        expect(notificationService.sendBookingConfirmationToCustomer).toHaveBeenCalledWith({
          booking: expect.objectContaining({
            customerName: 'John Customer',
            customerEmail: 'john@customer.com'
          }),
          host: expect.objectContaining({
            firstName: 'Jane',
            lastName: 'Host'
          })
        });

        expect(notificationService.sendBookingNotificationToHost).toHaveBeenCalledWith({
          booking: expect.objectContaining({
            customerName: 'John Customer'
          }),
          host: expect.objectContaining({
            firstName: 'Jane'
          })
        });

        expect(calendarService.createCalendarEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            customerName: 'John Customer',
            status: 'confirmed'
          })
        );
      });

      test('should handle booking request with all optional fields', async () => {
        // Create booking request with all fields filled
        const completeToken = generateBookingConfirmationToken();
        const futureTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // Day after tomorrow
        
        await BookingRequest.create({
          id: uuidv4(),
          userId: testUser.id,
          customerName: 'Complete Customer',
          customerEmail: 'complete@customer.com',
          customerPhone: '+1987654321',
          startTime: futureTime,
          endTime: new Date(futureTime.getTime() + 90 * 60 * 1000), // 1.5 hours
          notes: 'Detailed notes about the meeting requirements and agenda',
          confirmationToken: completeToken,
          status: 'pending',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });

        const response = await request(app)
          .get(`/api/bookings/confirm/${completeToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify all data was properly transferred
        const booking = await Booking.findOne({
          where: { customerEmail: 'complete@customer.com' }
        });
        expect(booking.customerPhone).toBe('+1987654321');
        expect(booking.notes).toBe('Detailed notes about the meeting requirements and agenda');
      });

      test('should handle booking request with minimal fields', async () => {
        // Create booking request with only required fields
        const minimalToken = generateBookingConfirmationToken();
        const futureTime = new Date(Date.now() + 72 * 60 * 60 * 1000); // 3 days from now
        
        await BookingRequest.create({
          id: uuidv4(),
          userId: testUser.id,
          customerName: 'Minimal Customer',
          customerEmail: 'minimal@customer.com',
          customerPhone: null, // Optional
          startTime: futureTime,
          endTime: new Date(futureTime.getTime() + 30 * 60 * 1000), // 30 minutes
          notes: null, // Optional
          confirmationToken: minimalToken,
          status: 'pending',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });

        const response = await request(app)
          .get(`/api/bookings/confirm/${minimalToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        const booking = await Booking.findOne({
          where: { customerEmail: 'minimal@customer.com' }
        });
        expect(booking.customerPhone).toBeNull();
        expect(booking.notes).toBeNull();
      });
    });

    describe('Error scenarios', () => {
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

      test('should return 404 for already confirmed booking request', async () => {
        // Mark booking request as already confirmed
        testBookingRequest.status = 'confirmed';
        testBookingRequest.confirmedAt = new Date();
        await testBookingRequest.save();

        const response = await request(app)
          .get(`/api/bookings/confirm/${validToken}`)
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
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

        // Verify no new booking was created for the original request
        const newBookings = await Booking.findAll({
          where: { customerEmail: 'john@customer.com' }
        });
        expect(newBookings).toHaveLength(0);
      });

      test('should handle partial overlap conflicts correctly', async () => {
        // Create a booking that partially overlaps with the request
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

      test('should handle malformed token gracefully', async () => {
        const malformedToken = 'invalid-token-format';

        const response = await request(app)
          .get(`/api/bookings/confirm/${malformedToken}`)
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('External service failures', () => {
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
    });

    describe('Race condition handling', () => {
      test('should handle simultaneous confirmation attempts', async () => {
        // Create two identical booking requests with same time slot
        const token1 = generateBookingConfirmationToken();
        const token2 = generateBookingConfirmationToken();
        const futureTime = new Date(Date.now() + 96 * 60 * 60 * 1000); // 4 days from now
        
        const [request1, request2] = await Promise.all([
          BookingRequest.create({
            id: uuidv4(),
            userId: testUser.id,
            customerName: 'Customer One',
            customerEmail: 'customer1@race.com',
            startTime: futureTime,
            endTime: new Date(futureTime.getTime() + 60 * 60 * 1000),
            confirmationToken: token1,
            status: 'pending',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000)
          }),
          BookingRequest.create({
            id: uuidv4(),
            userId: testUser.id,
            customerName: 'Customer Two',
            customerEmail: 'customer2@race.com',
            startTime: futureTime,
            endTime: new Date(futureTime.getTime() + 60 * 60 * 1000),
            confirmationToken: token2,
            status: 'pending',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000)
          })
        ]);

        // Attempt to confirm both simultaneously
        const [response1, response2] = await Promise.all([
          request(app).get(`/api/bookings/confirm/${token1}`),
          request(app).get(`/api/bookings/confirm/${token2}`)
        ]);

        // One should succeed, one should fail with conflict
        const responses = [response1, response2];
        const successCount = responses.filter(r => r.status === 200).length;
        const conflictCount = responses.filter(r => r.status === 409).length;

        expect(successCount).toBe(1);
        expect(conflictCount).toBe(1);

        // Verify only one booking was created
        const bookings = await Booking.findAll({
          where: {
            startTime: futureTime,
            userId: testUser.id
          }
        });
        expect(bookings).toHaveLength(1);
      });
    });

    describe('Database transaction integrity', () => {
      test('should rollback transaction on unexpected errors', async () => {
        // Mock Booking.create to fail after BookingRequest is updated
        const originalCreate = Booking.create;
        Booking.create = jest.fn().mockRejectedValue(new Error('Database error during booking creation'));

        try {
          await request(app)
            .get(`/api/bookings/confirm/${validToken}`)
            .expect(500);

          // Verify booking request status was rolled back
          await testBookingRequest.reload();
          expect(testBookingRequest.status).toBe('pending'); // Should remain unchanged
          
          // Verify no booking was created
          const bookings = await Booking.findAll();
          expect(bookings).toHaveLength(0);

        } finally {
          // Restore original method
          Booking.create = originalCreate;
        }
      });

      test('should handle notification creation failures gracefully', async () => {
        // Mock Notification.bulkCreate to fail
        const originalBulkCreate = Notification.bulkCreate;
        Notification.bulkCreate = jest.fn().mockRejectedValue(new Error('Notification creation failed'));

        try {
          await request(app)
            .get(`/api/bookings/confirm/${validToken}`)
            .expect(500);

          // Verify transaction was properly rolled back
          await testBookingRequest.reload();
          expect(testBookingRequest.status).toBe('pending');

          const bookings = await Booking.findAll();
          expect(bookings).toHaveLength(0);

        } finally {
          // Restore original method
          Notification.bulkCreate = originalBulkCreate;
        }
      });
    });

    describe('Edge cases and boundaries', () => {
      test('should handle booking request expiring exactly at confirmation time', async () => {
        // Set expiration to current time (edge case)
        testBookingRequest.expiresAt = new Date();
        await testBookingRequest.save();

        // Wait a millisecond to ensure expiration
        await new Promise(resolve => setTimeout(resolve, 1));

        const response = await request(app)
          .get(`/api/bookings/confirm/${validToken}`)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      test('should handle very long customer names and notes', async () => {
        const longToken = generateBookingConfirmationToken();
        const longName = 'A'.repeat(100); // Max length
        const longNotes = 'N'.repeat(1000); // Very long notes
        
        await BookingRequest.create({
          id: uuidv4(),
          userId: testUser.id,
          customerName: longName,
          customerEmail: 'long@customer.com',
          startTime: new Date(Date.now() + 120 * 60 * 60 * 1000), // 5 days from now
          endTime: new Date(Date.now() + 120 * 60 * 60 * 1000 + 60 * 60 * 1000),
          notes: longNotes,
          confirmationToken: longToken,
          status: 'pending',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });

        const response = await request(app)
          .get(`/api/bookings/confirm/${longToken}`)
          .expect(200);

        const booking = await Booking.findOne({
          where: { customerEmail: 'long@customer.com' }
        });
        expect(booking.customerName).toBe(longName);
        expect(booking.notes).toBe(longNotes);
      });

      test('should handle special characters in customer data', async () => {
        const specialToken = generateBookingConfirmationToken();
        const specialName = "José María Ñoño-O'Connor";
        const specialEmail = "josé.maría@tëst-dømäin.cøm";
        
        await BookingRequest.create({
          id: uuidv4(),
          userId: testUser.id,
          customerName: specialName,
          customerEmail: specialEmail,
          startTime: new Date(Date.now() + 144 * 60 * 60 * 1000), // 6 days from now
          endTime: new Date(Date.now() + 144 * 60 * 60 * 1000 + 60 * 60 * 1000),
          confirmationToken: specialToken,
          status: 'pending',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });

        const response = await request(app)
          .get(`/api/bookings/confirm/${specialToken}`)
          .expect(200);

        const booking = await Booking.findOne({
          where: { customerEmail: specialEmail }
        });
        expect(booking.customerName).toBe(specialName);
      });
    });
  });
});