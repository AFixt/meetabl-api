/**
 * Analytics controller unit tests
 *
 * Tests for the analytics controller functionality
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup controller mocks
setupControllerMocks();

// Skip tests if json2csv is not installed
let skipTests = false;
try {
  require.resolve('json2csv');
} catch (error) {
  skipTests = true;
}

// Mock json2csv only if it exists
if (!skipTests) {
  jest.mock('json2csv', () => ({
    Parser: jest.fn().mockImplementation(() => ({
      parse: jest.fn().mockReturnValue('id,customer_name,customer_email\n1,John Doe,john@example.com')
    }))
  }));
}

// Import controller after mocks are set up
const {
  getBookingStats,
  getUserAnalytics,
  exportBookings,
  getRevenueAnalytics
} = require('../../../src/controllers/analytics.controller');

// Ensure createMockRequest, createMockResponse are available
if (typeof global.createMockRequest !== 'function'
    || typeof global.createMockResponse !== 'function') {
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
    res.setHeader = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  };
}

describe('Analytics Controller', () => {
  if (skipTests) {
    test.skip('json2csv package not installed - skipping tests', () => {});
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBookingStats', () => {
    test('should get booking statistics successfully', async () => {
      // Mock dependencies
      const { Booking, sequelize } = require('../../../src/models');
      
      // Mock count queries
      Booking.count
        .mockResolvedValueOnce(100) // total bookings
        .mockResolvedValueOnce(85)  // confirmed bookings
        .mockResolvedValueOnce(15); // cancelled bookings

      // Mock average duration query
      Booking.findAll
        .mockResolvedValueOnce([{ avg_duration: 60 }]) // average duration
        .mockResolvedValueOnce([ // bookings over time
          { period: '2024-01', count: '10', confirmed: '8', cancelled: '2' },
          { period: '2024-02', count: '15', confirmed: '12', cancelled: '3' }
        ])
        .mockResolvedValueOnce([ // popular time slots
          { hour: '9', count: '20' },
          { hour: '14', count: '15' }
        ])
        .mockResolvedValueOnce([ // repeat customers
          { customer_email: 'repeat@example.com', booking_count: '5' }
        ]);

      // Create request
      const req = createMockRequest({
        query: { group_by: 'month' }
      });
      const res = createMockResponse();

      // Execute the controller
      await getBookingStats(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        statistics: expect.objectContaining({
          total_bookings: 100,
          confirmed_bookings: 85,
          cancelled_bookings: 15,
          cancellation_rate: '15.00',
          average_duration_minutes: 60,
          repeat_customer_count: 1
        }),
        bookings_over_time: expect.arrayContaining([
          expect.objectContaining({
            period: '2024-01',
            total: 10,
            confirmed: 8,
            cancelled: 2
          })
        ])
      }));
    });

    test('should handle date filters', async () => {
      // Mock dependencies
      const { Booking } = require('../../../src/models');
      
      // Set up default mocks
      Booking.count.mockResolvedValue(0);
      Booking.findAll.mockResolvedValue([]);

      // Create request with date filters
      const req = createMockRequest({
        query: {
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        }
      });
      const res = createMockResponse();

      // Execute the controller
      await getBookingStats(req, res);

      // Verify date filters were applied
      expect(Booking.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            start_time: expect.any(Object)
          })
        })
      );
    });

    test('should handle database errors', async () => {
      // Mock database error
      const { Booking } = require('../../../src/models');
      Booking.count.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = createMockRequest();
      const res = createMockResponse();

      // Execute the controller
      await getBookingStats(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'internal_server_error'
        })
      }));
    });
  });

  describe('getUserAnalytics', () => {
    test('should get user analytics successfully', async () => {
      // Mock dependencies
      const { AuditLog, User, Notification, Booking } = require('../../../src/models');
      
      // Mock user data
      User.findByPk.mockResolvedValueOnce({
        calendar_provider: 'google',
        email_verified: true,
        created: new Date('2023-01-01')
      });

      // Mock audit log queries
      AuditLog.findAll
        .mockResolvedValueOnce([ // login activity
          { date: '2024-01-01', count: '3' }
        ])
        .mockResolvedValueOnce([ // booking activity
          { date: '2024-01-01', count: '2' }
        ])
        .mockResolvedValueOnce([ // actions summary
          { action: 'user.login', count: '10' },
          { action: 'booking.create', count: '5' }
        ]);

      // Mock notification stats
      Notification.findAll.mockResolvedValueOnce([
        { type: 'email', status: 'sent', count: '20' },
        { type: 'email', status: 'failed', count: '2' }
      ]);

      // Create request
      const req = createMockRequest({
        query: { days: 30 }
      });
      const res = createMockResponse();

      // Execute the controller
      await getUserAnalytics(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        account_info: expect.objectContaining({
          calendar_integrated: true,
          calendar_provider: 'google',
          email_verified: true
        }),
        activity: expect.objectContaining({
          login_activity: expect.arrayContaining([
            expect.objectContaining({
              date: '2024-01-01',
              logins: 3
            })
          ])
        }),
        notifications: expect.objectContaining({
          email: expect.objectContaining({
            sent: 20,
            failed: 2
          })
        })
      }));
    });
  });

  describe('exportBookings', () => {
    test('should export bookings as CSV successfully', async () => {
      // Mock dependencies
      const { Booking } = require('../../../src/models');
      const { Parser } = require('json2csv');
      
      // Mock bookings data
      Booking.findAll.mockResolvedValueOnce([
        {
          id: 'booking-1',
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          start_time: new Date('2024-01-01T10:00:00'),
          end_time: new Date('2024-01-01T11:00:00'),
          status: 'confirmed',
          created: new Date('2023-12-20'),
          description: 'Meeting'
        }
      ]);

      // Create request for CSV export
      const req = createMockRequest({
        query: { format: 'csv' }
      });
      const res = createMockResponse();

      // Execute the controller
      await exportBookings(req, res);

      // Verify CSV generation
      expect(Parser).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="bookings.csv"');
      expect(res.send).toHaveBeenCalled();
    });

    test('should export bookings as JSON successfully', async () => {
      // Mock dependencies
      const { Booking } = require('../../../src/models');
      
      // Mock bookings data
      const mockBookings = [{
        id: 'booking-1',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        start_time: new Date('2024-01-01T10:00:00'),
        end_time: new Date('2024-01-01T11:00:00'),
        status: 'confirmed',
        created: new Date('2023-12-20')
      }];

      Booking.findAll.mockResolvedValueOnce(mockBookings);

      // Create request for JSON export
      const req = createMockRequest({
        query: { format: 'json' }
      });
      const res = createMockResponse();

      // Execute the controller
      await exportBookings(req, res);

      // Verify JSON response
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="bookings.json"');
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          id: 'booking-1',
          customer_name: 'John Doe',
          customer_email: 'john@example.com'
        })
      ]));
    });

    test('should apply filters when exporting', async () => {
      // Mock dependencies
      const { Booking } = require('../../../src/models');
      Booking.findAll.mockResolvedValueOnce([]);

      // Create request with filters
      const req = createMockRequest({
        query: {
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          status: 'confirmed'
        }
      });
      const res = createMockResponse();

      // Execute the controller
      await exportBookings(req, res);

      // Verify filters were applied
      expect(Booking.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: 'test-user-id',
            status: 'confirmed'
          })
        })
      );
    });
  });

  describe('getRevenueAnalytics', () => {
    test('should return placeholder revenue data', async () => {
      // Create request
      const req = createMockRequest({
        query: { group_by: 'month' }
      });
      const res = createMockResponse();

      // Execute the controller
      await getRevenueAnalytics(req, res);

      // Verify placeholder response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        revenue: expect.objectContaining({
          total_revenue: 0,
          total_paid_bookings: 0,
          average_booking_value: 0,
          currency: 'USD'
        }),
        note: 'Payment integration not yet implemented'
      }));
    });
  });
});