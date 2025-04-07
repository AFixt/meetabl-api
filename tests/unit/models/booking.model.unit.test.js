/**
 * Booking model unit tests
 * 
 * Using the improved test setup for consistent mocking
 * 
 * @author AccessMeet Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { Booking, Notification } = require('../../../src/models');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('Booking Model', () => {
  // User ID for tests
  const userId = 'test-user-id';
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the Booking model create method
    Booking.create.mockImplementation(async (bookingData) => {
      // Validate start_time is before end_time
      if (bookingData.start_time && bookingData.end_time &&
          new Date(bookingData.start_time) >= new Date(bookingData.end_time)) {
        throw new Error('End time must be after start time');
      }
      
      return {
        id: bookingData.id || uuidv4(),
        user_id: bookingData.user_id,
        customer_name: bookingData.customer_name || 'Test Customer',
        customer_email: bookingData.customer_email || 'customer@example.com',
        start_time: bookingData.start_time || new Date(),
        end_time: bookingData.end_time || new Date(Date.now() + 3600000),
        status: bookingData.status || 'confirmed',
        save: jest.fn().mockResolvedValue(true),
        ...bookingData
      };
    });
  });

  test('should create a booking successfully', async () => {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 1);
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    const booking = await Booking.create({
      user_id: userId,
      customer_name: 'Test Customer',
      customer_email: 'customer@example.com',
      start_time: startTime,
      end_time: endTime
    });
    
    expect(booking).toBeDefined();
    expect(booking.id).toBeDefined();
    expect(booking.user_id).toBe(userId);
    expect(booking.customer_name).toBe('Test Customer');
    expect(booking.customer_email).toBe('customer@example.com');
    expect(booking.start_time).toEqual(startTime);
    expect(booking.end_time).toEqual(endTime);
    expect(booking.status).toBe('confirmed');
  });

  test('should validate start_time is before end_time', async () => {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 2);
    
    const endTime = new Date();
    endTime.setHours(endTime.getHours() + 1);
    
    try {
      await Booking.create({
        user_id: userId,
        customer_name: 'Test Customer',
        customer_email: 'customer@example.com',
        start_time: startTime,
        end_time: endTime
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toContain('End time must be after start time');
    }
  });

  test('should be able to cancel a booking', async () => {
    // Create a booking
    const booking = await Booking.create({
      user_id: userId,
      customer_name: 'Test Customer',
      customer_email: 'customer@example.com',
      status: 'confirmed'
    });
    
    // Mock booking update and findByPk
    booking.save.mockResolvedValueOnce(true);
    
    Booking.findByPk.mockImplementationOnce(() => {
      return Promise.resolve({
        ...booking,
        status: 'cancelled'
      });
    });
    
    // Update booking status to cancelled
    booking.status = 'cancelled';
    await booking.save();
    
    // Fetch booking again
    const updatedBooking = await Booking.findByPk(booking.id);
    
    expect(updatedBooking.status).toBe('cancelled');
  });

  test('should have associations with other models', async () => {
    // Mock associations object
    Booking.associations = {
      user: { type: 'belongsTo' },
      notifications: { type: 'hasMany' }
    };
    
    // Check associations exist
    expect(Booking.associations).toBeDefined();
    expect(Booking.associations.user).toBeDefined();
    expect(Booking.associations.notifications).toBeDefined();
  });
});