/**
 * User model tests
 *
 * Tests for the User model using proper mocking of Sequelize
 *
 * @author meetabl Team
 */

// Import test setup
require('../test-setup');

// Mock database and bcrypt
jest.mock('../../../src/config/database', () => ({
  sequelize: {
    define: jest.fn().mockImplementation((modelName, attributes, options) => {
      // Create a mock model class with the hooks functionality
      const Model = function () {};
      Model.prototype = {
        async validatePassword(password) {
          return require('bcrypt').compare(password, this.password_hash);
        }
      };

      // Add hooks storage
      Model.hooks = {
        beforeCreate: [],
        beforeUpdate: []
      };

      // Add hook methods
      Model.beforeCreate = function (fn) {
        this.hooks.beforeCreate.push(fn);
      };

      Model.beforeUpdate = function (fn) {
        this.hooks.beforeUpdate.push(fn);
      };

      // Return the model
      return Model;
    })
  }
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('mocksalt'),
  hash: jest.fn().mockResolvedValue('mockhash'),
  compare: jest.fn().mockImplementation((password, hash) =>
    // Simple mock implementation that checks if password is "correct"
    Promise.resolve(password === 'correct_password'))
}));

// Now import the model after mocking
const bcrypt = require('bcrypt');
const User = require('../../../src/models/user.model');

describe('User Model', () => {
  describe('Model Definition', () => {
    test('should have validatePassword instance method', () => {
      expect(User.prototype.validatePassword).toBeDefined();
      expect(typeof User.prototype.validatePassword).toBe('function');
    });

    test('should have beforeCreate hook', () => {
      expect(User.hooks.beforeCreate.length).toBeGreaterThan(0);
    });

    test('should have beforeUpdate hook', () => {
      expect(User.hooks.beforeUpdate.length).toBeGreaterThan(0);
    });
  });

  describe('validatePassword', () => {
    test('should validate correct password', async () => {
      const user = new User();
      user.password_hash = 'hashed_password';

      const result = await user.validatePassword('correct_password');

      expect(bcrypt.compare).toHaveBeenCalledWith('correct_password', 'hashed_password');
      expect(result).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const user = new User();
      user.password_hash = 'hashed_password';

      // Mock the bcrypt compare to return false for this test
      bcrypt.compare.mockResolvedValueOnce(false);

      const result = await user.validatePassword('wrong_password');

      expect(bcrypt.compare).toHaveBeenCalledWith('wrong_password', 'hashed_password');
      expect(result).toBe(false);
    });
  });

  describe('Password Hashing Hooks', () => {
    test('beforeCreate should hash password if changed', async () => {
      // Get the beforeCreate hook function
      const beforeCreateHook = User.hooks.beforeCreate[0];

      // Create a mock user object
      const user = {
        password_hash: 'plain_password',
        changed: jest.fn().mockReturnValue(true)
      };

      // Call the hook
      await beforeCreateHook(user);

      // Verify the hook behavior
      expect(user.changed).toHaveBeenCalledWith('password_hash');
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('plain_password', 'mocksalt');
      expect(user.password_hash).toBe('mockhash');
    });

    test('beforeCreate should not hash password if not changed', async () => {
      // Get the beforeCreate hook function
      const beforeCreateHook = User.hooks.beforeCreate[0];

      // Create a mock user object
      const user = {
        password_hash: 'existing_hash',
        changed: jest.fn().mockReturnValue(false)
      };

      // Call the hook
      await beforeCreateHook(user);

      // Verify the hook behavior
      expect(user.changed).toHaveBeenCalledWith('password_hash');
      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(user.password_hash).toBe('existing_hash');
    });

    test('beforeUpdate should hash password if changed', async () => {
      // Reset mock calls
      bcrypt.genSalt.mockClear();
      bcrypt.hash.mockClear();

      // Get the beforeUpdate hook function
      const beforeUpdateHook = User.hooks.beforeUpdate[0];

      // Create a mock user object
      const user = {
        password_hash: 'new_password',
        changed: jest.fn().mockReturnValue(true)
      };

      // Call the hook
      await beforeUpdateHook(user);

      // Verify the hook behavior
      expect(user.changed).toHaveBeenCalledWith('password_hash');
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('new_password', 'mocksalt');
      expect(user.password_hash).toBe('mockhash');
    });

    test('beforeUpdate should not hash password if not changed', async () => {
      // Reset mock calls
      bcrypt.genSalt.mockClear();
      bcrypt.hash.mockClear();

      // Get the beforeUpdate hook function
      const beforeUpdateHook = User.hooks.beforeUpdate[0];

      // Create a mock user object
      const user = {
        password_hash: 'existing_hash',
        changed: jest.fn().mockReturnValue(false)
      };

      // Call the hook
      await beforeUpdateHook(user);

      // Verify the hook behavior
      expect(user.changed).toHaveBeenCalledWith('password_hash');
      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(user.password_hash).toBe('existing_hash');
    });
  });
});
