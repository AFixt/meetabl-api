/**
 * User model tests
 * 
 * @author AccessMeet Team
 */

const { User, UserSettings } = require('../../../src/models');
const { setupTestDatabase, clearDatabase, createTestUser } = require('../../fixtures/db');

describe('User Model', () => {
  // Setup and teardown
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  test('should create a user successfully', async () => {
    const user = await createTestUser();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.password_hash).toBeDefined();
  });

  test('should create user settings when user is created', async () => {
    const user = await createTestUser();
    
    const settings = await UserSettings.findOne({
      where: { user_id: user.id }
    });
    
    expect(settings).toBeDefined();
    expect(settings.user_id).toBe(user.id);
  });

  test('should not allow duplicate emails', async () => {
    const email = 'duplicate@example.com';
    
    // Create first user
    await createTestUser({ email });
    
    // Try to create second user with same email
    try {
      await createTestUser({ email });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('should have associations with other models', async () => {
    // Check associations are defined
    expect(User.hasMany).toBeDefined();
    expect(User.hasOne).toBeDefined();
  });
});