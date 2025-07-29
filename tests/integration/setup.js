/**
 * Integration Test Setup
 *
 * Common setup and utilities for integration tests
 *
 * @author meetabl Team
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_CONFIG = 'local';

// Set required environment variables
process.env.JWT_SECRET = 'TestJwtSecret123ForIntegrationTests456';
process.env.JWT_REFRESH_SECRET = 'TestJwtRefreshSecret789ForIntegrationTests012';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Email config
process.env.EMAIL_FROM = 'test@meetabl.com';
process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@meetabl.com';
process.env.EMAIL_PASS = 'test-password';

// Twilio config
process.env.TWILIO_ACCOUNT_SID = 'test-twilio-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';

// AWS config
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_S3_BUCKET = 'test-bucket';

// Stripe config
process.env.STRIPE_SECRET_KEY = 'sk_test_1234567890';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_1234567890';

// Import dependencies
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Test database setup
const { sequelize } = require('../../src/config/database');
const { 
  User, 
  Booking, 
  AvailabilityRule, 
  Team, 
  TeamMember,
  Notification,
  RefreshToken,
  CalendarToken,
  UserSettings
} = require('../../src/models');

/**
 * Reset database to clean state
 */
const resetDatabase = async () => {
  try {
    // Drop all tables and recreate
    await sequelize.sync({ force: true });
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
};

/**
 * Create a test user with all related data
 */
const createTestUser = async (userData = {}) => {
  const defaultData = {
    firstName: 'Test',
    lastName: 'User',
    email: `test${Date.now()}@example.com`,
    password: await bcrypt.hash('password123', 10),
    timezone: 'America/New_York',
    email_verified: true,
    role: 'user',
    status: 'active'
  };

  const user = await User.create({ ...defaultData, ...userData });

  // Create default availability rules
  const daysOfWeek = [1, 2, 3, 4, 5]; // Monday to Friday
  for (const day of daysOfWeek) {
    await AvailabilityRule.create({
      userId: user.id,
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '17:00'
    });
  }

  // Create user settings
  await UserSettings.create({
    userId: user.id,
    bookingSlotDuration: 30,
    bufferTime: 15,
    maxAdvanceBookingDays: 90,
    minAdvanceBookingHours: 24,
    isPubliclyBookable: true
  });

  return user;
};

/**
 * Generate auth tokens for a user
 */
const generateAuthTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

/**
 * Create a test booking
 */
const createTestBooking = async (userId, bookingData = {}) => {
  const defaultData = {
    userId,
    title: 'Test Meeting',
    description: 'Test meeting description',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
    status: 'confirmed',
    customer_name: 'Test Attendee',
    customer_email: 'attendee@example.com',
    customer_phone: '+1234567890',
    location: 'Virtual',
    meeting_url: 'https://meet.example.com/test',
    notes: 'Test notes'
  };

  return await Booking.create({ ...defaultData, ...bookingData });
};

/**
 * Create a test team with members
 */
const createTestTeam = async (ownerId, members = []) => {
  const team = await Team.create({
    name: 'Test Team',
    description: 'Test team description',
    ownerId
  });

  // Add owner as admin
  await TeamMember.create({
    teamId: team.id,
    userId: ownerId,
    role: 'admin'
  });

  // Add other members
  for (const member of members) {
    await TeamMember.create({
      teamId: team.id,
      userId: member.userId,
      role: member.role || 'member'
    });
  }

  return team;
};

/**
 * Wait for async operations to complete
 */
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Clean up after tests
 */
const cleanup = async () => {
  // Close database connection
  await sequelize.close();
};

module.exports = {
  request,
  sequelize,
  models: {
    User,
    Booking,
    AvailabilityRule,
    Team,
    TeamMember,
    Notification,
    RefreshToken,
    CalendarToken,
    UserSettings
  },
  utils: {
    resetDatabase,
    createTestUser,
    generateAuthTokens,
    createTestBooking,
    createTestTeam,
    waitFor,
    cleanup,
    uuidv4,
    bcrypt,
    jwt
  }
};