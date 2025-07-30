/**
 * Booking Model Isolated Tests
 * 
 * Tests for the Booking model structure without database connection
 * 
 * @author meetabl Team
 */

describe('Booking Model Isolated', () => {
  let Booking;

  beforeAll(() => {
    // Import the model (this will use the mocked sequelize from config)
    Booking = require('../../../src/models/booking.model');
  });

  test('should export a model object', () => {
    expect(Booking).toBeDefined();
    expect(typeof Booking).toBe('object');
  });

  test('should have model properties', () => {
    // Test that basic model properties exist
    expect(Booking).toHaveProperty('name');
    expect(Booking).toHaveProperty('tableName');
  });

  test('should be properly defined by Sequelize', () => {
    // These are properties that Sequelize models should have
    expect(Booking).toHaveProperty('associations');
    expect(Booking).toHaveProperty('options');
  });

  test('should export the booking model', () => {
    expect(Booking).toBeDefined();
  });
});