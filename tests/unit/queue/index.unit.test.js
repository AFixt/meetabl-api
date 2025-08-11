/**
 * Queue system unit tests
 *
 * Tests for BullMQ queue system setup and utilities
 *
 * @author meetabl Team
 */

// Import test setup
require('../test-setup');

// Mock BullMQ before importing
const mockQueue = {
  add: jest.fn(),
  close: jest.fn()
};

const mockWorker = {
  on: jest.fn(),
  close: jest.fn()
};

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => mockQueue),
  Worker: jest.fn(() => mockWorker)
}));

// Mock Redis client
const mockRedisClient = {
  quit: jest.fn(),
  disconnect: jest.fn()
};

jest.mock('../../../src/redis', () => ({
  getClient: jest.fn(() => mockRedisClient),
  closeConnection: jest.fn()
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Import after mocks
const { Queue, Worker } = require('bullmq');
const redis = require('../../../src/redis');
const logger = require('../../../src/config/logger');
const queueSystem = require('../../../src/queue/index');

describe('Queue System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addJob', () => {
    test('should add job to notification queue successfully', async () => {
      // Mock successful job creation
      const mockJob = { id: 'job-123', name: 'sendEmail' };
      mockQueue.add.mockResolvedValueOnce(mockJob);

      // Test data
      const jobData = { 
        type: 'email', 
        recipient: 'test@example.com',
        template: 'welcome'
      };
      const jobOptions = { priority: 1, delay: 5000 };

      // Execute addJob
      const result = await queueSystem.addJob('notification', 'sendEmail', jobData, jobOptions);

      // Verify queue.add was called with correct parameters
      expect(mockQueue.add).toHaveBeenCalledWith('sendEmail', jobData, jobOptions);

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Adding job to notification queue:', {
        jobName: 'sendEmail'
      });

      // Verify result
      expect(result).toBe(mockJob);
    });

    test('should add job to calendarSync queue successfully', async () => {
      // Mock successful job creation
      const mockJob = { id: 'job-456', name: 'syncCalendar' };
      mockQueue.add.mockResolvedValueOnce(mockJob);

      // Test data
      const jobData = { userId: 'user-123', calendarId: 'cal-456' };

      // Execute addJob
      const result = await queueSystem.addJob('calendarSync', 'syncCalendar', jobData);

      // Verify queue.add was called with correct parameters
      expect(mockQueue.add).toHaveBeenCalledWith('syncCalendar', jobData, {});

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Adding job to calendarSync queue:', {
        jobName: 'syncCalendar'
      });

      // Verify result
      expect(result).toBe(mockJob);
    });

    test('should throw error for non-existent queue', async () => {
      // Execute addJob with invalid queue name
      await expect(queueSystem.addJob('nonExistentQueue', 'testJob', {}))
        .rejects.toThrow('Queue nonExistentQueue does not exist');

      // Verify no queue operations were called
      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    test('should handle queue add errors', async () => {
      // Mock queue add error
      const queueError = new Error('Redis connection failed');
      mockQueue.add.mockRejectedValueOnce(queueError);

      // Execute addJob and expect error
      await expect(queueSystem.addJob('notification', 'failedJob', {}))
        .rejects.toThrow('Redis connection failed');

      // Verify queue.add was called
      expect(mockQueue.add).toHaveBeenCalledWith('failedJob', {}, {});

      // Verify logging occurred
      expect(logger.info).toHaveBeenCalledWith('Adding job to notification queue:', {
        jobName: 'failedJob'
      });
    });

    test('should use default empty options when not provided', async () => {
      // Mock successful job creation
      mockQueue.add.mockResolvedValueOnce({ id: 'job-default' });

      // Execute addJob without options
      await queueSystem.addJob('notification', 'defaultJob', { test: 'data' });

      // Verify queue.add was called with empty options
      expect(mockQueue.add).toHaveBeenCalledWith('defaultJob', { test: 'data' }, {});
    });
  });

  describe('createWorker', () => {
    test('should create worker successfully', () => {
      // Mock processor function
      const mockProcessor = jest.fn();

      // Execute createWorker
      const worker = queueSystem.createWorker('notification', mockProcessor);

      // Verify Worker constructor was called
      expect(Worker).toHaveBeenCalledWith('notification', mockProcessor, {
        connection: mockRedisClient
      });

      // Verify event listeners were set up
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));

      // Verify worker was returned
      expect(worker).toBe(mockWorker);
    });

    test('should throw error for non-existent queue', () => {
      // Mock processor function
      const mockProcessor = jest.fn();

      // Execute createWorker with invalid queue name
      expect(() => queueSystem.createWorker('invalidQueue', mockProcessor))
        .toThrow('Queue invalidQueue does not exist');

      // Verify Worker constructor was not called
      expect(Worker).not.toHaveBeenCalled();
    });

    test('should handle worker completed events', () => {
      // Mock processor function
      const mockProcessor = jest.fn();

      // Create worker
      queueSystem.createWorker('notification', mockProcessor);

      // Get the completed event handler
      const completedHandler = mockWorker.on.mock.calls.find(call => call[0] === 'completed')[1];

      // Mock job completion
      const mockJob = { id: 'completed-job-123' };
      completedHandler(mockJob);

      // Verify completion was logged
      expect(logger.info).toHaveBeenCalledWith('Job completed-job-123 completed in queue notification');
    });

    test('should handle worker failed events', () => {
      // Mock processor function
      const mockProcessor = jest.fn();

      // Create worker
      queueSystem.createWorker('notification', mockProcessor);

      // Get the failed event handler
      const failedHandler = mockWorker.on.mock.calls.find(call => call[0] === 'failed')[1];

      // Mock job failure
      const mockJob = { id: 'failed-job-456' };
      const mockError = new Error('Processing failed');
      failedHandler(mockJob, mockError);

      // Verify failure was logged
      expect(logger.error).toHaveBeenCalledWith('Job failed-job-456 failed in queue notification:', mockError);
    });

    test('should create worker for calendarSync queue', () => {
      // Mock processor function
      const mockProcessor = jest.fn();

      // Execute createWorker for calendarSync
      const worker = queueSystem.createWorker('calendarSync', mockProcessor);

      // Verify Worker constructor was called
      expect(Worker).toHaveBeenCalledWith('calendarSync', mockProcessor, {
        connection: mockRedisClient
      });

      // Verify worker was returned
      expect(worker).toBe(mockWorker);
    });
  });

  describe('closeQueues', () => {
    test('should close all queues and redis connection successfully', async () => {
      // Mock successful close operations
      mockQueue.close.mockResolvedValue();
      redis.closeConnection.mockResolvedValue();

      // Execute closeQueues
      await queueSystem.closeQueues();

      // Verify all queues were closed (notification and calendarSync)
      expect(mockQueue.close).toHaveBeenCalledTimes(2);

      // Verify redis connection was closed
      expect(redis.closeConnection).toHaveBeenCalledTimes(1);

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Closing queue connections...');
      expect(logger.info).toHaveBeenCalledWith('All queue connections closed');
    });

    test('should handle queue close errors', async () => {
      // Mock queue close error
      const closeError = new Error('Failed to close queue');
      mockQueue.close.mockRejectedValueOnce(closeError);

      // Mock redis close success
      redis.closeConnection.mockResolvedValue();

      // Execute closeQueues and expect error
      await expect(queueSystem.closeQueues()).rejects.toThrow('Failed to close queue');

      // Verify start logging occurred
      expect(logger.info).toHaveBeenCalledWith('Closing queue connections...');

      // Verify completion logging did not occur
      expect(logger.info).not.toHaveBeenCalledWith('All queue connections closed');
    });

    test('should handle redis close errors', async () => {
      // Mock successful queue closes
      mockQueue.close.mockResolvedValue();

      // Mock redis close error
      const redisError = new Error('Redis connection close failed');
      redis.closeConnection.mockRejectedValueOnce(redisError);

      // Execute closeQueues and expect error
      await expect(queueSystem.closeQueues()).rejects.toThrow('Redis connection close failed');

      // Verify queues were closed
      expect(mockQueue.close).toHaveBeenCalledTimes(2);

      // Verify start logging occurred
      expect(logger.info).toHaveBeenCalledWith('Closing queue connections...');
    });

    test('should handle partial queue close failures', async () => {
      // Mock one successful and one failed queue close
      mockQueue.close
        .mockResolvedValueOnce() // First queue succeeds
        .mockRejectedValueOnce(new Error('Second queue failed')); // Second queue fails

      // Execute closeQueues and expect error
      await expect(queueSystem.closeQueues()).rejects.toThrow('Second queue failed');

      // Verify both queues were attempted
      expect(mockQueue.close).toHaveBeenCalledTimes(2);
    });
  });

  describe('queues object', () => {
    test('should have notification queue configured', () => {
      // Verify notification queue exists
      expect(queueSystem.queues).toHaveProperty('notification');
      expect(queueSystem.queues.notification).toBe(mockQueue);
    });

    test('should have calendarSync queue configured', () => {
      // Verify calendarSync queue exists
      expect(queueSystem.queues).toHaveProperty('calendarSync');
      expect(queueSystem.queues.calendarSync).toBe(mockQueue);
    });

    test('should have exactly two queues configured', () => {
      // Verify only expected queues exist
      const queueNames = Object.keys(queueSystem.queues);
      expect(queueNames).toHaveLength(2);
      expect(queueNames).toContain('notification');
      expect(queueNames).toContain('calendarSync');
    });
  });
});