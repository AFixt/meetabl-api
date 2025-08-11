/**
 * Notification processor job unit tests
 *
 * Tests for background notification processing job
 *
 * @author meetabl Team
 */

// Import test setup
require('../test-setup');

// Mock dependencies
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../src/services', () => ({
  notificationService: {
    processNotificationQueue: jest.fn()
  }
}));

// Import after mocks
const notificationProcessor = require('../../../src/jobs/notification-processor');
const logger = require('../../../src/config/logger');
const { notificationService } = require('../../../src/services');

describe('Notification Processor Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processNotifications', () => {
    test('should process notifications successfully', async () => {
      // Mock successful service call
      notificationService.processNotificationQueue.mockResolvedValueOnce();

      // Execute function
      await notificationProcessor.processNotifications();

      // Verify service was called
      expect(notificationService.processNotificationQueue).toHaveBeenCalledTimes(1);

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Starting notification processing job');
      expect(logger.info).toHaveBeenCalledWith('Notification processing job completed');

      // Verify no errors logged
      expect(logger.error).not.toHaveBeenCalled();
    });

    test('should handle service errors gracefully', async () => {
      // Mock service error
      const serviceError = new Error('Service processing failed');
      notificationService.processNotificationQueue.mockRejectedValueOnce(serviceError);

      // Execute function - should not throw
      await notificationProcessor.processNotifications();

      // Verify service was called
      expect(notificationService.processNotificationQueue).toHaveBeenCalledTimes(1);

      // Verify start logging
      expect(logger.info).toHaveBeenCalledWith('Starting notification processing job');

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error in notification processing job:', serviceError);

      // Verify completion log was not called
      expect(logger.info).not.toHaveBeenCalledWith('Notification processing job completed');
    });

    test('should handle unexpected errors', async () => {
      // Mock unexpected error
      const unexpectedError = new Error('Unexpected system error');
      notificationService.processNotificationQueue.mockImplementation(() => {
        throw unexpectedError;
      });

      // Execute function - should not throw
      await notificationProcessor.processNotifications();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error in notification processing job:', unexpectedError);
    });
  });

  describe('lambdaHandler', () => {
    test('should handle Lambda invocation successfully', async () => {
      // Mock successful service call
      notificationService.processNotificationQueue.mockResolvedValueOnce();

      // Mock Lambda event and context
      const mockEvent = { source: 'aws.events' };
      const mockContext = { awsRequestId: 'test-request-id' };

      // Execute Lambda handler
      const result = await notificationProcessor.lambdaHandler(mockEvent, mockContext);

      // Verify service was called
      expect(notificationService.processNotificationQueue).toHaveBeenCalledTimes(1);

      // Verify Lambda logging
      expect(logger.info).toHaveBeenCalledWith('Lambda notification processor started', { 
        event: mockEvent, 
        context: mockContext 
      });

      // Verify processing logging
      expect(logger.info).toHaveBeenCalledWith('Starting notification processing job');
      expect(logger.info).toHaveBeenCalledWith('Notification processing job completed');

      // Verify successful response
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({
          message: 'Notification processing completed successfully'
        })
      });
    });

    test('should handle Lambda invocation errors', async () => {
      // Mock service error
      const serviceError = new Error('Processing failed');
      notificationService.processNotificationQueue.mockRejectedValueOnce(serviceError);

      // Mock Lambda event and context
      const mockEvent = { source: 'aws.events' };
      const mockContext = { awsRequestId: 'test-request-id' };

      // Execute Lambda handler
      const result = await notificationProcessor.lambdaHandler(mockEvent, mockContext);

      // Verify service was called
      expect(notificationService.processNotificationQueue).toHaveBeenCalledTimes(1);

      // Verify error was logged by processNotifications (which catches errors internally)
      expect(logger.error).toHaveBeenCalledWith('Error in notification processing job:', serviceError);

      // Since processNotifications catches all errors, Lambda handler returns success
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({
          message: 'Notification processing completed successfully'
        })
      });
    });

    test('should handle empty event and context', async () => {
      // Mock successful service call
      notificationService.processNotificationQueue.mockResolvedValueOnce();

      // Execute Lambda handler with minimal params
      const result = await notificationProcessor.lambdaHandler({}, {});

      // Verify service was called
      expect(notificationService.processNotificationQueue).toHaveBeenCalledTimes(1);

      // Verify successful response
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toBe('Notification processing completed successfully');
    });

    test('should handle errors logged by processNotifications', async () => {
      // Mock synchronous error - this will be caught by processNotifications and not propagate to Lambda handler
      notificationService.processNotificationQueue.mockImplementation(() => {
        throw new Error('Service error');
      });

      // Execute Lambda handler - processNotifications catches the error, so Lambda handler succeeds
      const result = await notificationProcessor.lambdaHandler({}, {});

      // Verify the error was logged by processNotifications
      expect(logger.error).toHaveBeenCalledWith('Error in notification processing job:', expect.any(Error));
      
      // Since processNotifications catches all errors, Lambda handler returns success
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toBe('Notification processing completed successfully');
    });

  });
});