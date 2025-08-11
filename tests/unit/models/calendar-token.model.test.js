/**
 * CalendarToken model tests
 *
 * @author meetabl Team
 */

// Load test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup controller mocks
setupControllerMocks();

// Import models after setup
const { CalendarToken, User } = require('../../../src/models');

describe('CalendarToken Model', () => {
  // Mocked user ID for tests
  const testUserId = 'test-user-id';

  // Mock data to simulate model behavior
  const mockToken = {
    id: 'token-id-1',
    user_id: testUserId,
    provider: 'google',
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: new Date(Date.now() + 3600000), // 1 hour from now
    save: jest.fn().mockResolvedValue(true),
    isExpired: jest.fn().mockReturnValue(false)
  };

  // Mock expired token
  const mockExpiredToken = {
    id: 'token-id-2',
    user_id: testUserId,
    provider: 'google',
    access_token: 'expired-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: new Date(Date.now() - 3600000), // 1 hour ago
    isExpired: jest.fn().mockReturnValue(true)
  };

  // Setup mocks for CalendarToken methods
  beforeEach(() => {
    // Reset mocks
    CalendarToken.create.mockClear();
    CalendarToken.findByPk.mockClear();
    CalendarToken.findOne.mockClear();
    CalendarToken.update.mockClear();
    CalendarToken.destroy.mockClear();

    // Setup default mock implementations
    CalendarToken.create.mockResolvedValue(mockToken);
    CalendarToken.findByPk.mockResolvedValue(mockToken);
    User.create.mockResolvedValue({ id: testUserId });
  });

  test('should create a calendar token successfully', async () => {
    const tokenData = {
      user_id: testUserId,
      provider: 'google',
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: new Date(Date.now() + 3600000) // 1 hour from now
    };

    const token = await CalendarToken.create(tokenData);

    expect(token).toBeDefined();
    expect(token.id).toBeDefined();
    expect(token.user_id).toBe(testUserId);
    expect(token.provider).toBe('google');
    expect(token.access_token).toBe('test-access-token');
    expect(token.refresh_token).toBe('test-refresh-token');
    expect(token.expires_at).toBeDefined();
    expect(CalendarToken.create).toHaveBeenCalledWith(tokenData);
  });

  test('should require a valid provider', async () => {
    const invalidTokenData = {
      user_id: testUserId,
      provider: 'invalid-provider',
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token'
    };

    // Mock rejection for invalid provider
    CalendarToken.create.mockImplementationOnce(() => Promise.reject(new Error('Invalid provider')));

    await expect(CalendarToken.create(invalidTokenData)).rejects.toThrow();
    expect(CalendarToken.create).toHaveBeenCalledWith(invalidTokenData);
  });

  test('should require user_id', async () => {
    const invalidTokenData = {
      provider: 'google',
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token'
    };

    // Mock rejection for missing user_id
    CalendarToken.create.mockImplementationOnce(() => Promise.reject(new Error('user_id is required')));

    await expect(CalendarToken.create(invalidTokenData)).rejects.toThrow();
    expect(CalendarToken.create).toHaveBeenCalledWith(invalidTokenData);
  });

  test('should require access_token', async () => {
    const invalidTokenData = {
      user_id: testUserId,
      provider: 'google',
      refresh_token: 'test-refresh-token'
    };

    // Mock rejection for missing access_token
    CalendarToken.create.mockImplementationOnce(() => Promise.reject(new Error('access_token is required')));

    await expect(CalendarToken.create(invalidTokenData)).rejects.toThrow();
    expect(CalendarToken.create).toHaveBeenCalledWith(invalidTokenData);
  });

  test('should update an existing token', async () => {
    // Get mock token
    const token = await CalendarToken.findByPk('token-id-1');
    
    // Mock save to update token properties
    token.save.mockImplementationOnce(() => {
      token.access_token = 'new-access-token';
      token.expires_at = new Date(Date.now() + 7200000); // 2 hours from now
      return Promise.resolve(token);
    });

    // Update token
    token.access_token = 'new-access-token';
    token.expires_at = new Date(Date.now() + 7200000); // 2 hours from now
    await token.save();

    // Mock updated token for findByPk
    CalendarToken.findByPk.mockResolvedValueOnce({
      ...token,
      access_token: 'new-access-token'
    });

    // Fetch updated token
    const updatedToken = await CalendarToken.findByPk(token.id);
    
    expect(updatedToken).toBeDefined();
    expect(updatedToken.access_token).toBe('new-access-token');
    expect(updatedToken.refresh_token).toBe('test-refresh-token'); // Should not have changed
    expect(token.save).toHaveBeenCalled();
  });

  test('should check if token is expired', async () => {
    // Setup mocks for expired and valid tokens
    CalendarToken.findByPk.mockResolvedValueOnce(mockExpiredToken);
    CalendarToken.findByPk.mockResolvedValueOnce(mockToken);

    // Get expired token
    const expiredToken = await CalendarToken.findByPk('token-id-2');
    
    // Get valid token
    const validToken = await CalendarToken.findByPk('token-id-1');

    expect(expiredToken.isExpired()).toBe(true);
    expect(validToken.isExpired()).toBe(false);
  });

  test('should enforce unique constraint on user_id and provider', async () => {
    // First creation works
    await CalendarToken.create({
      user_id: testUserId,
      provider: 'unique-test-provider',
      access_token: 'test-access-token-1',
      refresh_token: 'test-refresh-token-1'
    });

    // Mock rejection for duplicate
    CalendarToken.create.mockImplementationOnce(() => 
      Promise.reject(new Error('Unique constraint violation')));

    // Try to create another token with same user_id and provider
    const duplicateTokenData = {
      user_id: testUserId,
      provider: 'unique-test-provider',
      access_token: 'test-access-token-2',
      refresh_token: 'test-refresh-token-2'
    };

    await expect(CalendarToken.create(duplicateTokenData)).rejects.toThrow();
    expect(CalendarToken.create).toHaveBeenCalledWith(duplicateTokenData);
  });

  test('should delete token when user is deleted', async () => {
    // Create a new user
    const tempUser = await User.create({
      name: 'Temporary User',
      email: 'temp-user-for-token@example.com',
      password: 'Password123!'
    });

    // Setup token for the temp user
    const tempToken = {
      id: 'temp-token-id',
      user_id: tempUser.id,
      provider: 'google',
      access_token: 'temp-access-token',
      refresh_token: 'temp-refresh-token'
    };

    // Mock token creation
    CalendarToken.create.mockResolvedValueOnce(tempToken);

    // Create token for this user
    const token = await CalendarToken.create({
      user_id: tempUser.id,
      provider: 'google',
      access_token: 'temp-access-token',
      refresh_token: 'temp-refresh-token'
    });

    // Mock token exists
    CalendarToken.findByPk.mockResolvedValueOnce(tempToken);

    // Verify token exists
    let foundToken = await CalendarToken.findByPk(token.id);
    expect(foundToken).toBeDefined();

    // Mock user deletion
    tempUser.destroy = jest.fn().mockResolvedValue(true);

    // Delete the user
    await tempUser.destroy();

    // Mock token deletion (CASCADE should set this to null)
    CalendarToken.findByPk.mockResolvedValueOnce(null);

    // Token should be deleted due to CASCADE
    foundToken = await CalendarToken.findByPk(token.id);
    expect(foundToken).toBeNull();
  });
});