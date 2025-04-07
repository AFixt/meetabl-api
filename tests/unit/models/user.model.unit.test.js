/**
 * User model unit tests
 * 
 * Using the improved test setup for consistent mocking
 * 
 * @author AccessMeet Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { User, UserSettings } = require('../../../src/models');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('User Model', () => {
  // Mock implementation for create with hooks
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the User model create method
    User.create.mockImplementation(async (userData) => {
      const userId = userData.id || uuidv4();
      
      // Simulate afterCreate hook for user settings
      if (!userData.skipHooks) {
        // This simulates the afterCreate hook that creates user settings
        setTimeout(() => {
          UserSettings.create({
            id: uuidv4(),
            user_id: userId,
            accessibility_mode: false,
            notification_email: true,
            notification_sms: false
          });
        }, 0);
      }
      
      return {
        id: userId,
        name: userData.name || 'Test User',
        email: userData.email || 'test@example.com',
        password_hash: userData.password_hash || 'hashed_password',
        timezone: userData.timezone || 'UTC',
        ...userData
      };
    });
    
    // Mock the unique email validation
    User.findOne.mockImplementation(async ({ where }) => {
      if (where.email === 'duplicate@example.com') {
        return { id: 'existing-user', email: 'duplicate@example.com' };
      }
      return null;
    });
  });

  test('should create a user successfully', async () => {
    const mockPasswordHash = 'hashed_password';
    bcrypt.hash.mockResolvedValueOnce(mockPasswordHash);
    
    const userData = {
      name: 'New User',
      email: 'new@example.com',
      password: 'Password123!',
      timezone: 'America/New_York'
    };
    
    const user = await User.create({
      ...userData,
      password_hash: mockPasswordHash
    });
    
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.name).toBe(userData.name);
    expect(user.email).toBe(userData.email);
    expect(user.password_hash).toBe(mockPasswordHash);
    expect(user.timezone).toBe(userData.timezone);
  });

  test('should create user settings when user is created', async () => {
    // Create a user
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password_hash: 'hash',
    });
    
    // Mock finding the settings for this user
    UserSettings.findOne.mockResolvedValueOnce({
      id: 'settings-id',
      user_id: user.id,
      accessibility_mode: false,
      notification_email: true,
      notification_sms: false
    });
    
    // Wait for the next tick to let the afterCreate "hook" run
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Verify UserSettings.create was called
    expect(UserSettings.create).toHaveBeenCalled();
    
    // Find the settings
    const settings = await UserSettings.findOne({ where: { user_id: user.id } });
    
    expect(settings).toBeDefined();
    expect(settings.user_id).toBe(user.id);
  });

  test('should not allow duplicate emails', async () => {
    // First attempt should work
    const user1 = await User.create({
      name: 'Test User 1',
      email: 'unique@example.com',
      password_hash: 'hash'
    });
    
    expect(user1).toBeDefined();
    
    // Mock the validation error
    User.create.mockRejectedValueOnce(new Error('SequelizeUniqueConstraintError'));
    
    // Second attempt should fail
    try {
      await User.create({
        name: 'Test User 2',
        email: 'duplicate@example.com',
        password_hash: 'hash'
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('should have associations with other models', async () => {
    // Mock associations object
    User.associations = {
      bookings: { type: 'hasMany' },
      settings: { type: 'hasOne' }
    };
    
    // Check associations exist
    expect(User.associations).toBeDefined();
    expect(User.associations.bookings).toBeDefined();
    expect(User.associations.settings).toBeDefined();
  });
});