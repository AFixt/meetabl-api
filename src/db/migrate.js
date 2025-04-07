/**
 * Database migration script
 *
 * Initializes database tables based on Sequelize models
 *
 * @author AccessMeet Team
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

// Import all models
const models = require('../models');

/**
 * Run database migrations
 */
async function migrate() {
  try {
    logger.info('Starting database synchronization...');

    // Sync all models
    await sequelize.sync({ alter: true });

    logger.info('Database synchronization completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during database synchronization:', error);
    process.exit(1);
  }
}

// Run migrations
migrate();
