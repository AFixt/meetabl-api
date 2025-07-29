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
  bulkCancelBookings
} = require('../../../src/controllers/booking.controller');

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
      const { Booking } = require('../../../src/models');
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
      const { Booking } = require('../../../src/models');
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
      const { Booking } = require('../../../src/models');
      Booking.findOne.mockResolvedValueOnce({
        id: 'booking-id',
        user_id: 'test-user-id',
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
      try {
        await rescheduleBooking(req, res, next);
      } catch (error) {
        // Error should be caught by asyncHandler and passed to next
        expect(error).toBeUndefined();
      }

      // Verify that next was called with validation error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.details[0].message).toContain('Cannot reschedule a cancelled booking');
    });

    test('should detect overlapping bookings during reschedule', async () => {
      // Mock booking lookup
      const { Booking } = require('../../../src/models');
      Booking.findOne
        .mockResolvedValueOnce({ // The booking to reschedule
          id: 'booking-id',
          user_id: 'test-user-id',
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
      const { Booking } = require('../../../src/models');
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
});
