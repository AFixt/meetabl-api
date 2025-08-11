/**
 * Mock Logger for Tests
 *
 * Provides a mock implementation of the logger to avoid initialization issues in tests
 *
 * @author meetabl Team
 */

// Create mock logger instance
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  child: jest.fn().mockReturnThis(),
  auditLog: jest.fn(),
  business: jest.fn(),
  security: jest.fn(),
  performance: jest.fn()
};

// Mock createLogger function
const createLogger = jest.fn((context) => {
  const childLogger = Object.create(mockLogger);
  childLogger.context = context;
  return childLogger;
});

// Mock auditLogger
const auditLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock config
const config = {
  level: 'debug',
  enableConsole: true,
  enableFile: false,
  enableAudit: false
};

// Export mocks
module.exports = mockLogger;
module.exports.createLogger = createLogger;
module.exports.auditLogger = auditLogger;
module.exports.config = config;

// Helper to reset all mocks
module.exports.resetMocks = () => {
  Object.values(mockLogger).forEach(fn => {
    if (typeof fn === 'function' && fn.mockClear) {
      fn.mockClear();
    }
  });
  createLogger.mockClear();
  Object.values(auditLogger).forEach(fn => {
    if (typeof fn === 'function' && fn.mockClear) {
      fn.mockClear();
    }
  });
};