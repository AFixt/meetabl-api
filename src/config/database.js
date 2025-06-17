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

// Check if we should use local SQLite configuration
if (process.env.DB_CONFIG === 'local') {
  const localConfig = require('./database-local');
  const config = localConfig[env];
  
  // Setup enhanced logging with query monitoring
  const loggingConfig = config.logging === true 
    ? (msg, timing) => {
        if (timing && timing > 1000) { // Log slow queries (>1s)
          logger.warn(`Slow query detected (${timing}ms): ${msg}`);
        } else if (env === 'development') {
          logger.debug(`Query (${timing}ms): ${msg}`);
        }
      }
    : config.logging;

  // Create Sequelize instance for local development
  const sequelize = new Sequelize({
    ...config,
    logging: loggingConfig
  });

  /**
   * Initialize database connection
   * @returns {Promise} A promise that resolves when connection is established
   */
  const initializeDatabase = async () => {
    try {
      await sequelize.authenticate();
      logger.info(`Database connection established successfully for ${env} environment (SQLite).`);
      return sequelize;
    } catch (error) {
      logger.error(`Unable to connect to the database in ${env} environment:`, error);
      throw error;
    }
  };

  module.exports = {
    sequelize,
    Op: Sequelize.Op,
    initializeDatabase,
    config
  };
}

// Load database configuration file for MySQL
const configPath = path.join(__dirname, 'database.json');
const configTemplate = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Process environment variables in the config
const processEnvVars = (obj) => {
  const result = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'string' && value.includes('${')) {
      // Process environment variable template strings
      result[key] = value.replace(/\${([^}]+)}/g, (match, varExpr) => {
        // Parse expressions like "process.env.VAR || 'default'"
        const parts = varExpr.split('||').map(p => p.trim());
        
        for (const part of parts) {
          // Handle process.env.VAR
          if (part.startsWith('process.env.')) {
            const envVar = part.substring('process.env.'.length);
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
              return envValue;
            }
          }
          // Handle numeric literals
          else if (/^\d+$/.test(part)) {
            return part;
          }
          // Handle string literals
          else if (/^['"](.*)['"]$/.test(part)) {
            return part.slice(1, -1);
          }
          // Handle boolean comparisons for SSL
          else if (part === "process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'") {
            return process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
          }
        }
        
        // Return empty string if no valid value found
        return '';
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
