/**
 * Environment Configuration Validation Tests
 * Tests for environment variable validation at application startup
 */

describe('Environment Configuration Validation Tests', () => {
  let originalEnv;
  let originalExit;
  let originalConsoleError;
  let mockLogger;

  beforeEach(() => {
    // Save original values
    originalEnv = { ...process.env };
    originalExit = process.exit;
    originalConsoleError = console.error;
    
    // Mock process.exit to prevent test runner from exiting
    process.exit = jest.fn();
    console.error = jest.fn();
    
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    
    // Clear module cache to ensure fresh imports
    jest.resetModules();
    
    // Mock logger module
    jest.doMock('../../../src/config/logger', () => mockLogger);
  });

  afterEach(() => {
    // Restore original values
    process.env = originalEnv;
    process.exit = originalExit;
    console.error = originalConsoleError;
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Required Environment Variables', () => {
    it('should pass validation with all required variables set', () => {
      process.env.JWT_SECRET = 'ThisIsAVerySecureJWTSecretKey123456';
      process.env.SESSION_SECRET = 'ThisIsAVerySecureSessionSecret123456';
      process.env.NODE_ENV = 'test';
      
      // Import the validateEnvironment function
      const appPath = '../../../src/app';
      require(appPath);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should fail when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;
      process.env.SESSION_SECRET = 'ThisIsAVerySecureSessionSecret123456';
      process.env.NODE_ENV = 'test';
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing required environment variables: JWT_SECRET')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when SESSION_SECRET is missing', () => {
      process.env.JWT_SECRET = 'ThisIsAVerySecureJWTSecretKey123456';
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'test';
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing required environment variables: SESSION_SECRET')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when NODE_ENV is missing', () => {
      process.env.JWT_SECRET = 'ThisIsAVerySecureJWTSecretKey123456';
      process.env.SESSION_SECRET = 'ThisIsAVerySecureSessionSecret123456';
      delete process.env.NODE_ENV;
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing required environment variables: NODE_ENV')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when multiple required variables are missing', () => {
      delete process.env.JWT_SECRET;
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'test';
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('SESSION_SECRET')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('JWT_SECRET Validation', () => {
    beforeEach(() => {
      process.env.SESSION_SECRET = 'ThisIsAVerySecureSessionSecret123456';
      process.env.NODE_ENV = 'test';
    });

    it('should fail when JWT_SECRET is too short', () => {
      process.env.JWT_SECRET = 'TooShort123';
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET must be at least 32 characters long')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when JWT_SECRET lacks uppercase characters', () => {
      process.env.JWT_SECRET = 'thisisaverysecurejwtsecretkey123456';
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET should contain uppercase, lowercase, and numeric characters')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when JWT_SECRET lacks lowercase characters', () => {
      process.env.JWT_SECRET = 'THISISAVERYSECUREJWTSECRETKEY123456';
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET should contain uppercase, lowercase, and numeric characters')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail when JWT_SECRET lacks numeric characters', () => {
      process.env.JWT_SECRET = 'ThisIsAVerySecureJWTSecretKeyWithoutNumbers';
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET should contain uppercase, lowercase, and numeric characters')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should pass with a properly formatted JWT_SECRET', () => {
      process.env.JWT_SECRET = 'ThisIsAVerySecureJWTSecretKey123456';
      
      require('../../../src/app');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('SESSION_SECRET Validation', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'ThisIsAVerySecureJWTSecretKey123456';
      process.env.NODE_ENV = 'test';
    });

    it('should fail when SESSION_SECRET is too short', () => {
      process.env.SESSION_SECRET = 'TooShort123';
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('SESSION_SECRET must be at least 32 characters long')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should pass with a properly formatted SESSION_SECRET', () => {
      process.env.SESSION_SECRET = 'ThisIsAVerySecureSessionSecret123456';
      
      require('../../../src/app');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('Environment-specific Configuration', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'ThisIsAVerySecureJWTSecretKey123456';
      process.env.SESSION_SECRET = 'ThisIsAVerySecureSessionSecret123456';
    });

    it('should accept development environment', () => {
      process.env.NODE_ENV = 'development';
      
      require('../../../src/app');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should accept test environment', () => {
      process.env.NODE_ENV = 'test';
      
      require('../../../src/app');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should accept production environment', () => {
      process.env.NODE_ENV = 'production';
      
      require('../../../src/app');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('Optional Environment Variables', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'ThisIsAVerySecureJWTSecretKey123456';
      process.env.SESSION_SECRET = 'ThisIsAVerySecureSessionSecret123456';
      process.env.NODE_ENV = 'test';
    });

    it('should not fail when optional DB variables are missing', () => {
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_NAME;
      delete process.env.DB_USER;
      delete process.env.DB_PASSWORD;
      
      require('../../../src/app');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should not fail when optional LOG variables are missing', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.LOG_MAX_SIZE;
      delete process.env.LOG_MAX_FILES;
      
      require('../../../src/app');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should not fail when AWS Lambda function name is set', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'meetabl-api-lambda';
      
      require('../../../src/app');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Validation Errors', () => {
    it('should report all validation errors at once', () => {
      process.env.JWT_SECRET = 'short';
      process.env.SESSION_SECRET = 'short';
      process.env.NODE_ENV = 'test';
      
      require('../../../src/app');
      
      const errorCall = mockLogger.error.mock.calls.find(call => 
        call[0].includes('Invalid environment configuration')
      );
      
      expect(errorCall).toBeDefined();
      expect(errorCall[0]).toContain('JWT_SECRET must be at least 32 characters long');
      expect(errorCall[0]).toContain('SESSION_SECRET must be at least 32 characters long');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Security Considerations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should not log sensitive values in error messages', () => {
      process.env.JWT_SECRET = 'short';
      process.env.SESSION_SECRET = 'short';
      
      require('../../../src/app');
      
      // Check all error log calls
      mockLogger.error.mock.calls.forEach(call => {
        expect(call[0]).not.toContain('short');
      });
    });

    it('should enforce strict security requirements for secrets', () => {
      // Weak but valid length secret
      process.env.JWT_SECRET = '12345678901234567890123456789012';
      process.env.SESSION_SECRET = '12345678901234567890123456789012';
      
      require('../../../src/app');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('JWT_SECRET should contain uppercase, lowercase, and numeric characters')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});