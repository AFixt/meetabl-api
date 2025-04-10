# meetabl API Test Suite

This directory contains tests for the meetabl API.

## Recent Updates to Test Suite

We've completely overhauled the test suite to fix failing tests and improve the testing experience:

1. Created a robust mocking system
2. Added global test utilities
3. Standardized test setups for consistency
4. Added proper isolation between tests

## Test Structure

The test suite is organized into the following sections:

- **Unit Tests** (`tests/unit/`): Tests individual components in isolation
  - `models/`: Tests database models
  - `controllers/`: Tests API controllers
  - `services/`: Tests service functions
  - `middlewares/`: Tests middleware functions

- **Integration Tests** (`tests/integration/`): Tests how components work together
  - `routes/`: Tests API routes and endpoints

- **Fixtures and Helpers** (`tests/fixtures/`): Provides test data and utilities
  - `db.js`: Database fixtures and helpers
  - `mocks.js`: Mock functions for testing
  - `test-helper.js`: Shared test utilities 
  - `setup.js`: Global test setup

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Types

```bash
# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run model tests only
npm run test:models

# Run controller tests only
npm run test:controllers

# Run service tests only
npm run test:services

# Run middleware tests only
npm run test:middlewares

# Run route tests only
npm run test:routes
```

### Single Test File

```bash
npx jest path/to/test.test.js
```

### Tests for Specific Component

```bash
npm run test:unit -- -t 'Auth Middleware'
```

### Test Coverage

```bash
npm run test:coverage
```

## Using the New Test Framework

### 1. Importing the Test Setup

Start each test file with:

```javascript
// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import the component under test AFTER setup
const { myFunction } = require('../../../src/path/to/component');
```

### 2. Creating Test Objects

Use the global utilities for consistent test objects:

```javascript
// Create request, response, and next
const req = createMockRequest({
  body: { name: 'Test' },
  user: { id: 'user-123' }
});
const res = createMockResponse();
const next = createMockNext();
```

### 3. Mocking Dependencies

Customize mocks for specific test cases:

```javascript
// Override a model method for a specific test
const { User } = require('../../../src/models');
User.findOne.mockResolvedValueOnce(null); // User not found scenario
```

## Test Database

Tests use an in-memory SQLite database for model tests when needed. This database is recreated for each test run.

For controller and middleware tests, all database methods are mocked to avoid actual database connections.

## Troubleshooting Tests

If you encounter test failures:

1. **Timing issues**: Try increasing the timeout in individual tests with `jest.setTimeout(30000)`
2. **Database connection errors**: Make sure SQLite is installed and working correctly
3. **Mock issues**: Check that you're using `mockResolvedValueOnce()` instead of `mockResolvedValue()` for one-time mocks

## Adding New Tests

1. Create a new file with `.unit.test.js` extension (for unit tests) or `.integration.test.js` (for integration tests)
2. Follow the patterns in existing test files
3. Import the test setup
4. Focus on testing one component at a time
5. Use descriptive test names that explain the expected behavior