/**
 * Test Database Configuration
 * Uses MySQL for testing (never SQLite!)
 */

const { Sequelize } = require('sequelize');

// Create Sequelize instance with test MySQL configuration
const sequelize = new Sequelize({
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT) || 3306,
  database: process.env.TEST_DB_NAME || 'meetabl_test',
  username: process.env.TEST_DB_USER || 'root',
  password: process.env.TEST_DB_PASSWORD || '',
  dialect: 'mysql',
  logging: false, // Disable logging in tests
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
 * Initialize test database connection
 */
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    // Silent in tests
    return sequelize;
  } catch (error) {
    console.error('Unable to connect to test database:', error);
    throw error;
  }
};

/**
 * Get current pool stats
 */
const getPoolStats = () => {
  const pool = sequelize.connectionManager.pool;
  return {
    size: pool.size,
    available: pool.available,
    using: pool.using,
    waiting: pool.waiting
  };
};

module.exports = {
  sequelize,
  Sequelize,
  initializeDatabase,
  getPoolStats,
  Op: Sequelize.Op
};