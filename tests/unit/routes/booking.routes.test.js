/**
 * Booking Routes Tests
 * 
 * Tests for booking route definitions and middleware setup
 * 
 * @author meetabl Team
 */

const express = require('express');
const request = require('supertest');

// Mock the controller functions
jest.mock('../../../src/controllers/booking.controller', () => ({
  createBooking: jest.fn((req, res) => res.status(201).json({ message: 'Booking created' })),
  getBookings: jest.fn((req, res) => res.status(200).json({ bookings: [] })),
  getBookingById: jest.fn((req, res) => res.status(200).json({ booking: {} })),
  updateBooking: jest.fn((req, res) => res.status(200).json({ message: 'Booking updated' })),
  cancelBooking: jest.fn((req, res) => res.status(200).json({ message: 'Booking cancelled' })),
  deleteBooking: jest.fn((req, res) => res.status(200).json({ message: 'Booking deleted' })),
  confirmBooking: jest.fn((req, res) => res.status(200).json({ message: 'Booking confirmed' })),
  rescheduleBooking: jest.fn((req, res) => res.status(200).json({ message: 'Booking rescheduled' })),
  getPublicBookingPage: jest.fn((req, res) => res.status(200).json({ bookingPage: {} })),
  createPublicBooking: jest.fn((req, res) => res.status(201).json({ message: 'Public booking created' })),
  getBookingAnalytics: jest.fn((req, res) => res.status(200).json({ analytics: {} }))
}));

// Mock validation middleware
jest.mock('../../../src/middlewares/validation', () => ({
  validateCreateBooking: jest.fn((req, res, next) => next()),
  validateUpdateBooking: jest.fn((req, res, next) => next()),
  validateBookingId: jest.fn((req, res, next) => next()),
  validatePublicBooking: jest.fn((req, res, next) => next()),
  validateReschedule: jest.fn((req, res, next) => next())
}));

// Mock auth middleware
jest.mock('../../../src/middlewares/auth', () => ({
  authenticateJWT: jest.fn((req, res, next) => {
    req.user = { id: 1 };
    next();
  }),
  optionalAuth: jest.fn((req, res, next) => next())
}));

// Import the routes after mocking
const bookingRoutes = require('../../../src/routes/booking.routes');
const bookingController = require('../../../src/controllers/booking.controller');
const validation = require('../../../src/middlewares/validation');
const { authenticateJWT, optionalAuth } = require('../../../src/middlewares/auth');

describe('Booking Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/bookings', bookingRoutes);
    jest.clearAllMocks();
  });

  describe('POST /bookings', () => {
    test('should have create booking route with validation', async () => {
      const response = await request(app)
        .post('/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          date: '2024-01-01',
          time: '10:00',
          duration: 30
        });

      expect(response.status).toBe(201);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateCreateBooking).toHaveBeenCalled();
      expect(bookingController.createBooking).toHaveBeenCalled();
    });
  });

  describe('GET /bookings', () => {
    test('should have get bookings route with authentication', async () => {
      const response = await request(app)
        .get('/bookings')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(bookingController.getBookings).toHaveBeenCalled();
    });
  });

  describe('GET /bookings/:id', () => {
    test('should have get booking by id route with validation', async () => {
      const response = await request(app)
        .get('/bookings/123')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateBookingId).toHaveBeenCalled();
      expect(bookingController.getBookingById).toHaveBeenCalled();
    });
  });

  describe('PUT /bookings/:id', () => {
    test('should have update booking route with validation', async () => {
      const response = await request(app)
        .put('/bookings/123')
        .set('Authorization', 'Bearer token')
        .send({ notes: 'Updated notes' });

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateBookingId).toHaveBeenCalled();
      expect(validation.validateUpdateBooking).toHaveBeenCalled();
      expect(bookingController.updateBooking).toHaveBeenCalled();
    });
  });

  describe('DELETE /bookings/:id', () => {
    test('should have delete booking route with validation', async () => {
      const response = await request(app)
        .delete('/bookings/123')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateBookingId).toHaveBeenCalled();
      expect(bookingController.deleteBooking).toHaveBeenCalled();
    });
  });

  describe('POST /bookings/:id/cancel', () => {
    test('should have cancel booking route with validation', async () => {
      const response = await request(app)
        .post('/bookings/123/cancel')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateBookingId).toHaveBeenCalled();
      expect(bookingController.cancelBooking).toHaveBeenCalled();
    });
  });

  describe('POST /bookings/:id/confirm', () => {
    test('should have confirm booking route with validation', async () => {
      const response = await request(app)
        .post('/bookings/123/confirm')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateBookingId).toHaveBeenCalled();
      expect(bookingController.confirmBooking).toHaveBeenCalled();
    });
  });

  describe('POST /bookings/:id/reschedule', () => {
    test('should have reschedule booking route with validation', async () => {
      const response = await request(app)
        .post('/bookings/123/reschedule')
        .set('Authorization', 'Bearer token')
        .send({
          newDate: '2024-01-02',
          newTime: '14:00'
        });

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateBookingId).toHaveBeenCalled();
      expect(validation.validateReschedule).toHaveBeenCalled();
      expect(bookingController.rescheduleBooking).toHaveBeenCalled();
    });
  });

  describe('GET /bookings/public/:userId', () => {
    test('should have public booking page route', async () => {
      const response = await request(app)
        .get('/bookings/public/123');

      expect(response.status).toBe(200);
      expect(bookingController.getPublicBookingPage).toHaveBeenCalled();
    });
  });

  describe('POST /bookings/public/:userId', () => {
    test('should have create public booking route with validation', async () => {
      const response = await request(app)
        .post('/bookings/public/123')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          date: '2024-01-01',
          time: '10:00'
        });

      expect(response.status).toBe(201);
      expect(validation.validatePublicBooking).toHaveBeenCalled();
      expect(bookingController.createPublicBooking).toHaveBeenCalled();
    });
  });

  describe('GET /bookings/analytics', () => {
    test('should have booking analytics route with authentication', async () => {
      const response = await request(app)
        .get('/bookings/analytics')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(bookingController.getBookingAnalytics).toHaveBeenCalled();
    });
  });
});