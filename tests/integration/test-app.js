/**
 * Test app initialization helper
 * 
 * Provides a properly initialized app instance for integration tests
 */

const { initializeApp } = require('../../src/app');
const { sequelize } = require('../../src/config/database');

let testApp;

const getTestApp = async () => {
  if (!testApp) {
    // Ensure database is synced before initializing app
    try {
      await sequelize.authenticate();
      console.log('Test database connection successful');
      
      // Force sync all models for test environment
      await sequelize.sync({ force: true });
      console.log('Test database synced');
      
      testApp = await initializeApp();
      console.log('Test app initialized');
    } catch (error) {
      console.error('Failed to initialize test app:', error);
      throw error;
    }
  }
  return testApp;
};

module.exports = { getTestApp };