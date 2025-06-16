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

    test('should handle database errors', async () => {
      // Mock Booking.findAndCountAll to throw an error
      const { Booking } = require('../../../src/models');
      Booking.findAndCountAll.mockRejectedValueOnce(new Error('Database error'));

      // Create mock request and response
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Call controller
      await getUserBookings(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();

      // Verify error
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('internal_server_error');
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

      // Mock Booking.findOne to return null (no overlapping bookings)
      const { Booking } = require('../../../src/models');
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

      // Call controller
      await createBooking(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();

      // Verify response data
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.id).toBeDefined();
      expect(responseData.customer_name).toBe('Test Customer');
      expect(responseData.customer_email).toBe('customer@example.com');
    });

    test('should validate time range', async () => {
      // Create invalid dates (end before start)
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      startTime.setHours(11, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setHours(10, 0, 0, 0);

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

      // Call controller
      await createBooking(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();

      // Verify error
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
      expect(responseData.error.message).toContain('End time must be after start time');
    });

    test('should detect overlapping bookings', async () => {
      // Create valid dates for booking
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

      // Mock Booking.findOne to return an overlapping booking
      const { Booking } = require('../../../src/models');
      Booking.findOne.mockResolvedValueOnce({
        id: 'existing-booking-id',
        start_time: startTime,
        end_time: endTime
      });

      // Call controller
      await createBooking(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();

      // Verify error
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
      expect(responseData.error.message).toContain('Time slot is not available');
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

    test('should return 404 for non-existent booking', async () => {
      // Create mock request and response
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: {
          id: 'non-existent-id'
        }
      });
      const res = createMockResponse();

      // Mock Booking.findOne to return null
      const { Booking } = require('../../../src/models');
      Booking.findOne.mockResolvedValueOnce(null);

      // Call controller
      await getBooking(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();

      // Verify error
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('not_found');
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

      // Mock Booking.findOne to return null
      const { Booking } = require('../../../src/models');
      Booking.findOne.mockResolvedValueOnce(null);

      // Call controller
      await cancelBooking(req, res);

      // Check response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();

      // Verify error
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('not_found');
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

      // Execute the controller
      await rescheduleBooking(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'bad_request',
          message: 'Cannot reschedule a cancelled booking'
        })
      }));
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

      // Execute the controller
      await rescheduleBooking(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'bad_request',
          message: 'Time slot is not available'
        })
      }));
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

      // Execute the controller
      await bulkCancelBookings(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'bad_request',
          message: 'Booking IDs are required'
        })
      }));
    });

    test('should limit bulk operations to 100 bookings', async () => {
      // Create request with too many IDs
      const tooManyIds = Array(101).fill('booking-id');
      const req = createMockRequest({
        body: { booking_ids: tooManyIds }
      });
      const res = createMockResponse();

      // Execute the controller
      await bulkCancelBookings(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'bad_request',
          message: 'Cannot cancel more than 100 bookings at once'
        })
      }));
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

      // Execute the controller
      await bulkCancelBookings(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'not_found',
          message: 'No valid bookings found to cancel'
        })
      }));
    });
  });
});
