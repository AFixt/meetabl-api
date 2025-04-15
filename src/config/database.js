/**
 * Database configuration for Sequelize ORM
 *
 * Configures and initializes the Sequelize connection to MySQL/MariaDB
 * Uses environment-specific configuration from database.json
 *
 * @author meetabl Team
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const logger = require('./logger');

// Load environment variables
require('dotenv').config();

// Determine current environment
const env = process.env.NODE_ENV || 'development';

// Load database configuration file
const configPath = path.join(__dirname, 'database.json');
const configTemplate = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Process environment variables in the config
const processEnvVars = (obj) => {
  const result = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'string' && value.includes('${')) {
      // Process environment variable template strings
      result[key] = value.replace(/\${([^}]+)}/g, (match, varExpr) => {
        // Support for expressions like process.env.VAR || 'default'
        return eval(varExpr); // eslint-disable-line no-eval
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = processEnvVars(value);
    } else {
      result[key] = value;
    }
  });
  return result;
};

// Get configuration for current environment
const config = processEnvVars(configTemplate[env]);

// Setup logging based on configuration
const loggingConfig = config.logging === true 
  ? (msg) => logger.debug(msg)
  : config.logging;

// Create Sequelize instance
const sequelize = new Sequelize(
  config.database,
  config.username, 
  config.password,
  {
    ...config,
    logging: loggingConfig
  }
);

/**
 * Initialize database connection
 * @returns {Promise} A promise that resolves when connection is established
 */
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info(`Database connection established successfully for ${env} environment.`);
    return sequelize;
  } catch (error) {
    logger.error(`Unable to connect to the database in ${env} environment:`, error);
    throw error;
  }
};

module.exports = {
  sequelize,
  initializeDatabase,
  config
};
