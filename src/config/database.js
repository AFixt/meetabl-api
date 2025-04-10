/**
 * Database configuration for Sequelize ORM
 *
 * Configures and initializes the Sequelize connection to MySQL/MariaDB
 *
 * @author meetabl Team
 */

const { Sequelize } = require('sequelize');
const logger = require('./logger');

// Load environment variables
require('dotenv').config();

// Database configuration
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: (msg) => logger.debug(msg),
    define: {
      timestamps: true,
      underscored: false,
      createdAt: 'created',
      updatedAt: 'updated'
    },
    dialectOptions: {
      dateStrings: true,
      typeCast: true
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

/**
 * Initialize database connection
 * @returns {Promise} A promise that resolves when connection is established
 */
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');
    return sequelize;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  initializeDatabase
};
