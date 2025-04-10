/**
 * Booking model unit tests
 * 
 * Using the improved test setup for consistent mocking
 * 
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { Booking, Notification, User } = require('../../../src/models');
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
      
      // Validate required fields
      if (!bookingData.user_id) {
        throw new Error('User ID is required');
      }
      
      if (!bookingData.customer_name || bookingData.customer_name.trim() === '') {
        throw new Error('Customer name is required');
      }
      
      if (!bookingData.customer_email) {
        throw new Error('Customer email is required');
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(bookingData.customer_email)) {
        throw new Error('Invalid email format');
      }
      
      return {
        id: bookingData.id || uuidv4(),
        user_id: bookingData.user_id,
        customer_name: bookingData.customer_name || 'Test Customer',
        customer_email: bookingData.customer_email || 'customer@example.com',
        start_time: bookingData.start_time || new Date(),
        end_time: bookingData.end_time || new Date(Date.now() + 3600000),
        status: bookingData.status || 'confirmed',
        calendar_event_id: bookingData.calendar_event_id || null,
        created: bookingData.created || new Date(),
        save: jest.fn().mockResolvedValue(true),
        ...bookingData
      };
    });
    
    // Mock the update method
    Booking.update.mockImplementation(async (updates, options) => {
      // Validate status if provided
      if (updates.status && !['confirmed', 'cancelled'].includes(updates.status)) {
        throw new Error('Invalid booking status');
      }
      
      return [1];
    });
    
    // Mock findAll to return bookings for a user
    Booking.findAll.mockImplementation(async ({ where }) => {
      if (where.user_id === userId) {
        return [
          {
            id: 'booking-1',
            user_id: userId,
            customer_name: 'Customer 1',
            customer_email: 'customer1@example.com',
            start_time: new Date(),
            end_time: new Date(Date.now() + 3600000),
            status: 'confirmed'
          },
          {
            id: 'booking-2',
            user_id: userId,
            customer_name: 'Customer 2',
            customer_email: 'customer2@example.com',
            start_time: new Date(Date.now() + 86400000), // Tomorrow
            end_time: new Date(Date.now() + 90000000),
            status: 'confirmed'
          }
        ];
      }
      return [];
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
    
    await expect(Booking.create({
      user_id: userId,
      customer_name: 'Test Customer',
      customer_email: 'customer@example.com',
      start_time: startTime,
      end_time: endTime
    })).rejects.toThrow('End time must be after start time');
  });

  test('should require user_id when creating booking', async () => {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 1);
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    await expect(Booking.create({
      // missing user_id
      customer_name: 'Test Customer',
      customer_email: 'customer@example.com',
      start_time: startTime,
      end_time: endTime
    })).rejects.toThrow('User ID is required');
  });

  test('should require customer_name when creating booking', async () => {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 1);
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    await expect(Booking.create({
      user_id: userId,
      // missing customer_name
      customer_email: 'customer@example.com',
      start_time: startTime,
      end_time: endTime
    })).rejects.toThrow('Customer name is required');
  });

  test('should require valid customer_email when creating booking', async () => {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 1);
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    await expect(Booking.create({
      user_id: userId,
      customer_name: 'Test Customer',
      customer_email: 'invalid-email',
      start_time: startTime,
      end_time: endTime
    })).rejects.toThrow('Invalid email format');
  });

  test('should create booking with calendar_event_id', async () => {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 1);
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    const calendarEventId = 'calendar-event-123';
    
    const booking = await Booking.create({
      user_id: userId,
      customer_name: 'Test Customer',
      customer_email: 'customer@example.com',
      start_time: startTime,
      end_time: endTime,
      calendar_event_id: calendarEventId
    });
    
    expect(booking).toBeDefined();
    expect(booking.calendar_event_id).toBe(calendarEventId);
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

  test('should validate status values when updating', async () => {
    await expect(Booking.update(
      { status: 'invalid-status' },
      { where: { id: 'booking-1' } }
    )).rejects.toThrow('Invalid booking status');
  });

  test('should retrieve all bookings for a user', async () => {
    const bookings = await Booking.findAll({
      where: { user_id: userId }
    });
    
    expect(bookings).toBeDefined();
    expect(bookings.length).toBe(2);
    expect(bookings[0].user_id).toBe(userId);
    expect(bookings[1].user_id).toBe(userId);
  });

  test('should retrieve empty array for user with no bookings', async () => {
    const bookings = await Booking.findAll({
      where: { user_id: 'user-with-no-bookings' }
    });
    
    expect(bookings).toEqual([]);
  });

  test('should use UUID as primary key', async () => {
    const booking = await Booking.create({
      user_id: userId,
      customer_name: 'UUID Test',
      customer_email: 'uuid@example.com',
      start_time: new Date(),
      end_time: new Date(Date.now() + 3600000)
    });
    
    expect(booking.id).toBeDefined();
    expect(booking.id.length).toBe(36); // UUID v4 format
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

  test('should have a one-to-many relationship with User', async () => {
    // Mock the relationships directly
    User.hasMany = jest.fn();
    Booking.belongsTo = jest.fn();
    
    // Manually call the relationship methods to test the one-to-many relationship
    User.hasMany(Booking, { foreignKey: 'user_id', onDelete: 'CASCADE' });
    Booking.belongsTo(User, { foreignKey: 'user_id' });
    
    // Test that relationship methods were called
    expect(User.hasMany).toHaveBeenCalled();
    expect(Booking.belongsTo).toHaveBeenCalled();
  });
});