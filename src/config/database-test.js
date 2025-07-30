/**
 * Test Database Configuration
 *
 * SQLite in-memory database configuration for testing
 *
 * @author meetabl Team
 */

const { Sequelize } = require('sequelize');
const path = require('path');

// Create test database connection
let sequelize;

if (process.env.NODE_ENV === 'test') {
  // Use SQLite for tests
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || ':memory:',
    logging: false, // Disable logging for tests
    define: {
      timestamps: true,
      underscored: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  throw new Error('This configuration should only be used in test environment');
}

// Connection pool stats
const getPoolStats = () => {
  if (sequelize && sequelize.connectionManager && sequelize.connectionManager.pool) {
    const pool = sequelize.connectionManager.pool;
    return {
      size: pool.size,
      available: pool.available,
      using: pool.using,
      waiting: pool.waiting
    };
  }
  return {
    size: 0,
    available: 0,
    using: 0,
    waiting: 0
  };
};

// Initialize database connection
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Test database connection established successfully.');
    
    // Sync all models in test environment
    await sequelize.sync({ force: true });
    console.log('Test database schema synced.');
    
    return sequelize;
  } catch (error) {
    console.error('Unable to connect to the test database:', error);
    throw error;
  }
};

// Export configuration
module.exports = {
  sequelize,
  initializeDatabase,
  getPoolStats
};