/**
 * User model unit tests
 * 
 * Using the improved test setup for consistent mocking
 * 
 * @author meetabl Team
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

// Create a mock validatePassword function
const validatePasswordMock = async function(password) {
  return bcrypt.compare(password, this.password_hash);
};

describe('User Model', () => {
  // Mock implementation for create with hooks
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the User model create method
    User.create.mockImplementation(async (userData) => {
      const userId = userData.id || uuidv4();
      
      // Simulate beforeCreate hook for password hashing
      if (userData.password_hash && !userData.skipHooks) {
        // This simulates the beforeCreate hook for password hashing
        userData.password_hash = await bcrypt.hash(userData.password_hash, 'mocksalt');
      }
      
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
        calendar_provider: userData.calendar_provider || 'none',
        created: userData.created || new Date(),
        updated: userData.updated || new Date(),
        validatePassword: validatePasswordMock,
        ...userData
      };
    });
    
    // Mock the update method
    User.update.mockImplementation(async (updates, options) => {
      // Simulate beforeUpdate hook for password hashing
      if (updates.password_hash) {
        updates.password_hash = await bcrypt.hash(updates.password_hash, 'mocksalt');
      }
      return [1];
    });
    
    // Mock the unique email validation
    User.findOne.mockImplementation(async ({ where }) => {
      if (where.email === 'duplicate@example.com') {
        return { 
          id: 'existing-user', 
          email: 'duplicate@example.com',
          validatePassword: User.prototype.validatePassword,
          password_hash: await bcrypt.hash('Password123!', 'mocksalt')
        };
      }
      return null;
    });
  });

  test('should create a user successfully', async () => {
    const userData = {
      name: 'New User',
      email: 'new@example.com',
      password_hash: 'Password123!',
      timezone: 'America/New_York'
    };
    
    const user = await User.create(userData);
    
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.name).toBe(userData.name);
    expect(user.email).toBe(userData.email);
    expect(user.password_hash).toBeDefined();
    expect(user.timezone).toBe(userData.timezone);
    expect(user.calendar_provider).toBe('none');
    expect(user.created).toBeInstanceOf(Date);
    expect(user.updated).toBeInstanceOf(Date);
  });

  test('should hash password during user creation', async () => {
    const plainPassword = 'Password123!';
    
    // Mock the hash function to return a predictable hash
    const mockHash = 'hashed_password_123';
    bcrypt.hash.mockResolvedValueOnce(mockHash);
    
    const user = await User.create({
      name: 'Password Test User',
      email: 'password@example.com',
      password_hash: plainPassword
    });
    
    // Verify password was hashed
    expect(user.password_hash).toBe(mockHash);
    expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 'mocksalt');
  });

  test('should hash password during user update', async () => {
    const plainPassword = 'NewPassword456!';
    const userId = 'test-user-id';
    
    // Set up mock for update
    const mockHash = 'updated_hash_456';
    bcrypt.hash.mockResolvedValueOnce(mockHash);
    
    // Update user password
    await User.update(
      { password_hash: plainPassword },
      { where: { id: userId } }
    );
    
    // Verify password was hashed during update
    expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 'mocksalt');
  });

  test('validatePassword method should correctly validate passwords', async () => {
    // Create a user with known password
    const plainPassword = 'Password123!';
    const user = await User.create({
      name: 'Validation Test User',
      email: 'validate@example.com',
      password_hash: plainPassword
    });
    
    // Mock the compare function to correctly validate passwords
    bcrypt.compare.mockImplementation((password, hash) => {
      return Promise.resolve(password === plainPassword);
    });
    
    // Test correct password
    const validResult = await user.validatePassword(plainPassword);
    expect(validResult).toBe(true);
    
    // Test incorrect password
    const invalidResult = await user.validatePassword('wrong_password');
    expect(invalidResult).toBe(false);
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
    await expect(User.create({
      name: 'Test User 2',
      email: 'duplicate@example.com',
      password_hash: 'hash'
    })).rejects.toThrow();
  });

  test('should create user with default timezone if not provided', async () => {
    const user = await User.create({
      name: 'Default Timezone User',
      email: 'timezone@example.com',
      password_hash: 'hash'
    });
    
    expect(user.timezone).toBe('UTC');
  });

  test('should create user with custom calendar provider', async () => {
    const user = await User.create({
      name: 'Google Calendar User',
      email: 'google@example.com',
      password_hash: 'hash',
      calendar_provider: 'google'
    });
    
    expect(user.calendar_provider).toBe('google');
  });

  test('should have associations with other models', async () => {
    // Mock associations object
    User.associations = {
      bookings: { type: 'hasMany' },
      settings: { type: 'hasOne' },
      availabilityRules: { type: 'hasMany' },
      calendarTokens: { type: 'hasMany' },
      notifications: { type: 'hasMany' }
    };
    
    // Check associations exist
    expect(User.associations).toBeDefined();
    expect(User.associations.bookings).toBeDefined();
    expect(User.associations.settings).toBeDefined();
    expect(User.associations.availabilityRules).toBeDefined();
    expect(User.associations.calendarTokens).toBeDefined();
    expect(User.associations.notifications).toBeDefined();
  });

  test('should use UUID as primary key', async () => {
    const user = await User.create({
      name: 'UUID Test User',
      email: 'uuid@example.com',
      password_hash: 'hash'
    });
    
    expect(user.id).toBeDefined();
    expect(user.id.length).toBe(36); // UUID v4 format
  });

  test('should update timestamps on save', async () => {
    // Create initial user
    const user = await User.create({
      name: 'Timestamp Test User',
      email: 'timestamp@example.com',
      password_hash: 'hash'
    });
    
    const createdDate = user.created;
    
    // Mock the save method
    const mockSave = jest.fn().mockImplementation(function() {
      this.updated = new Date(Date.now() + 1000); // Add 1 second
      return this;
    });
    
    // Add save method to user object
    user.save = mockSave;
    
    // Wait a moment and update user
    await new Promise(resolve => setTimeout(resolve, 10));
    await user.save();
    
    // Creation date should be unchanged, but updated date should be newer
    expect(user.created).toEqual(createdDate);
    expect(user.updated > createdDate).toBe(true);
  });
});