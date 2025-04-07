/**
 * Booking controller tests
 * 
 * @author AccessMeet Team
 */

const { 
  getUserBookings, 
  createBooking,
  getBooking,
  cancelBooking,
  getPublicBookings,
  createPublicBooking
} = require('../../../src/controllers/booking.controller');
const { Booking, Notification, AuditLog } = require('../../../src/models');
const { mockRequest, mockResponse } = require('../../fixtures/mocks');
const { setupTestDatabase, clearDatabase, createTestUser, createBooking: dbCreateBooking, createAvailabilityRule } = require('../../fixtures/db');

// Mock services
jest.mock('../../../src/services/notification.service', () => ({
  queueNotification: jest.fn().mockResolvedValue({ id: 'mock-notification-id' })
}));

jest.mock('../../../src/services/calendar.service', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue({ id: 'mock-calendar-event-id' })
}));

describe('Booking Controller', () => {
  let user;

  // Setup and teardown
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    user = await createTestUser();
  });

  afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
  });

  describe('getUserBookings', () => {
    test('should get user bookings successfully', async () => {
      // Create test bookings
      await dbCreateBooking(user.id);
      await dbCreateBooking(user.id);
      
      const req = mockRequest({
        user: { id: user.id },
        query: {
          limit: 10,
          offset: 0
        }
      });
      const res = mockResponse();

      await getUserBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalled();
      
      const bookings = res.json.mock.calls[0][0];
      expect(Array.isArray(bookings)).toBe(true);
      expect(bookings.length).toBe(2);
    });

    test('should apply pagination parameters', async () => {
      // Create test bookings
      await dbCreateBooking(user.id);
      await dbCreateBooking(user.id);
      
      const req = mockRequest({
        user: { id: user.id },
        query: {
          limit: 1,
          offset: 0
        }
      });
      const res = mockResponse();

      await getUserBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const bookings = res.json.mock.calls[0][0];
      expect(Array.isArray(bookings)).toBe(true);
      expect(bookings.length).toBe(1);
    });
  });

  describe('createBooking', () => {
    test('should create booking successfully', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      
      const endTime = new Date(tomorrow);
      endTime.setHours(10, 0, 0, 0);
      
      const req = mockRequest({
        user: { id: user.id },
        body: {
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com',
          start_time: tomorrow.toISOString(),
          end_time: endTime.toISOString()
        }
      });
      const res = mockResponse();

      await createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.id).toBeDefined();
      expect(responseData.user_id).toBe(user.id);
      expect(responseData.customer_name).toBe('Test Customer');
      expect(responseData.customer_email).toBe('customer@example.com');
      expect(responseData.status).toBe('confirmed');
      
      // Check notification was queued
      const notificationService = require('../../../src/services/notification.service');
      expect(notificationService.queueNotification).toHaveBeenCalled();
      
      // Check calendar event was created
      const calendarService = require('../../../src/services/calendar.service');
      expect(calendarService.createCalendarEvent).toHaveBeenCalled();
      
      // Check audit log was created
      const auditLog = await AuditLog.findOne({ 
        where: { 
          user_id: user.id,
          action: 'booking.create'
        } 
      });
      expect(auditLog).toBeDefined();
    });

    test('should validate time range', async () => {
      const now = new Date();
      
      // Set start time after end time
      const startTime = new Date(now);
      startTime.setHours(10, 0, 0, 0);
      
      const endTime = new Date(now);
      endTime.setHours(9, 0, 0, 0);
      
      const req = mockRequest({
        user: { id: user.id },
        body: {
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString()
        }
      });
      const res = mockResponse();

      await createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
    });

    test('should detect overlapping bookings', async () => {
      // Create an existing booking
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      startTime.setHours(9, 0, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setHours(11, 0, 0, 0);
      
      await dbCreateBooking(user.id, {
        start_time: startTime,
        end_time: endTime
      });
      
      // Try to create overlapping booking
      const newStartTime = new Date(startTime);
      newStartTime.setHours(10, 0, 0, 0);
      
      const newEndTime = new Date(newStartTime);
      newEndTime.setHours(12, 0, 0, 0);
      
      const req = mockRequest({
        user: { id: user.id },
        body: {
          customer_name: 'Test Customer',
          customer_email: 'customer@example.com',
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString()
        }
      });
      const res = mockResponse();

      await createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
      expect(responseData.error.message).toContain('not available');
    });
  });

  describe('getBooking', () => {
    test('should get booking by ID successfully', async () => {
      // Create test booking
      const booking = await dbCreateBooking(user.id);
      
      const req = mockRequest({
        user: { id: user.id },
        params: {
          id: booking.id
        }
      });
      const res = mockResponse();

      await getBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.id).toBe(booking.id);
      expect(responseData.user_id).toBe(user.id);
    });

    test('should return 404 for non-existent booking', async () => {
      const req = mockRequest({
        user: { id: user.id },
        params: {
          id: 'non-existent-id'
        }
      });
      const res = mockResponse();

      await getBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('not_found');
    });
  });

  describe('cancelBooking', () => {
    test('should cancel booking successfully', async () => {
      // Create test booking
      const booking = await dbCreateBooking(user.id);
      
      const req = mockRequest({
        user: { id: user.id },
        params: {
          id: booking.id
        }
      });
      const res = mockResponse();

      await cancelBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.id).toBe(booking.id);
      expect(responseData.status).toBe('cancelled');
      
      // Check notification was queued
      const notificationService = require('../../../src/services/notification.service');
      expect(notificationService.queueNotification).toHaveBeenCalled();
      
      // Check calendar event was updated
      const calendarService = require('../../../src/services/calendar.service');
      expect(calendarService.createCalendarEvent).toHaveBeenCalled();
      
      // Check audit log was created
      const auditLog = await AuditLog.findOne({ 
        where: { 
          user_id: user.id,
          action: 'booking.cancel'
        } 
      });
      expect(auditLog).toBeDefined();
      
      // Check booking status in database
      const updatedBooking = await Booking.findByPk(booking.id);
      expect(updatedBooking.status).toBe('cancelled');
    });

    test('should return 404 for non-existent booking', async () => {
      const req = mockRequest({
        user: { id: user.id },
        params: {
          id: 'non-existent-id'
        }
      });
      const res = mockResponse();

      await cancelBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('not_found');
    });
  });

  describe('getPublicBookings', () => {
    test('should get available public booking slots', async () => {
      // Create availability rule for user
      await createAvailabilityRule(user.id, {
        day_of_week: new Date().getDay(), // Today
        start_time: '09:00:00',
        end_time: '17:00:00'
      });
      
      // Format date as YYYY-MM-DD
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      const req = mockRequest({
        params: {
          username: user.name
        },
        query: {
          date: dateStr,
          duration: 60
        }
      });
      const res = mockResponse();

      await getPublicBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.user).toBeDefined();
      expect(responseData.user.id).toBe(user.id);
      expect(responseData.date).toBe(dateStr);
      expect(Array.isArray(responseData.available_slots)).toBe(true);
    });

    test('should validate date format', async () => {
      const req = mockRequest({
        params: {
          username: user.name
        },
        query: {
          date: 'invalid-date',
          duration: 60
        }
      });
      const res = mockResponse();

      await getPublicBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
    });

    test('should return 404 for non-existent user', async () => {
      // Format date as YYYY-MM-DD
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      const req = mockRequest({
        params: {
          username: 'non-existent-user'
        },
        query: {
          date: dateStr,
          duration: 60
        }
      });
      const res = mockResponse();

      await getPublicBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('not_found');
    });
  });

  describe('createPublicBooking', () => {
    test('should create public booking successfully', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      
      const endTime = new Date(tomorrow);
      endTime.setHours(10, 0, 0, 0);
      
      const req = mockRequest({
        params: {
          username: user.name
        },
        body: {
          customer_name: 'Public Customer',
          customer_email: 'public@example.com',
          start_time: tomorrow.toISOString(),
          end_time: endTime.toISOString()
        }
      });
      const res = mockResponse();

      await createPublicBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.id).toBeDefined();
      expect(responseData.customer_name).toBe('Public Customer');
      expect(responseData.status).toBe('confirmed');
      
      // Check notification was queued
      const notificationService = require('../../../src/services/notification.service');
      expect(notificationService.queueNotification).toHaveBeenCalled();
      
      // Check calendar event was created
      const calendarService = require('../../../src/services/calendar.service');
      expect(calendarService.createCalendarEvent).toHaveBeenCalled();
      
      // Check booking in database
      const booking = await Booking.findByPk(responseData.id);
      expect(booking).toBeDefined();
      expect(booking.user_id).toBe(user.id);
      expect(booking.customer_email).toBe('public@example.com');
    });

    test('should return 404 for non-existent user', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      
      const endTime = new Date(tomorrow);
      endTime.setHours(10, 0, 0, 0);
      
      const req = mockRequest({
        params: {
          username: 'non-existent-user'
        },
        body: {
          customer_name: 'Public Customer',
          customer_email: 'public@example.com',
          start_time: tomorrow.toISOString(),
          end_time: endTime.toISOString()
        }
      });
      const res = mockResponse();

      await createPublicBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('not_found');
    });
  });
});