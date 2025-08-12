/**
 * Database seeder script
 *
 * Populates the database with initial data for development and testing
 *
 * @author meetabl Team
 */

require('dotenv').config();
const { sequelize, config } = require('../config/database');
const logger = require('../config/logger');
const models = require('../models');

// Sample data for seeding
const seedData = {
  users: [
    {
      email: 'admin@example.com',
      password: 'password123', // Will be hashed before insertion
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      status: 'active',
      email_verified: true // Set as verified for demo user
    },
    {
      email: 'user@example.com',
      password: 'password123', // Will be hashed before insertion
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      status: 'active',
      email_verified: true // Set as verified for demo user
    }
  ],
  availabilityRules: [
    {
      userId: 1, // Will be linked to first user
      dayOfWeek: 1, // Monday
      startTime: '09:00:00',
      endTime: '17:00:00',
      isAvailable: true
    },
    {
      userId: 1, // Will be linked to first user
      dayOfWeek: 2, // Tuesday
      startTime: '09:00:00',
      endTime: '17:00:00',
      isAvailable: true
    }
  ],
  userSettings: [
    {
      userId: 1,
      meetingDuration: 30,
      bufferTime: 15,
      timezone: 'America/New_York',
      notificationPreferences: JSON.stringify({ email: true, sms: false })
    }
  ]
};

/**
 * Seed the database with initial data
 */
async function seed() {
  try {
    const env = process.env.NODE_ENV || 'development';
    
    // Only allow seeding in development or test environments
    if (env === 'production') {
      logger.error('Seeding is not allowed in production environment');
      process.exit(1);
    }
    
    logger.info(`Starting database seeding for ${env} environment...`);
    
    // Create users
    logger.info('Seeding users...');
    for (const userData of seedData.users) {
      const [user, created] = await models.User.findOrCreate({
        where: { email: userData.email },
        defaults: userData
      });
      
      if (created) {
        logger.info(`Created user: ${userData.email}`);
      } else {
        logger.info(`User already exists: ${userData.email}`);
      }
    }
    
    // Create availability rules
    logger.info('Seeding availability rules...');
    for (const ruleData of seedData.availabilityRules) {
      const user = await models.User.findOne({ where: { id: ruleData.userId } });
      if (user) {
        const [rule, created] = await models.AvailabilityRule.findOrCreate({
          where: {
            userId: ruleData.userId,
            dayOfWeek: ruleData.dayOfWeek
          },
          defaults: ruleData
        });
        
        if (created) {
          logger.info(`Created availability rule for user ${ruleData.userId} on day ${ruleData.dayOfWeek}`);
        } else {
          logger.info(`Availability rule already exists for user ${ruleData.userId} on day ${ruleData.dayOfWeek}`);
        }
      }
    }
    
    // Create user settings
    logger.info('Seeding user settings...');
    for (const settingsData of seedData.userSettings) {
      const user = await models.User.findOne({ where: { id: settingsData.userId } });
      if (user) {
        const [settings, created] = await models.UserSettings.findOrCreate({
          where: { userId: settingsData.userId },
          defaults: settingsData
        });
        
        if (created) {
          logger.info(`Created settings for user ${settingsData.userId}`);
        } else {
          logger.info(`Settings already exist for user ${settingsData.userId}`);
        }
      }
    }
    
    logger.info('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during database seeding:', error);
    process.exit(1);
  }
}

// Run seeder
seed();