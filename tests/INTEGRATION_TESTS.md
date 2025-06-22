# Integration Test Suite

This directory contains comprehensive integration tests for the meetabl API, covering end-to-end user workflows and system behavior under various conditions.

## Test Structure

### Test Categories

1. **Workflow Tests** (`workflows/`)
   - Complete user journeys from start to finish
   - Cross-component integration testing
   - Real-world scenario validation

2. **Unit Tests** (`unit/`)
   - Individual component testing
   - Isolated functionality validation
   - Mock-based testing

3. **Route Tests** (`integration/`)
   - HTTP endpoint testing
   - Request/response validation
   - Middleware testing

### Workflow Test Files

#### `complete-user-onboarding.test.js`
Tests the complete user onboarding experience:
- User registration with validation
- Email verification process
- Profile setup and configuration
- Availability rule creation
- Booking settings configuration
- Public booking page setup
- Error handling during onboarding

**Key Scenarios:**
- Valid user registration flow
- Email verification with tokens
- Profile updates and timezone settings
- Availability configuration for business hours
- Public booking accessibility

#### `advanced-booking-scenarios.test.js`
Tests complex booking workflows and edge cases:
- Booking conflict prevention
- Booking modifications and cancellations
- Bulk operations
- Public booking workflows
- Analytics and reporting
- Real-time updates

**Key Scenarios:**
- Double booking prevention
- Adjacent booking handling
- Reschedule operations
- Bulk cancellation
- Public booking validation
- Booking statistics and exports

#### `api-error-handling.test.js`
Comprehensive error handling validation:
- Authentication errors
- Validation errors
- Business logic errors
- Resource not found errors
- Rate limiting
- Security validation

**Key Scenarios:**
- Invalid token handling
- Input validation failures
- Permission checks
- SQL injection prevention
- XSS protection
- CORS and security headers

#### `performance-scalability.test.js`
Performance benchmarks and scalability testing:
- Response time validation
- Concurrent request handling
- Database performance
- Memory usage monitoring
- Error handling under load
- Rate limiting effectiveness

**Key Scenarios:**
- Sub-200ms authentication
- Concurrent user handling
- Database query optimization
- Memory leak detection
- Load balancing validation

## Test Setup and Configuration

### Environment Setup

Tests use the following environment configuration:

```javascript
// Automatic test environment setup
process.env.NODE_ENV = 'test';
process.env.DB_CONFIG = 'local';

// Test-specific JWT secrets
process.env.JWT_SECRET = 'TestJwtSecret123ForIntegrationTests456';
process.env.JWT_REFRESH_SECRET = 'TestJwtRefreshSecret789ForIntegrationTests012';
```

### Database Management

Each test suite:
1. Resets the database to a clean state before starting
2. Creates necessary test data
3. Cleans up connections after completion

```javascript
beforeAll(async () => {
  await utils.resetDatabase();
  // Setup test data
});

afterAll(async () => {
  await utils.cleanup();
});
```

### Test Utilities

The `setup.js` file provides:
- Database reset functionality
- Test user creation helpers
- Authentication token generation
- Test booking creation
- Team setup utilities

## Running Integration Tests

### All Integration Tests
```bash
npm run test:integration
```

### Workflow Tests Only
```bash
npm run test:workflows
```

### Individual Workflow Tests
```bash
# User onboarding flow
npm run test:workflows:onboarding

# Booking scenarios
npm run test:workflows:booking

# Error handling
npm run test:workflows:errors

# Performance testing
npm run test:workflows:performance
```

### End-to-End Test Suite
```bash
npm run test:e2e
```

## Test Data Management

### Test Users
- Multiple test users created with different roles
- Realistic data including availability rules
- Proper authentication tokens for each user

### Test Bookings
- Future-dated bookings to avoid conflicts
- Various booking statuses (confirmed, cancelled)
- Different booking types (private, public)

### Test Teams
- Team structures with different member roles
- Collaborative booking scenarios
- Permission-based access testing

## Performance Benchmarks

### Response Time Targets
- Authentication: < 200ms
- Profile retrieval: < 150ms
- Booking list: < 300ms
- Health check: < 100ms

### Concurrency Targets
- 20+ concurrent authentication requests
- 30+ concurrent booking retrievals
- Mixed operations under 5 seconds

### Memory Management
- Stable memory usage during operations
- Proper connection pool management
- No memory leaks detected

## Error Scenarios Covered

### Authentication Errors
- Missing/invalid tokens
- Expired tokens
- Wrong signatures
- Unauthorized access attempts

### Validation Errors
- Invalid email formats
- Weak passwords
- Invalid date formats
- Business rule violations

### Business Logic Errors
- Duplicate registrations
- Booking conflicts
- Past booking attempts
- Availability violations

### System Errors
- Database connection issues
- Rate limit exceeded
- Resource not found
- Server errors

## Security Testing

### Input Validation
- XSS prevention in user inputs
- SQL injection protection
- Parameter tampering prevention
- File upload security

### Authentication Security
- Token validation
- Session management
- Permission enforcement
- Cross-user access prevention

### Network Security
- CORS header validation
- Security header presence
- HTTPS enforcement
- CSP implementation

## CI/CD Integration

### Test Pipeline
1. Unit tests run first
2. Integration tests follow
3. Performance tests validate benchmarks
4. Security tests check vulnerabilities
5. Coverage reports generated

### Test Environment
- Isolated test database
- Mock external services
- Deterministic test data
- Parallel test execution

## Troubleshooting

### Common Issues

#### Test Database Issues
```bash
# Reset test database
NODE_ENV=test npm run db:migrate

# Check database connection
npm run test:workflows:onboarding
```

#### Memory Issues
```bash
# Run tests with memory monitoring
node --max-old-space-size=4096 ./node_modules/.bin/jest --forceExit
```

#### Timeout Issues
```bash
# Increase test timeout
jest --testTimeout=30000
```

### Debug Mode
```bash
# Run with debug output
DEBUG=* npm run test:workflows

# Run specific test with verbose output
npm run test:workflows:onboarding -- --verbose
```

## Best Practices

### Test Writing
1. Use descriptive test names
2. Include setup and teardown
3. Test both success and failure cases
4. Validate response structure
5. Check database state changes

### Performance Testing
1. Set realistic benchmarks
2. Test under various loads
3. Monitor resource usage
4. Validate error handling under stress
5. Test recovery scenarios

### Security Testing
1. Test authentication edge cases
2. Validate input sanitization
3. Check authorization boundaries
4. Test rate limiting
5. Verify security headers

### Maintenance
1. Keep tests up to date with API changes
2. Regular performance benchmark reviews
3. Update test data as needed
4. Monitor test execution times
5. Review and update error scenarios