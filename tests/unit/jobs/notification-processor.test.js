/**
 * Notification processor job tests
 * 
 * Tests for the scheduled notification processing job
 * 
 * @author meetabl Team
 */

// Mock the services index
jest.mock('../../../src/services', () => ({
  notificationService: {
    processNotificationQueue: jest.fn()
  }
}));

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const { notificationService } = require('../../../src/services');
const { processNotificationQueue } = notificationService;
const logger = require('../../../src/config/logger');

describe('Notification Processor Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processNotifications', () => {
    test('should process notifications successfully', async () => {
      // Import after mocks are set up
      const { processNotifications } = require('../../../src/jobs/notification-processor');

      // Mock successful processing
      processNotificationQueue.mockResolvedValueOnce();

      // Execute the job
      await processNotifications();

      // Verify the service was called
      expect(processNotificationQueue).toHaveBeenCalledTimes(1);
      
      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Starting notification processing job');
      expect(logger.info).toHaveBeenCalledWith('Notification processing job completed');
    });

    test('should handle processing errors gracefully', async () => {
      const { processNotifications } = require('../../../src/jobs/notification-processor');

      // Mock processing error
      const error = new Error('Service unavailable');
      processNotificationQueue.mockRejectedValueOnce(error);

      // Execute the job
      await processNotifications();

      // Verify error handling
      expect(processNotificationQueue).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Error in notification processing job:', error);
    });
  });

  describe('lambdaHandler', () => {
    test('should handle lambda invocation successfully', async () => {
      const { lambdaHandler } = require('../../../src/jobs/notification-processor');

      // Mock successful processing
      processNotificationQueue.mockResolvedValueOnce();

      // Mock lambda event and context
      const mockEvent = { source: 'aws.events' };
      const mockContext = { awsRequestId: 'test-request-id' };

      // Execute the lambda handler
      const result = await lambdaHandler(mockEvent, mockContext);

      // Verify the service was called
      expect(processNotificationQueue).toHaveBeenCalledTimes(1);
      
      // Verify successful response
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toBe('Notification processing completed successfully');
      
      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Lambda notification processor started', {
        event: mockEvent,
        context: mockContext
      });
    });

    test('should handle lambda errors gracefully', async () => {
      const { lambdaHandler } = require('../../../src/jobs/notification-processor');

      // Mock processing error in the notification service
      const error = new Error('Service unavailable');
      processNotificationQueue.mockRejectedValueOnce(error);

      // Execute the lambda handler
      const result = await lambdaHandler({}, {});

      // The lambda handler will still return 200 because processNotifications catches errors internally
      // But we should verify the error was logged in processNotifications
      expect(result.statusCode).toBe(200);
      expect(logger.error).toHaveBeenCalledWith('Error in notification processing job:', error);
    });
  });
});