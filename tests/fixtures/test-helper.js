/**
 * Test helper utilities
 * 
 * Provides common utilities for testing with mocked dependencies
 * 
 * @author meetabl Team
 */

const path = require('path');
const fs = require('fs');

/**
 * Creates a mock function that succeeds or fails based on input
 * @param {*} successValue - Value to return on success
 * @param {*} errorValue - Error to throw on failure
 * @returns {Function} Mock function
 */
const createMockFunction = (successValue, errorValue) => {
  return jest.fn().mockImplementation((...args) => {
    // Check if the first argument is a special test value for failure
    if (args[0] === 'fail' || (args[0] && args[0].id === 'fail')) {
      if (typeof errorValue === 'function') {
        throw errorValue();
      }
      throw errorValue || new Error('Mock error');
    }
    // Otherwise return the success value
    if (typeof successValue === 'function') {
      return successValue(...args);
    }
    return successValue;
  });
};

/**
 * Mock all models used in controllers
 * @returns {Object} Mocked models
 */
const mockModels = () => {
  // Create mock models with common methods
  const createMockModel = (name) => {
    return {
      findAll: createMockFunction([{ id: 'test-id', name: `Test ${name}` }]),
      findOne: createMockFunction({ id: 'test-id', name: `Test ${name}`, save: jest.fn() }),
      findByPk: createMockFunction({ id: 'test-id', name: `Test ${name}`, save: jest.fn() }),
      create: createMockFunction({ id: 'test-id', name: `Test ${name}` }),
      update: createMockFunction([1]),
      destroy: createMockFunction(1),
      count: createMockFunction(5),
      findAndCountAll: createMockFunction({
        count: 5,
        rows: Array(5).fill().map((_, i) => ({ id: `test-id-${i}`, name: `Test ${name} ${i}` }))
      })
    };
  };

  // Create all models
  return {
    User: {
      ...createMockModel('User'),
      // Override findOne for password validation
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.email === 'test@example.com') {
          return Promise.resolve({
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
            password_hash: '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Mock hash
            timezone: 'UTC'
          });
        }
        return Promise.resolve(null);
      })
    },
    UserSettings: createMockModel('UserSettings'),
    AvailabilityRule: createMockModel('AvailabilityRule'),
    Booking: createMockModel('Booking'),
    Notification: createMockModel('Notification'),
    CalendarToken: createMockModel('CalendarToken'),
    AuditLog: createMockModel('AuditLog')
  };
};

/**
 * Mock Sequelize
 * @returns {Object} Mock Sequelize
 */
const mockSequelize = () => {
  return {
    transaction: jest.fn().mockImplementation(() => ({
      commit: jest.fn().mockResolvedValue(null),
      rollback: jest.fn().mockResolvedValue(null)
    })),
    Op: {
      gt: Symbol('gt'),
      gte: Symbol('gte'),
      lt: Symbol('lt'),
      lte: Symbol('lte'),
      eq: Symbol('eq'),
      ne: Symbol('ne'),
      in: Symbol('in'),
      notIn: Symbol('notIn'),
      between: Symbol('between'),
      notBetween: Symbol('notBetween'),
      or: Symbol('or'),
      and: Symbol('and')
    }
  };
};

/**
 * Mock bcrypt for password hashing
 * @returns {Object} Mock bcrypt
 */
const mockBcrypt = () => {
  return {
    genSalt: jest.fn().mockResolvedValue('mocksalt'),
    hash: jest.fn().mockResolvedValue('mockhash'),
    compare: jest.fn().mockImplementation((password, hash) => {
      return Promise.resolve(password === 'Password123!');
    })
  };
};

/**
 * Mock jsonwebtoken for authentication
 * @returns {Object} Mock jsonwebtoken
 */
const mockJwt = () => {
  class TokenExpiredError extends Error {
    constructor(message) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  }
  
  class JsonWebTokenError extends Error {
    constructor(message) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  }

  return {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
    verify: jest.fn().mockImplementation((token) => {
      if (token === 'expired') {
        throw new TokenExpiredError('Token expired');
      }
      if (token === 'invalid') {
        throw new JsonWebTokenError('Invalid token');
      }
      return { userId: 'test-user-id' };
    }),
    TokenExpiredError,
    JsonWebTokenError
  };
};

/**
 * Mock services
 * @returns {Object} Mock services
 */
const mockServices = () => {
  return {
    notificationService: {
      queueNotification: jest.fn().mockResolvedValue({ id: 'notification-id' }),
      processNotificationQueue: jest.fn().mockResolvedValue(null)
    },
    calendarService: {
      createCalendarEvent: jest.fn().mockResolvedValue({ id: 'calendar-event-id' }),
      getGoogleAuthClient: jest.fn().mockResolvedValue({}),
      getMicrosoftGraphClient: jest.fn().mockResolvedValue({})
    }
  };
};

/**
 * Setup test mocks for controllers
 * @returns {Object} Mocked dependencies
 */
const setupControllerMocks = () => {
  // Mock models
  jest.mock('../../src/models', () => mockModels());
  
  // Mock database
  jest.mock('../../src/config/database', () => ({ 
    sequelize: mockSequelize(),
    initializeDatabase: jest.fn().mockResolvedValue({})
  }));
  
  // Mock bcrypt
  jest.mock('bcrypt', () => mockBcrypt());
  
  // Mock JWT
  jest.mock('jsonwebtoken', () => mockJwt());
  
  // Mock services
  jest.mock('../../src/services/notification.service', () => 
    mockServices().notificationService
  );
  
  jest.mock('../../src/services/calendar.service', () => 
    mockServices().calendarService
  );
  
  // Mock logger
  jest.mock('../../src/config/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }));
  
  return {
    models: mockModels(),
    sequelize: mockSequelize(),
    bcrypt: mockBcrypt(),
    jwt: mockJwt(),
    services: mockServices()
  };
};

/**
 * Creates a test suite setup function
 * @param {Function} testFn - Test function
 * @returns {Function} Setup function
 */
const createTestSuite = (testFn) => {
  return (name, options = {}) => {
    // Setup mocks based on options
    const mocks = setupControllerMocks();
    
    // Run the test with mocks
    describe(name, () => {
      testFn(mocks, options);
    });
  };
};

module.exports = {
  createMockFunction,
  mockModels,
  mockSequelize,
  mockBcrypt,
  mockJwt,
  mockServices,
  setupControllerMocks,
  createTestSuite
};