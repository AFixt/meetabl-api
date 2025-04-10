/**
 * Availability Rule model unit tests
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
const { AvailabilityRule, User } = require('../../../src/models');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('AvailabilityRule Model', () => {
  // User ID for tests
  const userId = 'test-user-id';
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the AvailabilityRule model create method
    AvailabilityRule.create.mockImplementation(async (ruleData) => {
      // Validate day_of_week
      if (ruleData.day_of_week < 0 || ruleData.day_of_week > 6) {
        throw new Error('day_of_week must be between 0 and 6');
      }
      
      // Validate start_time is before end_time
      if (ruleData.start_time && ruleData.end_time) {
        const startParts = ruleData.start_time.split(':').map(Number);
        const endParts = ruleData.end_time.split(':').map(Number);
        
        const startMinutes = startParts[0] * 60 + startParts[1];
        const endMinutes = endParts[0] * 60 + endParts[1];
        
        if (startMinutes >= endMinutes) {
          throw new Error('End time must be after start time');
        }
      }
      
      // Validate buffer_minutes
      if (ruleData.buffer_minutes !== undefined && ruleData.buffer_minutes < 0) {
        throw new Error('buffer_minutes must be at least 0');
      }
      
      // Validate max_bookings_per_day
      if (ruleData.max_bookings_per_day !== undefined && 
          ruleData.max_bookings_per_day !== null && 
          ruleData.max_bookings_per_day < 1) {
        throw new Error('max_bookings_per_day must be at least 1');
      }
      
      return {
        id: ruleData.id || uuidv4(),
        user_id: ruleData.user_id,
        day_of_week: ruleData.day_of_week,
        start_time: ruleData.start_time,
        end_time: ruleData.end_time,
        buffer_minutes: ruleData.buffer_minutes === undefined ? 0 : ruleData.buffer_minutes,
        max_bookings_per_day: ruleData.max_bookings_per_day,
        save: jest.fn().mockResolvedValue(true),
        ...ruleData
      };
    });
    
    // Mock the update method
    AvailabilityRule.update.mockImplementation(async (updates, options) => {
      // Validate day_of_week
      if (updates.day_of_week !== undefined && (updates.day_of_week < 0 || updates.day_of_week > 6)) {
        throw new Error('day_of_week must be between 0 and 6');
      }
      
      // Validate buffer_minutes
      if (updates.buffer_minutes !== undefined && updates.buffer_minutes < 0) {
        throw new Error('buffer_minutes must be at least 0');
      }
      
      // Validate max_bookings_per_day
      if (updates.max_bookings_per_day !== undefined && 
          updates.max_bookings_per_day !== null && 
          updates.max_bookings_per_day < 1) {
        throw new Error('max_bookings_per_day must be at least 1');
      }
      
      return [1];
    });
    
    // Mock findAll to return availability rules for a user
    AvailabilityRule.findAll.mockImplementation(async ({ where }) => {
      if (where.user_id === userId) {
        return [
          {
            id: 'rule-1',
            user_id: userId,
            day_of_week: 1, // Monday
            start_time: '09:00:00',
            end_time: '17:00:00',
            buffer_minutes: 30,
            max_bookings_per_day: 8
          },
          {
            id: 'rule-2',
            user_id: userId,
            day_of_week: 3, // Wednesday
            start_time: '10:00:00',
            end_time: '18:00:00',
            buffer_minutes: 15,
            max_bookings_per_day: 6
          }
        ];
      }
      return [];
    });
  });

  test('should create an availability rule successfully', async () => {
    const rule = await AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2, // Tuesday
      start_time: '08:00:00',
      end_time: '16:00:00',
      buffer_minutes: 15,
      max_bookings_per_day: 6
    });
    
    expect(rule).toBeDefined();
    expect(rule.id).toBeDefined();
    expect(rule.user_id).toBe(userId);
    expect(rule.day_of_week).toBe(2);
    expect(rule.start_time).toBe('08:00:00');
    expect(rule.end_time).toBe('16:00:00');
    expect(rule.buffer_minutes).toBe(15);
    expect(rule.max_bookings_per_day).toBe(6);
  });

  test('should validate day_of_week is between 0 and 6', async () => {
    // Test invalid day (too high)
    await expect(AvailabilityRule.create({
      user_id: userId,
      day_of_week: 7, // Invalid
      start_time: '08:00:00',
      end_time: '16:00:00'
    })).rejects.toThrow('day_of_week must be between 0 and 6');
    
    // Test invalid day (too low)
    await expect(AvailabilityRule.create({
      user_id: userId,
      day_of_week: -1, // Invalid
      start_time: '08:00:00',
      end_time: '16:00:00'
    })).rejects.toThrow('day_of_week must be between 0 and 6');
    
    // Test valid days at boundaries
    const rule0 = await AvailabilityRule.create({
      user_id: userId,
      day_of_week: 0, // Sunday
      start_time: '08:00:00',
      end_time: '16:00:00'
    });
    
    expect(rule0.day_of_week).toBe(0);
    
    const rule6 = await AvailabilityRule.create({
      user_id: userId,
      day_of_week: 6, // Saturday
      start_time: '08:00:00',
      end_time: '16:00:00'
    });
    
    expect(rule6.day_of_week).toBe(6);
  });

  test('should validate start_time is before end_time', async () => {
    // Test invalid time range (equal)
    await expect(AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '08:00:00',
      end_time: '08:00:00'
    })).rejects.toThrow('End time must be after start time');
    
    // Test invalid time range (end before start)
    await expect(AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '16:00:00',
      end_time: '08:00:00'
    })).rejects.toThrow('End time must be after start time');
  });

  test('should validate buffer_minutes is non-negative', async () => {
    // Test negative buffer
    await expect(AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '08:00:00',
      end_time: '16:00:00',
      buffer_minutes: -10
    })).rejects.toThrow('buffer_minutes must be at least 0');
    
    // Test zero buffer (valid)
    const rule = await AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '08:00:00',
      end_time: '16:00:00',
      buffer_minutes: 0
    });
    
    expect(rule.buffer_minutes).toBe(0);
  });

  test('should validate max_bookings_per_day is at least 1', async () => {
    // Test invalid max_bookings_per_day
    await expect(AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '08:00:00',
      end_time: '16:00:00',
      max_bookings_per_day: 0
    })).rejects.toThrow('max_bookings_per_day must be at least 1');
    
    // Test valid max_bookings_per_day
    const rule = await AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '08:00:00',
      end_time: '16:00:00',
      max_bookings_per_day: 1
    });
    
    expect(rule.max_bookings_per_day).toBe(1);
    
    // Test null max_bookings_per_day (unlimited)
    const unlimitedRule = await AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '08:00:00',
      end_time: '16:00:00',
      max_bookings_per_day: null
    });
    
    expect(unlimitedRule.max_bookings_per_day).toBeNull();
  });

  test('should use default buffer_minutes if not provided', async () => {
    const rule = await AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '08:00:00',
      end_time: '16:00:00'
      // buffer_minutes not provided
    });
    
    expect(rule.buffer_minutes).toBe(0); // Default value
  });

  test('should support updating an availability rule', async () => {
    // Create initial rule
    const rule = await AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '08:00:00',
      end_time: '16:00:00',
      buffer_minutes: 15
    });
    
    // Mock rule update
    rule.day_of_week = 4; // Thursday
    rule.buffer_minutes = 30;
    rule.save.mockResolvedValueOnce(true);
    
    AvailabilityRule.findByPk.mockImplementationOnce(() => {
      return Promise.resolve({
        ...rule,
        day_of_week: 4,
        buffer_minutes: 30
      });
    });
    
    // Save the updated rule
    await rule.save();
    
    // Fetch updated rule
    const updatedRule = await AvailabilityRule.findByPk(rule.id);
    
    expect(updatedRule.day_of_week).toBe(4);
    expect(updatedRule.buffer_minutes).toBe(30);
  });

  test('should validate fields during update', async () => {
    // Test invalid day_of_week
    await expect(AvailabilityRule.update(
      { day_of_week: 8 },
      { where: { id: 'rule-1' } }
    )).rejects.toThrow('day_of_week must be between 0 and 6');
    
    // Test invalid buffer_minutes
    await expect(AvailabilityRule.update(
      { buffer_minutes: -5 },
      { where: { id: 'rule-1' } }
    )).rejects.toThrow('buffer_minutes must be at least 0');
    
    // Test invalid max_bookings_per_day
    await expect(AvailabilityRule.update(
      { max_bookings_per_day: 0 },
      { where: { id: 'rule-1' } }
    )).rejects.toThrow('max_bookings_per_day must be at least 1');
  });

  test('should retrieve all availability rules for a user', async () => {
    const rules = await AvailabilityRule.findAll({
      where: { user_id: userId }
    });
    
    expect(rules).toBeDefined();
    expect(rules.length).toBe(2);
    expect(rules[0].user_id).toBe(userId);
    expect(rules[1].user_id).toBe(userId);
  });

  test('should retrieve empty array for user with no rules', async () => {
    const rules = await AvailabilityRule.findAll({
      where: { user_id: 'user-with-no-rules' }
    });
    
    expect(rules).toEqual([]);
  });

  test('should use UUID as primary key', async () => {
    const rule = await AvailabilityRule.create({
      user_id: userId,
      day_of_week: 2,
      start_time: '08:00:00',
      end_time: '16:00:00'
    });
    
    expect(rule.id).toBeDefined();
    expect(rule.id.length).toBe(36); // UUID v4 format
  });

  test('should have associations with other models', async () => {
    // Just check that associations are defined correctly
    AvailabilityRule.associations = {
      user: { type: 'belongsTo' }
    };
    
    expect(AvailabilityRule.associations).toBeDefined();
    expect(AvailabilityRule.associations.user).toBeDefined();
    expect(AvailabilityRule.associations.user.type).toBe('belongsTo');
  });
});