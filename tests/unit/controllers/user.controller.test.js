/**
 * User controller tests
 *
 * Tests for the user controller functionality
 *
 * @author meetabl Team
 */

// Import test setup
require('../test-setup');

// Define global test utilities
if (typeof global.createMockRequest !== 'function'
    || typeof global.createMockResponse !== 'function') {
  global.createMockRequest = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: 'test-user-id' },
    ...overrides
  });

  global.createMockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  };
}

// Mock dependencies
jest.mock('../../../src/models', () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({}),
      name: '',
      timezone: '',
      email: '',
      id: '',
      calendar_provider: '',
      created: new Date(),
      updated: new Date()
    }))
  },
  UserSettings: {
    findOne: jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({}),
      user_id: '',
      accessibility_mode: false,
      branding_color: '',
      confirmation_email_copy: false,
      alt_text_enabled: false
    })),
    create: jest.fn()
  },
  AuditLog: {
    create: jest.fn()
  }
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Now import the controller after mocking
const {
  getCurrentUser,
  updateUser,
  getUserSettings,
  updateUserSettings
} = require('../../../src/controllers/user.controller');
const { User, UserSettings, AuditLog } = require('../../../src/models');
const logger = require('../../../src/config/logger');

describe('User Controller', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    test('should get user profile successfully', async () => {
      // Mock user lookup
      User.findOne.mockResolvedValueOnce({
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'UTC',
        calendar_provider: 'google',
        created: new Date('2023-01-01'),
        updated: new Date('2023-01-02'),
        save: jest.fn().mockResolvedValue({})
      });

      // Create request with authenticated user
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute the controller
      await getCurrentUser(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });

    test('should handle user not found', async () => {
      // Mock user not found
      User.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = createMockRequest({
        user: { id: 'non-existent-id' }
      });
      const res = createMockResponse();

      // Execute the controller
      await getCurrentUser(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'not_found'
        })
      }));
    });

    test('should handle database errors', async () => {
      // Mock database error
      User.findOne.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute the controller
      await getCurrentUser(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'internal_server_error'
        })
      }));

      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    test('should update profile successfully', async () => {
      // Mock user lookup
      const mockUser = {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'UTC',
        save: jest.fn().mockResolvedValue({})
      };

      User.findOne.mockResolvedValueOnce(mockUser);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          name: 'Updated Name',
          timezone: 'America/New_York'
        }
      });
      const res = createMockResponse();

      // Execute the controller
      await updateUser(req, res);

      // Verify save was called after properties were set
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.name).toBe('Updated Name');
      expect(mockUser.timezone).toBe('America/New_York');

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);

      // Verify audit log was created
      expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-id',
        action: 'user.update'
      }));
    });

    test('should reject update with invalid data', async () => {
      // Mock user lookup
      User.findOne.mockResolvedValueOnce({
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'UTC',
        save: jest.fn().mockRejectedValue(new Error('Validation error'))
      });

      // Create request with invalid data
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          name: '' // Empty name is invalid
        }
      });
      const res = createMockResponse();

      // Execute the controller
      await updateUser(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'internal_server_error'
        })
      }));
    });
  });

  describe('getSettings', () => {
    test('should get user settings successfully', async () => {
      // Mock settings lookup
      UserSettings.findOne.mockResolvedValueOnce({
        id: 'settings-id',
        user_id: 'test-user-id',
        accessibility_mode: false,
        confirmation_email_copy: true,
        alt_text_enabled: false
      });

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute the controller
      await getUserSettings(req, res);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        accessibility_mode: false,
        confirmation_email_copy: true,
        alt_text_enabled: false
      }));
    });

    test('should create settings if not found', async () => {
      // Mock settings not found
      UserSettings.findOne.mockResolvedValueOnce(null);

      // Mock settings create
      UserSettings.create.mockResolvedValueOnce({
        id: 'new-settings-id',
        user_id: 'test-user-id',
        accessibility_mode: false,
        confirmation_email_copy: true,
        alt_text_enabled: false
      });

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute the controller
      await getUserSettings(req, res);

      // Verify settings was created
      expect(UserSettings.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-id'
      }));

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        accessibility_mode: false,
        confirmation_email_copy: true,
        alt_text_enabled: false
      }));
    });
  });

  describe('updateSettings', () => {
    test('should update settings successfully', async () => {
      // Mock settings lookup
      const mockSettings = {
        id: 'settings-id',
        user_id: 'test-user-id',
        accessibility_mode: false,
        confirmation_email_copy: true,
        alt_text_enabled: false,
        branding_color: '#000000',
        save: jest.fn().mockResolvedValue({})
      };

      UserSettings.findOne.mockResolvedValueOnce(mockSettings);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          accessibility_mode: true,
          alt_text_enabled: true
        }
      });
      const res = createMockResponse();

      // Execute the controller
      await updateUserSettings(req, res);

      // Verify settings properties were updated
      expect(mockSettings.accessibility_mode).toBe(true);
      expect(mockSettings.alt_text_enabled).toBe(true);
      expect(mockSettings.save).toHaveBeenCalled();

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);

      // Verify audit log was created
      expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-id',
        action: 'user.settings.update'
      }));
    });

    test('should create settings if not found', async () => {
      // Mock settings not found
      UserSettings.findOne.mockResolvedValueOnce(null);

      // Mock settings create
      UserSettings.create.mockResolvedValueOnce({
        id: 'new-settings-id',
        user_id: 'test-user-id',
        accessibility_mode: true,
        confirmation_email_copy: false,
        alt_text_enabled: true,
        branding_color: '#000000',
        save: jest.fn().mockResolvedValue({})
      });

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: {
          accessibility_mode: true,
          alt_text_enabled: true
        }
      });
      const res = createMockResponse();

      // Execute the controller
      await updateUserSettings(req, res);

      // Verify settings was created with user_id at minimum (controller adds the rest)
      expect(UserSettings.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-id'
      }));

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
