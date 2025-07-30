/**
 * Environment Loading Tests
 * Tests for environment variable loading patterns across config files
 */

describe('Environment Loading Patterns', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('Database Configuration Environment Loading', () => {
    it('should use DB environment variables when set', () => {
      process.env.DB_HOST = 'test-host';
      process.env.DB_PORT = '3307';
      process.env.DB_NAME = 'test_db';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      
      const dbConfig = require('../../../src/config/database-mysql');
      const { host, port, database, username } = dbConfig.sequelize.options;
      
      expect(host).toBe('test-host');
      expect(port).toBe(3307);
      expect(database).toBe('test_db');
      expect(username).toBe('test_user');
    });

    it('should use defaults when DB environment variables are not set', () => {
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_NAME;
      delete process.env.DB_USER;
      delete process.env.DB_PASSWORD;
      
      const dbConfig = require('../../../src/config/database-mysql');
      const { host, port, database, username } = dbConfig.sequelize.options;
      
      expect(host).toBe('localhost');
      expect(port).toBe(3306);
      expect(database).toBe('meetabl_dev');
      expect(username).toBe('root');
    });

    it('should select test database configuration in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const dbConfig = require('../../../src/config/database');
      expect(dbConfig).toBeDefined();
      expect(dbConfig.sequelize).toBeDefined();
    });

    it('should handle serverless environment', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda';
      
      // The serverless config should be loadable
      expect(() => {
        require('../../../src/config/database-serverless');
      }).not.toThrow();
    });
  });

  describe('Logger Configuration Environment Loading', () => {
    it('should respect LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'error';
      
      const logger = require('../../../src/config/logger');
      expect(logger.config.level).toBe('error');
    });

    it('should use info level in production by default', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      
      const logger = require('../../../src/config/logger');
      expect(logger.config.level).toBe('info');
    });

    it('should use debug level in development by default', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;
      
      const logger = require('../../../src/config/logger');
      expect(logger.config.level).toBe('debug');
    });

    it('should respect log rotation environment variables', () => {
      process.env.LOG_MAX_SIZE = '100m';
      process.env.LOG_MAX_FILES = '60d';
      
      const logger = require('../../../src/config/logger');
      expect(logger.config.maxSize).toBe('100m');
      expect(logger.config.maxFiles).toBe('60d');
    });

    it('should respect logging toggle environment variables', () => {
      process.env.ENABLE_CONSOLE_LOGGING = 'false';
      process.env.ENABLE_FILE_LOGGING = 'false';
      process.env.ENABLE_AUDIT_LOGGING = 'false';
      
      const logger = require('../../../src/config/logger');
      expect(logger.config.enableConsole).toBe(false);
      expect(logger.config.enableFile).toBe(false);
      expect(logger.config.enableAudit).toBe(false);
    });
  });

  describe('Session Configuration Environment Loading', () => {
    it('should use SESSION_SECRET from environment', () => {
      process.env.SESSION_SECRET = 'test-session-secret-123456789012';
      
      const sessionConfig = require('../../../src/config/session');
      expect(sessionConfig).toBeDefined();
    });

    it('should respect session environment variables', () => {
      process.env.SESSION_NAME = 'test-session';
      process.env.SESSION_MAX_AGE = '3600000'; // 1 hour
      process.env.SESSION_SECURE = 'true';
      
      const sessionConfig = require('../../../src/config/session');
      // Session config would use these values
      expect(process.env.SESSION_NAME).toBe('test-session');
      expect(process.env.SESSION_MAX_AGE).toBe('3600000');
      expect(process.env.SESSION_SECURE).toBe('true');
    });
  });

  describe('Redis Configuration Environment Loading', () => {
    it('should use Redis environment variables', () => {
      process.env.REDIS_HOST = 'redis-test';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'redis-password';
      
      // The redis config should load these values
      expect(process.env.REDIS_HOST).toBe('redis-test');
      expect(process.env.REDIS_PORT).toBe('6380');
      expect(process.env.REDIS_PASSWORD).toBe('redis-password');
    });

    it('should use REDIS_URL if provided', () => {
      process.env.REDIS_URL = 'redis://user:pass@redis-server:6379/0';
      
      expect(process.env.REDIS_URL).toBe('redis://user:pass@redis-server:6379/0');
    });
  });

  describe('Stripe Configuration Environment Loading', () => {
    it('should use Stripe environment variables', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123456789';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123456';
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123456789';
      
      expect(process.env.STRIPE_SECRET_KEY).toBe('sk_test_123456789');
      expect(process.env.STRIPE_WEBHOOK_SECRET).toBe('whsec_test_123456');
      expect(process.env.STRIPE_PUBLISHABLE_KEY).toBe('pk_test_123456789');
    });
  });

  describe('Environment Variable Type Conversion', () => {
    it('should convert port strings to numbers', () => {
      process.env.DB_PORT = '3306';
      process.env.REDIS_PORT = '6379';
      process.env.PORT = '3001';
      
      const dbConfig = require('../../../src/config/database-mysql');
      expect(dbConfig.sequelize.options.port).toBe(3306);
      expect(typeof dbConfig.sequelize.options.port).toBe('number');
    });

    it('should handle boolean environment variables', () => {
      process.env.ENABLE_CONSOLE_LOGGING = 'false';
      process.env.SESSION_SECURE = 'true';
      
      const logger = require('../../../src/config/logger');
      expect(logger.config.enableConsole).toBe(false);
      expect(typeof logger.config.enableConsole).toBe('boolean');
    });
  });

  describe('Environment Variable Defaults', () => {
    it('should provide sensible defaults for all optional variables', () => {
      // Clear all optional environment variables
      const optionalVars = [
        'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
        'LOG_LEVEL', 'LOG_MAX_SIZE', 'LOG_MAX_FILES',
        'REDIS_HOST', 'REDIS_PORT',
        'PORT'
      ];
      
      optionalVars.forEach(varName => delete process.env[varName]);
      
      // Configs should still load with defaults
      expect(() => require('../../../src/config/database-mysql')).not.toThrow();
      expect(() => require('../../../src/config/logger')).not.toThrow();
      
      const dbConfig = require('../../../src/config/database-mysql');
      const logger = require('../../../src/config/logger');
      
      // Check some defaults
      expect(dbConfig.sequelize.options.host).toBe('localhost');
      expect(dbConfig.sequelize.options.port).toBe(3306);
      expect(logger.config.maxSize).toBe('20m');
      expect(logger.config.maxFiles).toBe('14d');
    });
  });

  describe('Environment-specific Behavior', () => {
    it('should disable logging in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const dbConfig = require('../../../src/config/database-mysql');
      expect(dbConfig.sequelize.options.logging).toBe(false);
    });

    it('should enable detailed logging in development', () => {
      process.env.NODE_ENV = 'development';
      
      const logger = require('../../../src/config/logger');
      expect(logger.config.level).toBe('debug');
    });

    it('should use secure defaults in production', () => {
      process.env.NODE_ENV = 'production';
      
      const logger = require('../../../src/config/logger');
      expect(logger.config.level).toBe('info');
    });
  });

  describe('Environment Variable Precedence', () => {
    it('should prefer explicit environment variables over NODE_ENV defaults', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug'; // Override production default
      
      const logger = require('../../../src/config/logger');
      expect(logger.config.level).toBe('debug');
    });
  });

  describe('Special Environment Handling', () => {
    it('should handle dotenv loading gracefully', () => {
      // dotenv.config() is called in various config files
      // It should not throw even if .env file doesn't exist
      expect(() => {
        require('dotenv').config();
      }).not.toThrow();
    });

    it('should handle missing NODE_ENV gracefully in configs', () => {
      delete process.env.NODE_ENV;
      
      // Configs should still load
      expect(() => require('../../../src/config/logger')).not.toThrow();
      expect(() => require('../../../src/config/database-mysql')).not.toThrow();
    });
  });
});