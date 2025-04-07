# Testing Documentation

This directory contains tests for the AccessMeet API.

## Test Structure

The test suite is organized into the following sections:

- **Unit Tests** (`tests/unit/`): Tests individual components in isolation
  - `models/`: Tests database models
  - `controllers/`: Tests API controllers
  - `services/`: Tests service functions
  - `middlewares/`: Tests middleware functions

- **Integration Tests** (`tests/integration/`): Tests how components work together
  - `routes/`: Tests API routes and endpoints

- **Fixtures** (`tests/fixtures/`): Provides test data and utilities
  - `db.js`: Database fixtures and helpers
  - `mocks.js`: Mock functions for testing
  - `setup.js`: Global test setup
  - `app.js`: Test application setup for integration tests

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

### Test Coverage

```bash
npm run test:coverage
```

## Writing Tests

### Unit Tests

- Focus on testing a single unit of functionality
- Mock dependencies
- Assert on specific behavior

Example:

```javascript
describe('User Model', () => {
  test('should create a user successfully', async () => {
    const user = await createTestUser();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
  });
});
```

### Integration Tests

- Test how components work together
- Use supertest for API route testing
- Assert on HTTP responses

Example:

```javascript
describe('POST /api/auth/login', () => {
  test('should login successfully with valid credentials', async () => {
    const response = await request
      .post('/api/auth/login')
      .send({
        email: 'user@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

## Test Database

Tests use an in-memory SQLite database to avoid affecting the development or production databases. This database is recreated for each test suite.

Note: Make sure you have sqlite3 package installed:

```bash
npm install --save-dev sqlite3
```

This is required for running the tests.

## Fixtures

- `createTestUser()`: Creates a test user
- `createBooking()`: Creates a test booking
- `createAvailabilityRule()`: Creates a test availability rule
- `mockRequest()` and `mockResponse()`: Create mock Express objects
- `setupTestApp()`: Sets up supertest instance for API testing