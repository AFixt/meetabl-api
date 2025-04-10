/**
 * Jest configuration for meetabl API
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.unit.test.js',
    '**/tests/**/*.integration.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/db/migrate.js',
    '!src/index.js',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    "json", 
    "lcov", 
    "text", 
    "clover", 
    "html"
  ],
  // Current thresholds are set low as we're in the process of improving coverage
  // The target is 80% for all metrics
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 5,
      lines: 10,
      statements: 10
    }
  },
  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 4,
  moduleDirectories: ['node_modules', 'src'],
  rootDir: '.',
  globals: {
    __TEST__: true
  }
};