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
  createPublicBooking
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

  // Additional tests for getPublicBookings and createPublicBooking would follow
});
