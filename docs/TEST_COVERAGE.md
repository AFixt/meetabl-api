# Test Coverage

This document outlines the test coverage for the AccessMeet API project. It includes information about code coverage metrics, test strategies, and areas of the codebase that are well-tested versus those that need additional test coverage.

## Coverage Overview

AccessMeet API uses Jest for unit and integration testing. The project aims to maintain a minimum code coverage threshold of 80% across branches, functions, lines, and statements.

To run the coverage reports:

```bash
# Run all tests with coverage summary
npm run test:coverage

# Run with detailed text output
npm run test:coverage:detail

# Generate HTML report
npm run test:coverage:html
```

After running the HTML coverage report, you can view it by opening the `coverage/index.html` file in a browser.

## Current Coverage 

The latest test coverage metrics are displayed below:

| Category   | Current | Target |
|------------|---------|--------|
| Branches  | 30.92% | 80%    |
| Functions | 20.51% | 80%    |
| Lines     | 27.18% | 80%    |
| Statements | 27.19% | 80%    |

> **Note**: The current coverage is low because we've recently migrated from integration tests to unit tests with proper mocking. We are actively working on improving test coverage.

## Coverage Badges

![Statements](badges/badge-statements.svg)
![Branches](badges/badge-branches.svg)
![Functions](badges/badge-functions.svg)
![Lines](badges/badge-lines.svg)

## Test Strategy

The AccessMeet API project follows these testing principles:

1. **Unit Tests**: Focused on testing individual components (models, controllers, services, utilities) in isolation
2. **Mocking**: External dependencies are mocked to ensure tests are focused and do not rely on external services
3. **Test Organization**: Tests are organized to mirror the source code structure

### Test Structure

- `tests/unit/models/`: Tests for database models
- `tests/unit/controllers/`: Tests for API controllers
- `tests/unit/services/`: Tests for business logic services
- `tests/unit/middlewares/`: Tests for Express middlewares
- `tests/unit/utils/`: Tests for utility functions

## Improving Test Coverage

We are working to improve our test coverage to reach our target of 80% across all metrics. The key priorities are:

1. **Controllers**: Add unit tests for all controller methods
2. **Models**: Create unit tests for model methods and validators
3. **Services**: Test service functions, especially calendar and notification
4. **Routes**: Ensure route configuration is tested

When adding new features or making changes to existing code, follow these guidelines:

1. Write tests first (TDD approach) or immediately after implementing a feature
2. Ensure all critical path logic has test coverage
3. Focus on testing edge cases and error handling paths
4. Use the coverage reports to identify areas with insufficient coverage

### Priority Areas for Coverage Improvement

Based on current coverage analysis, these components need the most testing:

| Component              | Current Coverage | Priority |
|------------------------|------------------|----------|
| Controllers            | ~13%             | High     |
| Models                 | ~0%              | High     |
| Services               | ~0%              | High     |
| Routes                 | ~0%              | Medium   |
| Config                 | ~39%             | Low      |

The middlewares are well-tested (~95%) and should be used as examples for testing other components.

## Continuous Integration

Test coverage reports are generated as part of the CI pipeline. Coverage thresholds are enforced to maintain code quality.

## Adding More Tests

If you're adding tests to the project, consider:

1. Does the test isolate a specific functionality?
2. Are dependencies properly mocked?
3. Does the test cover success and error paths?
4. Is the test maintainable and not overly coupled to implementation details?

## Excluded from Coverage

Some files and directories are intentionally excluded from coverage metrics:

- `src/db/migrate.js` - Database migration scripts
- `src/index.js` - Main application entry point
- `node_modules/` - External dependencies
- `vendor/` - Third-party code