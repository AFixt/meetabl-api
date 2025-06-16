/**
 * Availability controller unit tests
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
  getAvailabilityRules,
  createAvailabilityRule,
  getAvailabilityRule,
  updateAvailabilityRule,
  deleteAvailabilityRule,
  getAvailableTimeSlots
} = require('../../../src/controllers/availability.controller');

describe('Availability Controller', () => {
  // Shared test data
  const userId = 'test-user-id';
  const ruleId = 'test-rule-id';
  
  describe('getAvailabilityRules', () => {
    test('should get all rules for a user successfully', async () => {
      // Mock data
      const mockRules = [
        { id: 'rule-1', day_of_week: 1, start_time: '09:00:00', end_time: '17:00:00' },
        { id: 'rule-2', day_of_week: 2, start_time: '10:00:00', end_time: '18:00:00' }
      ];
      
      // Create mock request and response
      const req = createMockRequest({ user: { id: userId } });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findAll
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findAll.mockResolvedValueOnce(mockRules);
      
      // Call controller
      await getAvailabilityRules(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ rules: mockRules });
      expect(res.set).toHaveBeenCalled();
      
      // Check query
      expect(AvailabilityRule.findAll).toHaveBeenCalledWith({
        where: { user_id: userId }
      });
    });
    
    test('should handle database errors', async () => {
      // Create mock request and response
      const req = createMockRequest({ user: { id: userId } });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findAll to throw an error
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findAll.mockRejectedValueOnce(new Error('Database error'));
      
      // Call controller
      await getAvailabilityRules(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
      
      // Check error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('internal_server_error');
    });
  });
  
  describe('createAvailabilityRule', () => {
    test('should create a rule successfully', async () => {
      // Mock data for request
      const ruleData = {
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '17:00:00',
        buffer_minutes: 15,
        max_bookings_per_day: 10
      };
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        body: ruleData
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.create
      const mockCreatedRule = {
        id: ruleId,
        user_id: userId,
        ...ruleData
      };
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.create.mockResolvedValueOnce(mockCreatedRule);
      
      // Call controller
      await createAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ rule: mockCreatedRule });
    });
    
    test('should validate time range', async () => {
      // Invalid data where start_time is after end_time
      const invalidRuleData = {
        day_of_week: 1,
        start_time: '17:00:00',
        end_time: '09:00:00',
        buffer_minutes: 15,
        max_bookings_per_day: 10
      };
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        body: invalidRuleData
      });
      const res = createMockResponse();
      
      // Call controller
      await createAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      // Check error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
      expect(responseData.error.message).toContain('End time must be after start time');
    });
    
    test('should handle database errors', async () => {
      // Valid rule data
      const ruleData = {
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '17:00:00',
        buffer_minutes: 15,
        max_bookings_per_day: 10
      };
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        body: ruleData
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.create to throw an error
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.create.mockRejectedValueOnce(new Error('Database error'));
      
      // Call controller
      await createAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
      
      // Check error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('internal_server_error');
    });
  });
  
  describe('getAvailabilityRule', () => {
    test('should get a rule by ID successfully', async () => {
      // Mock rule data
      const mockRule = {
        id: ruleId,
        user_id: userId,
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '17:00:00'
      };
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        params: { id: ruleId }
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findOne
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findOne.mockResolvedValueOnce(mockRule);
      
      // Call controller
      await getAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ rule: mockRule });
      
      // Check query
      expect(AvailabilityRule.findOne).toHaveBeenCalledWith({
        where: { id: ruleId, user_id: userId }
      });
    });
    
    test('should return 404 for non-existent rule', async () => {
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findOne to return null
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findOne.mockResolvedValueOnce(null);
      
      // Call controller
      await getAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
      
      // Check error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('not_found');
    });
  });
  
  describe('updateAvailabilityRule', () => {
    test('should update a rule successfully', async () => {
      // Mock existing rule
      const mockRule = {
        id: ruleId,
        user_id: userId,
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '17:00:00',
        buffer_minutes: 15,
        max_bookings_per_day: 10,
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Update data
      const updateData = {
        day_of_week: 2,
        start_time: '10:00:00',
        end_time: '18:00:00'
      };
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        params: { id: ruleId },
        body: updateData
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findOne
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findOne.mockResolvedValueOnce(mockRule);
      
      // Call controller
      await updateAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Verify rule was updated
      expect(mockRule.day_of_week).toBe(updateData.day_of_week);
      expect(mockRule.start_time).toBe(updateData.start_time);
      expect(mockRule.end_time).toBe(updateData.end_time);
      expect(mockRule.save).toHaveBeenCalled();
    });
    
    test('should return 404 for non-existent rule', async () => {
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        params: { id: 'non-existent-id' },
        body: { day_of_week: 2 }
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findOne to return null
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findOne.mockResolvedValueOnce(null);
      
      // Call controller
      await updateAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
      
      // Check error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('not_found');
    });
    
    test('should validate time range', async () => {
      // Mock existing rule
      const mockRule = {
        id: ruleId,
        user_id: userId,
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '17:00:00',
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Invalid update data
      const invalidUpdateData = {
        start_time: '18:00:00',
        end_time: '10:00:00'
      };
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        params: { id: ruleId },
        body: invalidUpdateData
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findOne
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findOne.mockResolvedValueOnce(mockRule);
      
      // Call controller
      await updateAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      // Check error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
      expect(responseData.error.message).toContain('End time must be after start time');
    });
  });
  
  describe('deleteAvailabilityRule', () => {
    test('should delete a rule successfully', async () => {
      // Mock existing rule
      const mockRule = {
        id: ruleId,
        user_id: userId,
        destroy: jest.fn().mockResolvedValue(true)
      };
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        params: { id: ruleId }
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findOne
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findOne.mockResolvedValueOnce(mockRule);
      
      // Call controller
      await deleteAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(204);
      
      // Verify rule was deleted
      expect(mockRule.destroy).toHaveBeenCalled();
    });
    
    test('should return 404 for non-existent rule', async () => {
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findOne to return null
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findOne.mockResolvedValueOnce(null);
      
      // Call controller
      await deleteAvailabilityRule(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
      
      // Check error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('not_found');
    });
  });
  
  describe('getAvailableTimeSlots', () => {
    test('should get available time slots successfully', async () => {
      // Create valid date and user
      const targetDate = '2023-12-01';
      const duration = '60';
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        query: { date: targetDate, duration }
      });
      const res = createMockResponse();
      
      // Mock AvailabilityRule.findAll
      const mockRules = [
        {
          id: 'rule-1',
          day_of_week: 5, // Assuming targetDate is a Friday (day 5)
          start_time: '09:00:00',
          end_time: '17:00:00',
          buffer_minutes: 15,
          max_bookings_per_day: 10
        }
      ];
      const { AvailabilityRule } = require('../../../src/models');
      AvailabilityRule.findAll.mockResolvedValueOnce(mockRules);
      
      // Mock Booking.findAll (no existing bookings)
      const { Booking } = require('../../../src/models');
      Booking.findAll.mockResolvedValueOnce([]);
      
      // Call controller
      await getAvailableTimeSlots(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Response should contain available slots
      const responseData = res.json.mock.calls[0][0];
      expect(Array.isArray(responseData)).toBe(true);
    });
    
    test('should validate date parameter', async () => {
      // Create invalid date
      const invalidDate = 'not-a-date';
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        query: { date: invalidDate }
      });
      const res = createMockResponse();
      
      // Call controller
      await getAvailableTimeSlots(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      // Check error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
    });
    
    test('should validate duration parameter', async () => {
      // Create valid date but invalid duration
      const targetDate = '2023-12-01';
      const invalidDuration = '500'; // Too long
      
      // Create mock request and response
      const req = createMockRequest({
        user: { id: userId },
        query: { date: targetDate, duration: invalidDuration }
      });
      const res = createMockResponse();
      
      // Call controller
      await getAvailableTimeSlots(req, res);
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      // Check error structure
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('bad_request');
      expect(responseData.error.message).toContain('Duration must be between 15 and 240 minutes');
    });
  });
});