/**
 * Booking controller unit tests
 *
 * Using the improved test setup for consistent mocking
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
  getUserBookings,
  createBooking,
  getBooking,
  cancelBooking,
  getPublicBookings,
  createPublicBooking,
  rescheduleBooking,
  bulkCancelBookings,
  confirmBookingRequest
} = require('../../../src/controllers/booking.controller');

// Import models that will be used across tests
const { Booking } = require('../../../src/models');

// Ensure createMockRequest, createMockResponse, createMockNext are available
if (typeof global.createMockRequest !== 'function'
    || typeof global.createMockResponse !== 'function'
    || typeof global.createMockNext !== 'function') {
  // Define them if they're not available in the global scope
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

  global.createMockNext = () => jest.fn();
}

describe('Booking Controller', () => {
  describe('getUserBookings', () => {
    test('should get user bookings successfully', async () => {
      // Create mock request and response
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        query: {
          limit: 10,
          offset: 0
        }
      });
      const res = createMockResponse();

      // Call controller
      await getUserBookings(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalled();
    });

  });

  describe('createBooking', () => {
    test('should create booking successfully', async () => {
      // Create future dates for booking
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      startTime.setHours(10, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setHours(11, 0, 0, 0);

      // Create mock request and response
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString()
        }
      });
      const res = createMockResponse();

      // Mock required models and dependencies
      const { Booking, Notification, AuditLog } = require('../../../src/models');
      const { sequelize } = require('../../../src/config/database');
      const notificationService = require('../../../src/services/notification.service');
      const calendarService = require('../../../src/services/calendar.service');
      
      // Mock transaction
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(null),
        rollback: jest.fn().mockResolvedValue(null)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);
      
      // Mock Booking.findOne to return null (no overlapping bookings)
      Booking.findOne.mockResolvedValueOnce(null);

      // Mock Booking.create to return a proper booking
      Booking.create.mockResolvedValueOnce({
        id: 'test-booking-id',
        user_id: 'test-user-id',
        customer_name: 'Test Customer',
        customer_email: 'customer@example.com',
        start_time: startTime,
        end_time: endTime,
        status: 'confirmed'
      });

      // Mock other required dependencies that expect transaction parameter
      Notification.create.mockResolvedValueOnce({ id: 'notification-id' });
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-log-id' });

      // Call controller
      const next = createMockNext();
      await createBooking(req, res, next);

      // Check if there was an error
      if (next.mock.calls.length > 0) {
        console.log('Error in createBooking:', next.mock.calls[0][0]);
      }

      // Check response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();

      // Verify response data
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data).toBeDefined();
      expect(responseData.data.customer_name || responseData.data.customerName).toBe('Test Customer');
      expect(responseData.data.customer_email || responseData.data.customerEmail).toBe('customer@example.com');
    });

  });

  describe('getBooking', () => {
    test('should get booking by ID successfully', async () => {
      // Create mock request and response
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: {
          id: 'test-booking-id'
        }
      });
      const res = createMockResponse();

      // Call controller
      await getBooking(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });

  });

  describe('cancelBooking', () => {
    test('should cancel booking successfully', async () => {
      // Mock booking to cancel
      const mockBooking = {
        id: 'test-booking-id',
        status: 'confirmed',
        save: jest.fn().mockResolvedValue(true)
      };

      // Create mock request and response
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: {
          id: 'test-booking-id'
        }
      });
      const res = createMockResponse();

      // Mock Booking.findOne to return the booking
      Booking.findOne.mockResolvedValueOnce(mockBooking);

      // Call controller
      await cancelBooking(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      // Verify booking was updated
      expect(mockBooking.status).toBe('cancelled');
      expect(mockBooking.save).toHaveBeenCalled();
    });

    test('should return 404 for non-existent booking', async () => {
      // Create mock request and response
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: {
          id: 'non-existent-id'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Mock Booking.findOne to return null
      Booking.findOne.mockResolvedValueOnce(null);

      // Call controller - should throw not found error
      try {
        await cancelBooking(req, res, next);
      } catch (error) {
        // Error should be caught by asyncHandler and passed to next
        expect(error).toBeUndefined();
      }

      // Verify that next was called with not found error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('rescheduleBooking', () => {
    test('should reschedule booking successfully', async () => {
      // Mock dependencies
      const { Booking, Notification, AuditLog, sequelize } = require('../../../src/models');
      const notificationService = require('../../../src/services/notification.service');
      const calendarService = require('../../../src/services/calendar.service');

      // Mock booking lookup
      const mockBooking = {
        id: 'booking-id',
        user_id: 'test-user-id',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z',
        status: 'confirmed',
        save: jest.fn().mockResolvedValue({})
      };

      Booking.findOne
        .mockResolvedValueOnce(mockBooking) // For finding the booking
        .mockResolvedValueOnce(null); // No overlapping bookings

      // Create request with new times
      const req = createMockRequest({
        params: { id: 'booking-id' },
        body: {
          start_time: '2024-01-02T10:00:00Z',
          end_time: '2024-01-02T11:00:00Z'
        }
      });
      const res = createMockResponse();

      // Execute the controller
      await rescheduleBooking(req, res);

      // Verify booking was updated
      expect(mockBooking.start_time).toBe('2024-01-02T10:00:00Z');
      expect(mockBooking.end_time).toBe('2024-01-02T11:00:00Z');
      expect(mockBooking.save).toHaveBeenCalled();

      // Verify notification was created
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: 'booking-id',
          type: 'email',
          status: 'pending'
        }),
        expect.objectContaining({ transaction: expect.any(Object) })
      );

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockBooking);
    });

    test('should reject reschedule for cancelled booking', async () => {
      // Mock cancelled booking
      const { Booking, sequelize } = require('../../../src/models');
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(null),
        rollback: jest.fn().mockResolvedValue(null)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);
      
      Booking.findOne.mockResolvedValueOnce({
        id: 'booking-id',
        userId: 'test-user-id',
        status: 'cancelled'
      });

      // Create request
      const req = createMockRequest({
        params: { id: 'booking-id' },
        body: {
          start_time: '2024-01-02T10:00:00Z',
          end_time: '2024-01-02T11:00:00Z'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Execute the controller - should throw validation error
      await rescheduleBooking(req, res, next);

      // Verify that next was called with validation error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.details[0].message).toContain('Cannot reschedule a cancelled booking');
    });

    test('should detect overlapping bookings during reschedule', async () => {
      // Mock booking lookup
      Booking.findOne
        .mockResolvedValueOnce({ // The booking to reschedule
          id: 'booking-id',
          userId: 'test-user-id',
          status: 'confirmed'
        })
        .mockResolvedValueOnce({ // An overlapping booking
          id: 'other-booking-id'
        });

      // Create request
      const req = createMockRequest({
        params: { id: 'booking-id' },
        body: {
          start_time: '2024-01-02T10:00:00Z',
          end_time: '2024-01-02T11:00:00Z'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Execute the controller - should throw conflict error
      try {
        await rescheduleBooking(req, res, next);
      } catch (error) {
        // Error should be caught by asyncHandler and passed to next
        expect(error).toBeUndefined();
      }

      // Verify that next was called with conflict error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(409);
      expect(error.errorCode).toBe('CONFLICT');
      expect(error.message).toContain('Time slot is not available');
    });
  });

  describe('bulkCancelBookings', () => {
    test('should bulk cancel bookings successfully', async () => {
      // Mock dependencies
      const { Booking, Notification, AuditLog } = require('../../../src/models');
      const notificationService = require('../../../src/services/notification.service');
      const calendarService = require('../../../src/services/calendar.service');

      // Mock bookings lookup
      const mockBookings = [
        {
          id: 'booking-1',
          user_id: 'test-user-id',
          status: 'confirmed',
          save: jest.fn().mockResolvedValue({})
        },
        {
          id: 'booking-2',
          user_id: 'test-user-id',
          status: 'confirmed',
          save: jest.fn().mockResolvedValue({})
        }
      ];

      Booking.findAll.mockResolvedValueOnce(mockBookings);

      // Create request
      const req = createMockRequest({
        body: { booking_ids: ['booking-1', 'booking-2'] }
      });
      const res = createMockResponse();

      // Execute the controller
      await bulkCancelBookings(req, res);

      // Verify bookings were cancelled
      mockBookings.forEach(booking => {
        expect(booking.status).toBe('cancelled');
        expect(booking.save).toHaveBeenCalled();
      });

      // Verify notifications were created
      expect(Notification.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ booking_id: 'booking-1' }),
          expect.objectContaining({ booking_id: 'booking-2' })
        ]),
        expect.objectContaining({ transaction: expect.any(Object) })
      );

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        cancelled_count: 2,
        cancelled_booking_ids: ['booking-1', 'booking-2'],
        message: 'Successfully cancelled 2 bookings'
      }));
    });

    test('should reject invalid booking IDs', async () => {
      // Create request with invalid data
      const req = createMockRequest({
        body: { booking_ids: [] }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Execute the controller - should throw validation error
      try {
        await bulkCancelBookings(req, res, next);
      } catch (error) {
        // Error should be caught by asyncHandler and passed to next
        expect(error).toBeUndefined();
      }

      // Verify that next was called with validation error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.details[0].message).toContain('non-empty array');
    });

    test('should limit bulk operations to 100 bookings', async () => {
      // Create request with too many IDs
      const tooManyIds = Array(101).fill('booking-id');
      const req = createMockRequest({
        body: { booking_ids: tooManyIds }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Execute the controller - should throw validation error
      try {
        await bulkCancelBookings(req, res, next);
      } catch (error) {
        // Error should be caught by asyncHandler and passed to next
        expect(error).toBeUndefined();
      }

      // Verify that next was called with validation error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.details[0].message).toContain('100 or fewer');
    });

    test('should handle no valid bookings found', async () => {
      // Mock no bookings found
      Booking.findAll.mockResolvedValueOnce([]);

      // Create request
      const req = createMockRequest({
        body: { booking_ids: ['booking-1', 'booking-2'] }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Execute the controller - should throw not found error
      try {
        await bulkCancelBookings(req, res, next);
      } catch (error) {
        // Error should be caught by asyncHandler and passed to next
        expect(error).toBeUndefined();
      }

      // Verify that next was called with not found error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
      expect(error.message).toContain('No valid bookings found to cancel');
    });
  });

  describe('getPublicBookings', () => {
    test('should get public bookings for valid user', async () => {
      const { User, UserSettings, AvailabilityRule, Booking } = require('../../../src/models');
      const calendarService = require('../../../src/services/calendar.service');

      // Mock user lookup
      const mockUser = {
        id: 'user-id',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        UserSetting: {
          bookingHorizon: 30,
          meetingDuration: 60,
          bufferMinutes: 15
        }
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      // Mock availability rules
      const mockRules = [{
        dayOfWeek: 1, // Monday
        startTime: '09:00:00',
        endTime: '17:00:00',
        buffer_minutes: 15
      }];
      AvailabilityRule.findAll.mockResolvedValueOnce(mockRules);

      // Mock no existing bookings
      Booking.findAll.mockResolvedValueOnce([]);

      // Mock calendar service
      calendarService.getAllBusyTimes.mockResolvedValueOnce([]);

      // Create request for next Monday
      const nextMonday = new Date();
      nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
      const dateStr = nextMonday.toISOString().split('T')[0];

      const req = createMockRequest({
        params: { username: 'johndoe' },
        query: { date: dateStr, duration: 60 }
      });
      const res = createMockResponse();

      await getPublicBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.user.username).toBe('johndoe');
      expect(responseData.data.available_slots).toBeDefined();
    });

    test('should return 404 for non-existent user', async () => {
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce(null);

      const req = createMockRequest({
        params: { username: 'nonexistent' },
        query: { date: '2024-01-01' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await getPublicBookings(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
    });

    test('should validate date format', async () => {
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce({ id: 'user-id', UserSetting: {} });

      const req = createMockRequest({
        params: { username: 'johndoe' },
        query: { date: 'invalid-date' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await getPublicBookings(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.details[0].field).toBe('date');
    });

    test('should reject dates beyond booking horizon', async () => {
      const { User } = require('../../../src/models');
      const mockUser = {
        id: 'user-id',
        UserSetting: { bookingHorizon: 7 } // Only 7 days ahead
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      // Date 30 days in future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().split('T')[0];

      const req = createMockRequest({
        params: { username: 'johndoe' },
        query: { date: dateStr }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await getPublicBookings(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.details[0].message).toContain('7 days in advance');
    });

    test('should reject past dates', async () => {
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce({ id: 'user-id', UserSetting: {} });

      const req = createMockRequest({
        params: { username: 'johndoe' },
        query: { date: '2020-01-01' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await getPublicBookings(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.details[0].message).toContain('past');
    });
  });

  describe('createPublicBooking', () => {
    test('should create public booking request successfully', async () => {
      const { User, BookingRequest, AuditLog, sequelize } = require('../../../src/models');
      const notificationService = require('../../../src/services/notification.service');

      // Mock transaction
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(null),
        rollback: jest.fn().mockResolvedValue(null)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);

      // Mock user lookup
      const mockUser = {
        id: 'user-id',
        firstName: 'John',
        lastName: 'Doe'
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      // Mock no overlapping bookings or requests
      const { Booking } = require('../../../src/models');
      Booking.findOne.mockResolvedValueOnce(null);
      BookingRequest.findOne.mockResolvedValueOnce(null);

      // Mock creation methods
      BookingRequest.create.mockResolvedValueOnce({ id: 'request-id' });
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const startTime = futureDate.toISOString();
      futureDate.setHours(futureDate.getHours() + 1);
      const endTime = futureDate.toISOString();

      const req = createMockRequest({
        params: { username: 'johndoe' },
        body: {
          customer_name: 'Customer Name',
          customer_email: 'customer@example.com',
          customer_phone: '+1234567890',
          start_time: startTime,
          end_time: endTime,
          notes: 'Test booking'
        }
      });
      const res = createMockResponse();

      await createPublicBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.message).toContain('Booking request created');
    });

    test('should reject invalid datetime format', async () => {
      const { User } = require('../../../src/models');
      User.findOne.mockResolvedValueOnce({ id: 'user-id' });

      const req = createMockRequest({
        params: { username: 'johndoe' },
        body: {
          customer_name: 'Customer',
          customer_email: 'test@example.com',
          start_time: 'invalid-date',
          end_time: 'invalid-date'
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await createPublicBooking(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    test('should detect overlapping confirmed bookings', async () => {
      const { User, Booking, sequelize } = require('../../../src/models');
      
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(null),
        rollback: jest.fn().mockResolvedValue(null)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);

      User.findOne.mockResolvedValueOnce({ id: 'user-id' });
      
      // Mock overlapping booking
      Booking.findOne.mockResolvedValueOnce({ id: 'existing-booking' });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const startTime = futureDate.toISOString();
      futureDate.setHours(futureDate.getHours() + 1);
      const endTime = futureDate.toISOString();

      const req = createMockRequest({
        params: { username: 'johndoe' },
        body: {
          customer_name: 'Customer',
          customer_email: 'test@example.com',
          start_time: startTime,
          end_time: endTime
        }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await createPublicBooking(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(409);
      expect(error.message).toContain('not available');
    });
  });

  describe('confirmBookingRequest', () => {
    test('should confirm booking request successfully', async () => {
      const { BookingRequest, User, Booking, Notification, AuditLog, sequelize } = require('../../../src/models');
      const notificationService = require('../../../src/services/notification.service');
      const calendarService = require('../../../src/services/calendar.service');

      // Mock transaction
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(null),
        rollback: jest.fn().mockResolvedValue(null)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);

      // Mock booking request lookup
      const mockBookingRequest = {
        id: 'request-id',
        userId: 'user-id',
        customerName: 'Customer',
        customerEmail: 'customer@example.com',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        save: jest.fn().mockResolvedValue({}),
        User: {
          id: 'user-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      };
      BookingRequest.findOne.mockResolvedValueOnce(mockBookingRequest);

      // Mock no overlapping bookings
      Booking.findOne.mockResolvedValueOnce(null);

      // Mock creation methods
      Booking.create.mockResolvedValueOnce({
        id: 'booking-id',
        customerName: 'Customer',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        status: 'confirmed'
      });
      Notification.bulkCreate.mockResolvedValueOnce([]);
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

      const req = createMockRequest({
        params: { token: 'valid-token' }
      });
      const res = createMockResponse();

      await confirmBookingRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.booking.status).toBe('confirmed');
    });

    test('should reject expired booking request', async () => {
      const { BookingRequest, sequelize } = require('../../../src/models');

      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(null),
        rollback: jest.fn().mockResolvedValue(null)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);

      // Mock expired booking request
      const mockBookingRequest = {
        id: 'request-id',
        status: 'pending',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        save: jest.fn().mockResolvedValue({})
      };
      BookingRequest.findOne.mockResolvedValueOnce(mockBookingRequest);

      const req = createMockRequest({
        params: { token: 'expired-token' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await confirmBookingRequest(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.details[0].message).toContain('expired');
    });

    test('should handle race condition with overlapping bookings', async () => {
      const { BookingRequest, Booking, sequelize } = require('../../../src/models');

      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(null),
        rollback: jest.fn().mockResolvedValue(null)
      };
      sequelize.transaction.mockResolvedValueOnce(mockTransaction);

      // Mock valid booking request
      const mockBookingRequest = {
        id: 'request-id',
        userId: 'user-id',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn().mockResolvedValue({})
      };
      BookingRequest.findOne.mockResolvedValueOnce(mockBookingRequest);

      // Mock overlapping booking (race condition)
      Booking.findOne.mockResolvedValueOnce({ id: 'existing-booking' });

      const req = createMockRequest({
        params: { token: 'valid-token' }
      });
      const res = createMockResponse();

      await confirmBookingRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error.code).toBe('time_slot_taken');
    });

    test('should return 404 for invalid token', async () => {
      const { BookingRequest } = require('../../../src/models');
      BookingRequest.findOne.mockResolvedValueOnce(null);

      const req = createMockRequest({
        params: { token: 'invalid-token' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await confirmBookingRequest(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('Invalid or expired');
    });
  });

  describe('Additional edge cases', () => {
    describe('createBooking edge cases', () => {
      test('should handle invalid date formats', async () => {
        const req = createMockRequest({
          body: {
            customer_name: 'Test',
            customer_email: 'test@example.com',
            start_time: 'invalid-date',
            end_time: 'invalid-date'
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        await createBooking(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(400);
      });

      test('should reject when start time equals end time', async () => {
        const sameTime = new Date().toISOString();
        
        const req = createMockRequest({
          body: {
            customer_name: 'Test',
            customer_email: 'test@example.com',
            start_time: sameTime,
            end_time: sameTime
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        await createBooking(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(400);
        expect(error.details[0].message).toContain('End time must be after start time');
      });

      test('should handle calendar service errors gracefully', async () => {
        const { Booking, Notification, AuditLog, sequelize } = require('../../../src/models');
        const calendarService = require('../../../src/services/calendar.service');

        // Mock transaction
        const mockTransaction = {
          commit: jest.fn().mockResolvedValue(null),
          rollback: jest.fn().mockResolvedValue(null)
        };
        sequelize.transaction.mockResolvedValueOnce(mockTransaction);

        // Mock successful booking creation
        Booking.findOne.mockResolvedValueOnce(null);
        const mockBooking = { id: 'booking-id' };
        Booking.create.mockResolvedValueOnce(mockBooking);
        Notification.create.mockResolvedValueOnce({ id: 'notification-id' });
        AuditLog.create.mockResolvedValueOnce({ id: 'audit-log-id' });

        // Mock calendar service to throw error
        calendarService.createCalendarEvent.mockRejectedValueOnce(new Error('Calendar API error'));

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);
        const startTime = futureDate.toISOString();
        futureDate.setHours(futureDate.getHours() + 1);
        const endTime = futureDate.toISOString();

        const req = createMockRequest({
          body: {
            customer_name: 'Test',
            customer_email: 'test@example.com',
            start_time: startTime,
            end_time: endTime
          }
        });
        const res = createMockResponse();

        await createBooking(req, res);

        // Should still succeed despite calendar error
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalled();
      });
    });

    describe('cancelBooking edge cases', () => {
      test('should reject cancelling already cancelled booking', async () => {
        const { Booking, sequelize } = require('../../../src/models');
        
        const mockTransaction = {
          commit: jest.fn().mockResolvedValue(null),
          rollback: jest.fn().mockResolvedValue(null)
        };
        sequelize.transaction.mockResolvedValueOnce(mockTransaction);

        const mockBooking = {
          id: 'booking-id',
          status: 'cancelled'
        };
        Booking.findOne.mockResolvedValueOnce(mockBooking);

        const req = createMockRequest({
          params: { id: 'booking-id' }
        });
        const res = createMockResponse();
        const next = createMockNext();

        await cancelBooking(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(400);
        expect(error.details[0].message).toContain('already cancelled');
      });
    });
  });
});
