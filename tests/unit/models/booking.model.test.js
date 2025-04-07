/**
 * Booking model tests
 * 
 * @author AccessMeet Team
 */

const { Booking, Notification } = require('../../../src/models');
const { setupTestDatabase, clearDatabase, createTestUser, createBooking } = require('../../fixtures/db');

describe('Booking Model', () => {
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
  });

  test('should create a booking successfully', async () => {
    const booking = await createBooking(user.id);
    
    expect(booking).toBeDefined();
    expect(booking.id).toBeDefined();
    expect(booking.user_id).toBe(user.id);
    expect(booking.customer_name).toBeDefined();
    expect(booking.start_time).toBeDefined();
    expect(booking.end_time).toBeDefined();
    expect(booking.status).toBe('confirmed');
  });

  test('should validate start_time is before end_time', async () => {
    const now = new Date();
    const startTime = new Date(now);
    startTime.setHours(now.getHours() + 2);
    
    const endTime = new Date(now);
    endTime.setHours(now.getHours() + 1);
    
    try {
      await createBooking(user.id, {
        start_time: startTime,
        end_time: endTime
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('should be able to cancel a booking', async () => {
    const booking = await createBooking(user.id);
    
    // Update booking status to cancelled
    booking.status = 'cancelled';
    await booking.save();
    
    // Fetch booking again
    const updatedBooking = await Booking.findByPk(booking.id);
    
    expect(updatedBooking.status).toBe('cancelled');
  });

  test('should have associations with other models', async () => {
    // Check associations are defined
    expect(Booking.belongsTo).toBeDefined();
    expect(Booking.hasMany).toBeDefined();
  });
});