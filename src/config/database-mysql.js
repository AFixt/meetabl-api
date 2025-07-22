/**
 * MySQL Database Configuration
 * Uses environment variables for all database settings
 */

const { Sequelize } = require('sequelize');
const logger = require('./logger');

// Load environment variables
require('dotenv').config();

// Create Sequelize instance with MySQL configuration
const sequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'meetabl_dev',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  dialect: 'mysql',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: false,
    underscored: true,
    freezeTableName: true
  }
});

/**
 * Initialize database connection
 */
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info(`MySQL connection established successfully to ${process.env.DB_NAME}`);
    
    // Sync database schema (create tables if they don't exist)
    // Disabled auto-sync due to "Too many keys" error
    // Run migrations manually instead
    if (false && process.env.NODE_ENV === 'development') {
      logger.info('Syncing database schema...');
      await sequelize.sync({ alter: true });
      logger.info('Database schema synchronized');
    }
    
    return sequelize;
  } catch (error) {
    logger.error('Unable to connect to MySQL database:', error);
    throw error;
  }
};

/**
 * Get connection pool statistics
 */
const getPoolStats = () => {
  if (sequelize.connectionManager && sequelize.connectionManager.pool) {
    const pool = sequelize.connectionManager.pool;
    return {
      size: pool.size || 0,
      available: pool.available || 0,
      using: pool.using || 0,
      waiting: pool.pending || 0
    };
  }
  return {
    size: 0,
    available: 0,
    using: 0,
    waiting: 0
  };
};

module.exports = {
  sequelize,
  initializeDatabase,
  getPoolStats,
  Op: Sequelize.Op
};