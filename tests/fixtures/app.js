/**
 * Test application setup
 * 
 * Provides app instance for integration tests
 * 
 * @author AccessMeet Team
 */

const supertest = require('supertest');
const { app, initializeApp } = require('../../src/app');
const { sequelize } = require('../../src/models/test-models');
const { generateAuthToken } = require('./mocks');
const { createTestUser } = require('./db');

/**
 * Setup test app
 * @returns {Promise<Object>} Supertest request object
 */
const setupTestApp = async () => {
  // Initialize app for testing
  await initializeApp();
  
  // Return supertest instance
  return supertest(app);
};

/**
 * Create authenticated request
 * @param {Object} user - User object
 * @returns {Object} Supertest request with auth headers
 */
const authenticatedRequest = (request, user) => {
  const token = generateAuthToken(user.id);
  return request.set('Authorization', `Bearer ${token}`);
};

/**
 * Create authenticated test user and return request
 * @param {Object} request - Supertest request object
 * @returns {Promise<Object>} User and authenticated request
 */
const createAuthUser = async (request) => {
  const user = await createTestUser();
  const authRequest = (method, url) => {
    return authenticatedRequest(request[method](url), user);
  };
  
  return {
    user,
    authRequest
  };
};

/**
 * Close database connection
 * @returns {Promise<void>}
 */
const closeDatabase = async () => {
  await sequelize.close();
};

module.exports = {
  setupTestApp,
  authenticatedRequest,
  createAuthUser,
  closeDatabase
};