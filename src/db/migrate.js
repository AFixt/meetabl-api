/**
 * Database migration script
 *
 * Initializes database tables based on Sequelize models
 * Uses configuration from environment-specific settings in database.json
 *
 * @author meetabl Team
 */

require('dotenv').config();
const { sequelize, config } = require('../config/database');
const logger = require('../config/logger');

// Import all models
const models = require('../models');

// Determine migration options based on environment
const getMigrationOptions = () => {
  const env = process.env.NODE_ENV || 'development';
  
  // Default options - alter tables to match models
  const options = { alter: true };
  
  // In production, we can be more cautious by setting specific options
  if (env === 'production') {
    options.alter = false; // Don't automatically alter tables in production
    options.force = false; // Don't drop tables
    // Remove the match constraint as it was preventing migrations
  }
  
  return options;
};

/**
 * Run database migrations
 */
async function migrate() {
  try {
    const env = process.env.NODE_ENV || 'development';
    const options = getMigrationOptions();
    
    logger.info(`Starting database synchronization for ${env} environment...`);
    logger.info(`Using configuration: ${JSON.stringify(options)}`);

    // Sync all models with appropriate options
    await sequelize.sync(options);

    logger.info('Database synchronization completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during database synchronization:', error);
    process.exit(1);
  }
}

// Run migrations
migrate();
