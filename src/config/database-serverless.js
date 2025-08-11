/**
 * Serverless Database configuration for Sequelize ORM
 *
 * Configures Sequelize connection for AWS Lambda environment
 * Optimized for connection pooling and serverless constraints
 *
 * @author meetabl Team
 */

const { Sequelize } = require('sequelize');
const logger = require('./logger');

// Load environment variables
require('dotenv').config();

// Determine current environment
const env = process.env.NODE_ENV || 'development';

// Connection pool configuration optimized for Lambda
const getPoolConfig = (environment) => {
  switch (environment) {
    case 'production':
      return {
        max: 2,          // Maximum 2 connections per Lambda instance
        min: 0,          // No minimum connections
        acquire: 30000,  // 30 seconds to acquire connection
        idle: 5000,      // Close connection after 5 seconds of inactivity
        evict: 5000,     // Check for idle connections every 5 seconds
        handleDisconnects: true
      };
    case 'staging':
      return {
        max: 2,
        min: 0,
        acquire: 30000,
        idle: 10000,
        evict: 10000,
        handleDisconnects: true
      };
    default: // development/test
      return {
        max: 5,
        min: 0,
        acquire: 60000,
        idle: 10000,
        evict: 10000,
        handleDisconnects: true
      };
  }
};

// Database configuration for serverless environment
const config = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  dialectOptions: {
    charset: 'utf8mb4',
    timeout: 60000,
    acquireTimeout: 60000,
    reconnect: true,
    // Enable SSL for RDS
    ssl: env === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  },
  pool: getPoolConfig(env),
  logging: env === 'development' ? (msg) => logger.debug(msg) : false,
  timezone: '+00:00',
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    timestamps: true,
    underscored: true,
    freezeTableName: true
  },
  // Retry configuration for serverless
  retry: {
    max: 3,
    timeout: 5000,
    match: [
      /ECONNRESET/,
      /ENOTFOUND/,
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /EPIPE/,
      /PROTOCOL_CONNECTION_LOST/,
      /PROTOCOL_ENQUEUE_AFTER_QUIT/,
      /PROTOCOL_ENQUEUE_AFTER_DESTROY/,
      /PROTOCOL_ENQUEUE_HANDSHAKE_TWICE/,
      /ER_CON_COUNT_ERROR/,
      /ER_TOO_MANY_CONNECTIONS/
    ]
  }
};

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Create Sequelize instance with serverless optimizations
const sequelize = new Sequelize(config);

// Global connection instance for reuse across Lambda invocations
let connectionPromise = null;

/**
 * Initialize database connection with connection reuse
 * Optimized for AWS Lambda cold starts
 * @returns {Promise<Sequelize>} Sequelize instance
 */
const initializeDatabase = async () => {
  // Reuse existing connection if available
  if (connectionPromise) {
    try {
      await connectionPromise;
      // Test if connection is still alive
      await sequelize.authenticate();
      logger.debug('Reusing existing database connection');
      return sequelize;
    } catch (error) {
      logger.warn('Existing connection failed, creating new one:', error.message);
      connectionPromise = null;
    }
  }

  // Create new connection
  connectionPromise = (async () => {
    try {
      await sequelize.authenticate();
      logger.info(`Database connection established for ${env} environment`);
      
      // Setup connection event handlers - only if connectionManager supports events
      if (sequelize.connectionManager && typeof sequelize.connectionManager.on === 'function') {
        sequelize.connectionManager.on('connect', () => {
          logger.debug('Database connection established');
        });
        
        sequelize.connectionManager.on('disconnect', () => {
          logger.debug('Database connection disconnected');
        });
        
        sequelize.connectionManager.on('error', (error) => {
          logger.error('Database connection error:', error);
        });
      } else {
        logger.debug('Connection manager event handlers not available in serverless environment');
      }

      return sequelize;
    } catch (error) {
      logger.error(`Unable to connect to database in ${env} environment:`, error);
      connectionPromise = null;
      throw error;
    }
  })();

  await connectionPromise;
  return sequelize;
};

/**
 * Close database connection
 * Should be called when Lambda execution is complete
 */
const closeDatabase = async () => {
  try {
    if (sequelize) {
      await sequelize.close();
      logger.debug('Database connection closed');
    }
    connectionPromise = null;
  } catch (error) {
    logger.warn('Error closing database connection:', error);
  }
};

/**
 * Get database health status
 * @returns {Promise<Object>} Health status
 */
const getHealthStatus = async () => {
  try {
    await sequelize.authenticate();
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      environment: env
    };
  }
};

module.exports = {
  sequelize,
  initializeDatabase,
  closeDatabase,
  getHealthStatus,
  config
};