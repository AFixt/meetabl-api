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
    'json',
    'json-summary',
    'lcov',
    'text',
    'text-summary',
    'clover',
    'html',
    'cobertura'
  ],
  // Progressive coverage thresholds - gradually increasing targets
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 65,
      statements: 65
    },
    // Higher thresholds for critical components
    './src/controllers/**/*.js': {
      branches: 70,
      functions: 80,
      lines: 75,
      statements: 75
    },
    './src/services/**/*.js': {
      branches: 75,
      functions: 85,
      lines: 80,
      statements: 80
    },
    './src/models/**/*.js': {
      branches: 65,
      functions: 75,
      lines: 70,
      statements: 70
    }
  },
  clearMocks: true,
  testTimeout: 30000, // Increased for E2E tests
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  // Optimized parallel execution
  maxWorkers: process.env.CI ? '50%' : '75%', // Use fewer workers in CI
  maxConcurrency: 10, // Limit concurrent tests per worker
  workerIdleMemoryLimit: '1GB', // Prevent memory leaks
  // Test sequencing for better parallelization
  testSequencer: './tests/fixtures/test-sequencer.js',
  // Setup files for parallel execution
  setupFilesAfterEnv: ['<rootDir>/tests/fixtures/setup.js'],
  moduleDirectories: ['node_modules', 'src'],
  rootDir: '.',
  globals: {
    __TEST__: true
  }
};
