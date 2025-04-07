/**
 * Database test fixtures
 * 
 * Provides test data and database helpers for tests
 * 
 * @author AccessMeet Team
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

// Use the test models with SQLite in-memory database
const {
  sequelize,
  User, 
  UserSettings, 
  AvailabilityRule, 
  Booking, 
  Notification,
  CalendarToken,
  AuditLog,
  initializeTestDatabase
} = require('../../src/models/test-models');

/**
 * Create test user with settings
 * @param {Object} overrides - Optional property overrides
 * @returns {Promise<Object>} Created user object
 */
const createTestUser = async (overrides = {}) => {
  const userId = uuidv4();
  const password = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    id: userId,
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password_hash: passwordHash,
    timezone: 'UTC',
    calendar_provider: 'none',
    ...overrides
  });

  // Create settings for user
  await UserSettings.create({
    id: uuidv4(),
    user_id: userId,
    accessibility_mode: false,
    notification_email: true,
    notification_sms: false
  });

  // Add the plain text password for testing
  user.rawPassword = password;
  
  return user;
};

/**
 * Create availability rule for user
 * @param {string} userId - User ID
 * @param {Object} overrides - Optional property overrides
 * @returns {Promise<Object>} Created rule object
 */
const createAvailabilityRule = async (userId, overrides = {}) => {
  return AvailabilityRule.create({
    id: uuidv4(),
    user_id: userId,
    day_of_week: 1, // Monday
    start_time: '09:00:00',
    end_time: '17:00:00',
    buffer_minutes: 15,
    max_bookings_per_day: 8,
    ...overrides
  });
};

/**
 * Create booking for user
 * @param {string} userId - User ID
 * @param {Object} overrides - Optional property overrides
 * @returns {Promise<Object>} Created booking object
 */
const createBooking = async (userId, overrides = {}) => {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() + 1);
  startTime.setMinutes(0, 0, 0);
  
  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 1);
  
  const bookingId = uuidv4();
  
  const booking = await Booking.create({
    id: bookingId,
    user_id: userId,
    customer_name: 'Test Customer',
    customer_email: 'customer@example.com',
    start_time: startTime,
    end_time: endTime,
    status: 'confirmed',
    ...overrides
  });
  
  return booking;
};

/**
 * Create notification for booking
 * @param {string} bookingId - Booking ID
 * @param {Object} overrides - Optional property overrides
 * @returns {Promise<Object>} Created notification object
 */
const createNotification = async (bookingId, overrides = {}) => {
  return Notification.create({
    id: uuidv4(),
    booking_id: bookingId,
    type: 'email',
    status: 'pending',
    ...overrides
  });
};

/**
 * Create calendar token for user
 * @param {string} userId - User ID
 * @param {string} provider - Calendar provider ('google' or 'microsoft')
 * @param {Object} overrides - Optional property overrides
 * @returns {Promise<Object>} Created token object
 */
const createCalendarToken = async (userId, provider = 'google', overrides = {}) => {
  // Set expiry date to 1 hour in the future
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  
  return CalendarToken.create({
    id: uuidv4(),
    user_id: userId,
    provider,
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: expiresAt,
    scope: 'https://www.googleapis.com/auth/calendar',
    ...overrides
  });
};

/**
 * Clear all test data
 * @returns {Promise<void>}
 */
const clearDatabase = async () => {
  await AuditLog.destroy({ where: {} });
  await Notification.destroy({ where: {} });
  await Booking.destroy({ where: {} });
  await AvailabilityRule.destroy({ where: {} });
  await CalendarToken.destroy({ where: {} });
  await UserSettings.destroy({ where: {} });
  await User.destroy({ where: {} });
};

/**
 * Setup test database
 * @returns {Promise<void>}
 */
const setupTestDatabase = async () => {
  await initializeTestDatabase();
};

module.exports = {
  createTestUser,
  createAvailabilityRule,
  createBooking,
  createNotification,
  createCalendarToken,
  clearDatabase,
  setupTestDatabase
};