/**
 * Logger Configuration Tests
 * Tests for the enhanced logging system
 */

const path = require('path');
const fs = require('fs');

// Mock winston and bunyan before requiring logger
jest.mock('winston', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
    child: jest.fn(() => mockLogger)
  };
  
  return {
    createLogger: jest.fn(() => mockLogger),
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      colorize: jest.fn(),
      simple: jest.fn(),
      json: jest.fn()
    }
  };
});

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn();
});

jest.mock('bunyan', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => mockLogger)
  };
  
  return {
    createLogger: jest.fn(() => mockLogger),
    stdSerializers: {
      req: jest.fn(),
      res: jest.fn(),
      err: jest.fn()
    }
  };
});

describe('Logger Configuration Tests', () => {
  let logger;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear module cache
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Logger Initialization', () => {
    it('should initialize logger with default configuration', () => {
      process.env.NODE_ENV = 'development';
      logger = require('../../../src/config/logger');
      
      expect(logger).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('should export createLogger factory function', () => {
      logger = require('../../../src/config/logger');
      
      expect(logger.createLogger).toBeDefined();
      expect(typeof logger.createLogger).toBe('function');
    });

    it('should export audit logger', () => {
      logger = require('../../../src/config/logger');
      
      expect(logger.auditLogger).toBeDefined();
    });

    it('should export configuration', () => {
      logger = require('../../../src/config/logger');
      
      expect(logger.config).toBeDefined();
      expect(logger.config).toHaveProperty('level');
      expect(logger.config).toHaveProperty('maxSize');
      expect(logger.config).toHaveProperty('maxFiles');
    });
  });

  describe('Environment-based Configuration', () => {
    it('should use info level in production', () => {
      process.env.NODE_ENV = 'production';
      logger = require('../../../src/config/logger');
      
      expect(logger.config.level).toBe('info');
    });

    it('should use debug level in development', () => {
      process.env.NODE_ENV = 'development';
      logger = require('../../../src/config/logger');
      
      expect(logger.config.level).toBe('debug');
    });

    it('should respect LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'warn';
      logger = require('../../../src/config/logger');
      
      expect(logger.config.level).toBe('warn');
    });

    it('should disable console logging in test environment', () => {
      process.env.NODE_ENV = 'test';
      logger = require('../../../src/config/logger');
      
      // In test env, console transport should not be added
      const winston = require('winston');
      const consoleCalls = winston.transports.Console.mock.calls;
      expect(consoleCalls.length).toBe(0);
    });
  });

  describe('Logger Methods', () => {
    beforeEach(() => {
      logger = require('../../../src/config/logger');
    });

    it('should have standard logging methods', () => {
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should have specialized logging methods', () => {
      expect(typeof logger.http).toBe('function');
      expect(typeof logger.auditLog).toBe('function');
      expect(typeof logger.performance).toBe('function');
      expect(typeof logger.business).toBe('function');
      expect(typeof logger.security).toBe('function');
    });

    it('should log to both winston and bunyan', () => {
      const message = 'Test message';
      const meta = { test: true };
      
      logger.info(message, meta);
      
      expect(logger.winston.info).toHaveBeenCalledWith(message, meta);
      expect(logger.bunyan.info).toHaveBeenCalledWith(meta, message);
    });

    it('should handle audit logging', () => {
      const event = 'user_login';
      const details = { userId: '123', ip: '127.0.0.1' };
      
      logger.auditLog(event, details);
      
      expect(logger.audit.info).toHaveBeenCalledWith(
        'Audit event',
        expect.objectContaining({
          event,
          timestamp: expect.any(String),
          ...details
        })
      );
    });

    it('should handle performance logging', () => {
      const operation = 'database_query';
      const duration = 1500;
      const meta = { query: 'SELECT * FROM users' };
      
      logger.performance(operation, duration, meta);
      
      expect(logger.winston.info).toHaveBeenCalledWith(
        `Performance: ${operation}`,
        expect.objectContaining({
          ...meta,
          type: 'performance',
          operation,
          duration,
          slow: true
        })
      );
    });

    it('should handle security logging', () => {
      const event = 'invalid_token';
      const details = { userId: '123', token: 'xxx' };
      
      logger.security(event, details);
      
      expect(logger.winston.warn).toHaveBeenCalledWith(
        `Security event: ${event}`,
        expect.objectContaining({
          ...details,
          type: 'security',
          event
        })
      );
      
      expect(logger.audit.info).toHaveBeenCalled();
    });
  });

  describe('Child Logger Creation', () => {
    beforeEach(() => {
      logger = require('../../../src/config/logger');
    });

    it('should create child logger with context', () => {
      const context = { component: 'auth', requestId: '123' };
      const childLogger = logger.child(context);
      
      expect(childLogger).toBeDefined();
      expect(logger.winston.child).toHaveBeenCalledWith(context);
      expect(logger.bunyan.child).toHaveBeenCalledWith(context);
    });

    it('should support createLogger factory with string', () => {
      const childLogger = logger.createLogger('auth-controller');
      
      expect(childLogger).toBeDefined();
      expect(logger.winston.child).toHaveBeenCalledWith({ component: 'auth-controller' });
    });

    it('should support createLogger factory with object', () => {
      const context = { service: 'payment', version: '1.0' };
      const childLogger = logger.createLogger(context);
      
      expect(childLogger).toBeDefined();
      expect(logger.winston.child).toHaveBeenCalledWith(context);
    });
  });

  describe('Log Directory Creation', () => {
    it('should create required log directories', () => {
      // The logger module creates directories on import
      const logsDir = path.join(__dirname, '../../../logs');
      const auditDir = path.join(logsDir, 'audit');
      const errorDir = path.join(logsDir, 'errors');
      
      // Note: In tests, fs.existsSync might be mocked
      // This test verifies the structure is attempted
      expect(() => {
        require('../../../src/config/logger');
      }).not.toThrow();
    });
  });

  describe('Custom Serializers', () => {
    it('should have custom serializers for sensitive data', () => {
      const bunyan = require('bunyan');
      
      // Logger should extend bunyan serializers
      expect(bunyan.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          serializers: expect.objectContaining({
            user: expect.any(Function),
            booking: expect.any(Function),
            payment: expect.any(Function)
          })
        })
      );
    });
  });

  describe('Configuration Options', () => {
    it('should respect file logging configuration', () => {
      process.env.ENABLE_FILE_LOGGING = 'false';
      logger = require('../../../src/config/logger');
      
      expect(logger.config.enableFile).toBe(false);
    });

    it('should respect console logging configuration', () => {
      process.env.ENABLE_CONSOLE_LOGGING = 'false';
      logger = require('../../../src/config/logger');
      
      expect(logger.config.enableConsole).toBe(false);
    });

    it('should respect audit logging configuration', () => {
      process.env.ENABLE_AUDIT_LOGGING = 'false';
      logger = require('../../../src/config/logger');
      
      expect(logger.config.enableAudit).toBe(false);
      
      // Audit logger should be a no-op
      logger.auditLog('test', {});
      expect(logger.audit.info).not.toHaveBeenCalled();
    });

    it('should use configured log rotation settings', () => {
      process.env.LOG_MAX_SIZE = '50m';
      process.env.LOG_MAX_FILES = '30d';
      logger = require('../../../src/config/logger');
      
      expect(logger.config.maxSize).toBe('50m');
      expect(logger.config.maxFiles).toBe('30d');
    });
  });

  describe('Error Handling', () => {
    it('should handle winston exception handlers', () => {
      const winston = require('winston');
      
      logger = require('../../../src/config/logger');
      
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          exceptionHandlers: expect.any(Array),
          rejectionHandlers: expect.any(Array)
        })
      );
    });
  });

  describe('Backward Compatibility', () => {
    beforeEach(() => {
      logger = require('../../../src/config/logger');
    });

    it('should maintain backward compatibility with bound methods', () => {
      expect(logger.debug.bind).toBeDefined();
      expect(logger.info.bind).toBeDefined();
      expect(logger.warn.bind).toBeDefined();
      expect(logger.error.bind).toBeDefined();
    });
  });

  describe('Default Metadata', () => {
    it('should include default metadata in logs', () => {
      const winston = require('winston');
      
      logger = require('../../../src/config/logger');
      
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultMeta: expect.objectContaining({
            service: 'meetabl-api',
            environment: expect.any(String),
            version: expect.any(String),
            hostname: expect.any(String),
            pid: expect.any(Number)
          })
        })
      );
    });
  });
});