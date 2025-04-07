/**
 * Jest configuration for AccessMeet API
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/db/migrate.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  clearMocks: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['./tests/fixtures/setup.js'],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};