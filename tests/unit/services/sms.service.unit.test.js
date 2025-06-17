/**
 * SMS service unit tests
 *
 * Tests for SMS sending functionality
 *
 * @author meetabl Team
 */

// Import test setup
require('../test-setup');

// Mock Twilio completely
const mockTwilioClient = {
  messages: {
    create: jest.fn()
  }
};

const mockTwilioConstructor = jest.fn(() => mockTwilioClient);

jest.mock('twilio', () => mockTwilioConstructor);

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const logger = require('../../../src/config/logger');

describe('SMS Service', () => {
  const originalEnv = process.env;
  let smsService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset process.env for each test
    process.env = {
      ...originalEnv,
      TWILIO_ACCOUNT_SID: 'test-account-sid',
      TWILIO_AUTH_TOKEN: 'test-auth-token',
      TWILIO_PHONE_NUMBER: '+1234567890'
    };

    // Clear require cache and re-require the service for each test
    delete require.cache[require.resolve('../../../src/services/sms.service')];
    smsService = require('../../../src/services/sms.service');
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('sendSMS', () => {
    test('should send SMS successfully', async () => {
      // Mock Twilio response
      const mockResult = {
        sid: 'SM1234567890abcdef1234567890abcdef',
        accountSid: 'test-account-sid',
        from: '+1234567890',
        to: '+0987654321',
        body: 'Test message',
        status: 'queued'
      };
      mockTwilioClient.messages.create.mockResolvedValueOnce(mockResult);

      // Execute service
      const result = await smsService.sendSMS('+0987654321', 'Test message');

      // Verify Twilio constructor was called with credentials
      expect(mockTwilioConstructor).toHaveBeenCalledWith('test-account-sid', 'test-auth-token');

      // Verify Twilio client call
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: 'Test message',
        from: '+1234567890',
        to: '+0987654321'
      });

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Sending SMS to +0987654321');
      expect(logger.info).toHaveBeenCalledWith('SMS sent successfully, SID: SM1234567890abcdef1234567890abcdef');

      // Verify result
      expect(result).toEqual(mockResult);
    });

    test('should handle Twilio API errors', async () => {
      // Mock Twilio error
      const twilioError = new Error('Twilio API error');
      twilioError.code = 21211; // Invalid phone number
      mockTwilioClient.messages.create.mockRejectedValueOnce(twilioError);

      // Execute service and expect error
      await expect(smsService.sendSMS('+invalid', 'Test message'))
        .rejects.toThrow('Twilio API error');

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error sending SMS:', twilioError);

      // Verify Twilio call was attempted
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: 'Test message',
        from: '+1234567890',
        to: '+invalid'
      });
    });

    test('should handle network errors', async () => {
      // Mock network error
      const networkError = new Error('Network timeout');
      mockTwilioClient.messages.create.mockRejectedValueOnce(networkError);

      // Execute service and expect error
      await expect(smsService.sendSMS('+0987654321', 'Test message'))
        .rejects.toThrow('Network timeout');

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error sending SMS:', networkError);
    });

    test('should handle special characters in message', async () => {
      // Mock Twilio response
      const mockResult = {
        sid: 'SM1234567890abcdef1234567890abcdef',
        body: 'Hello 👋 Test message with émojis and spëcial chars!',
        status: 'queued'
      };
      mockTwilioClient.messages.create.mockResolvedValueOnce(mockResult);

      const specialMessage = 'Hello 👋 Test message with émojis and spëcial chars!';

      // Execute service
      const result = await smsService.sendSMS('+0987654321', specialMessage);

      // Verify Twilio client call
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: specialMessage,
        from: '+1234567890',
        to: '+0987654321'
      });

      // Verify result
      expect(result).toEqual(mockResult);
    });

    test('should handle international phone numbers', async () => {
      // Mock Twilio response
      const mockResult = {
        sid: 'SM1234567890abcdef1234567890abcdef',
        from: '+1234567890',
        to: '+447700900123', // UK number
        status: 'queued'
      };
      mockTwilioClient.messages.create.mockResolvedValueOnce(mockResult);

      // Execute service with international number
      const result = await smsService.sendSMS('+447700900123', 'International test');

      // Verify Twilio client call
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: 'International test',
        from: '+1234567890',
        to: '+447700900123'
      });

      // Verify result
      expect(result).toEqual(mockResult);
    });

    test('should handle empty message body', async () => {
      // Mock Twilio response
      const mockResult = {
        sid: 'SM1234567890abcdef1234567890abcdef',
        body: '',
        status: 'queued'
      };
      mockTwilioClient.messages.create.mockResolvedValueOnce(mockResult);

      // Execute service with empty message
      const result = await smsService.sendSMS('+0987654321', '');

      // Verify Twilio client call
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: '',
        from: '+1234567890',
        to: '+0987654321'
      });

      // Verify result
      expect(result).toEqual(mockResult);
    });

    test('should send multiple SMS messages', async () => {
      // Mock successful responses
      const mockResult1 = { sid: 'SM1111111111111111111111111111111111' };
      const mockResult2 = { sid: 'SM2222222222222222222222222222222222' };
      
      mockTwilioClient.messages.create
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      // Execute service twice
      const result1 = await smsService.sendSMS('+0987654321', 'First message');
      const result2 = await smsService.sendSMS('+0987654322', 'Second message');

      // Verify both calls were made
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2);
      expect(mockTwilioClient.messages.create).toHaveBeenNthCalledWith(1, {
        body: 'First message',
        from: '+1234567890',
        to: '+0987654321'
      });
      expect(mockTwilioClient.messages.create).toHaveBeenNthCalledWith(2, {
        body: 'Second message',
        from: '+1234567890',
        to: '+0987654322'
      });

      // Verify results
      expect(result1).toEqual(mockResult1);
      expect(result2).toEqual(mockResult2);
    });
  });
});