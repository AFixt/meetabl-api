/**
 * Logger Configuration Tests
 * 
 * Tests for the Bunyan logger configuration
 * 
 * @author meetabl Team
 */

const path = require('path');

// Mock bunyan before requiring logger
jest.mock('bunyan', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  })),
  stdSerializers: { req: jest.fn(), res: jest.fn(), err: jest.fn() }
}));

// Mock fs.promises after the logger import to ensure proper mocking
const mockFs = {
  access: jest.fn(),
  mkdir: jest.fn()
};

jest.mock('fs', () => ({
  promises: mockFs
}));

const bunyan = require('bunyan');

describe('Logger Configuration', () => {
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the module cache to ensure fresh imports
    delete require.cache[require.resolve('../../../src/config/logger')];
  });

  afterEach(() => {
    // Clean up any potential hanging promises
    jest.clearAllTimers();
  });

  test('should create logger with correct configuration in development', () => {
    process.env.NODE_ENV = 'development';
    
    logger = require('../../../src/config/logger');

    expect(bunyan.createLogger).toHaveBeenCalledWith(expect.objectContaining({
      name: 'meetabl-api',
      level: 'debug',
      serializers: bunyan.stdSerializers,
      streams: expect.arrayContaining([
        expect.objectContaining({
          type: 'rotating-file'
        })
      ])
    }));
  });

  test('should create logger with correct configuration in production', () => {
    process.env.NODE_ENV = 'production';
    
    logger = require('../../../src/config/logger');

    expect(bunyan.createLogger).toHaveBeenCalledWith(expect.objectContaining({
      name: 'meetabl-api',
      level: 'info',
      serializers: bunyan.stdSerializers
    }));
  });

  test('should create logger with correct configuration in test', () => {
    process.env.NODE_ENV = 'test';
    
    logger = require('../../../src/config/logger');

    expect(bunyan.createLogger).toHaveBeenCalledWith(expect.objectContaining({
      name: 'meetabl-api',
      level: 'debug',
      serializers: bunyan.stdSerializers,
      streams: expect.arrayContaining([
        expect.objectContaining({
          type: 'stream'
        })
      ])
    }));
  });

  test('should create logs directory if it does not exist', async () => {
    // Mock fs.access to throw (directory doesn't exist)
    mockFs.access.mockRejectedValueOnce(new Error('ENOENT'));
    mockFs.mkdir.mockResolvedValueOnce();

    // Import logger to trigger directory creation
    logger = require('../../../src/config/logger');

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockFs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('logs'),
      { recursive: true }
    );
  });

  test('should not create logs directory if it exists', async () => {
    // Mock fs.access to succeed (directory exists)
    mockFs.access.mockResolvedValueOnce();

    // Import logger
    logger = require('../../../src/config/logger');

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockFs.mkdir).not.toHaveBeenCalled();
  });

  test('should handle directory creation errors gracefully', async () => {
    // Mock both access and mkdir to fail
    mockFs.access.mockRejectedValueOnce(new Error('ENOENT'));
    mockFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

    // Spy on console.error to verify error handling
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Import logger
    logger = require('../../../src/config/logger');

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    consoleSpy.mockRestore();
  });

  test('should export a logger instance', () => {
    logger = require('../../../src/config/logger');
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  test('should configure different streams for different environments', () => {
    // Test development environment
    process.env.NODE_ENV = 'development';
    delete require.cache[require.resolve('../../../src/config/logger')];
    require('../../../src/config/logger');

    const devCall = bunyan.createLogger.mock.calls[bunyan.createLogger.mock.calls.length - 1];
    const devStreams = devCall[0].streams;
    
    expect(devStreams).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'rotating-file'
      }),
      expect.objectContaining({
        level: 'error',
        type: 'rotating-file'
      })
    ]));

    // Test production environment
    process.env.NODE_ENV = 'production';
    jest.clearAllMocks();
    delete require.cache[require.resolve('../../../src/config/logger')];
    require('../../../src/config/logger');

    const prodCall = bunyan.createLogger.mock.calls[bunyan.createLogger.mock.calls.length - 1];
    const prodStreams = prodCall[0].streams;
    
    expect(prodStreams).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'stream'
      }),
      expect.objectContaining({
        level: 'error',
        type: 'rotating-file'
      })
    ]));
  });
});