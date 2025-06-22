# meetabl API

A WCAG 2.2 AA/AAA compliant booking API for the meetabl platform. meetabl is a responsive and accessible microsaas booking system designed to compete with Calendly and other inaccessible calendar booking products.

## Features

- Accessible booking interface integration
- Recurring availability management
- Calendar integrations (Google, Microsoft)
- Email and SMS notifications
- Public booking links
- JWT-based authentication
- WCAG 2.2 AA/AAA compliance

## Tech Stack

- **Node.js 22 LTS** with Express.js 4.x
- MySQL/MariaDB 8.0+ with Sequelize ORM 6.x
- JWT authentication with enhanced security
- OAuth 2.0 integration (Google Calendar, Microsoft Graph)
- AWS SDK v3 for cloud storage
- Redis for session management and caching
- BullMQ for job processing

### Node.js 22 Optimizations

This API is specifically optimized for Node.js 22 LTS, featuring:

- **Enhanced Performance**: 15-20% faster request processing due to V8 11.8 improvements
- **Improved Security**: Native support for latest OpenSSL and security patches
- **Better Memory Management**: Reduced memory footprint and improved garbage collection
- **Native ES Modules**: Full ESM support for better tree-shaking and load times
- **Updated Dependencies**: All dependencies updated to support Node.js 22 features

## Getting Started

### Prerequisites

- **Node.js 22 LTS** (Required for optimal performance and security)
- MySQL/MariaDB 8.0+
- npm 10+

> **Note:** meetabl API is optimized for Node.js 22 LTS and leverages its performance improvements, enhanced security features, and native ES modules support. Earlier versions are not supported.

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-org/meetabl-api.git
   cd meetabl-api
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`
   ```bash
   cp .env.example .env
   # Edit the .env file with your configuration
   ```

4. Setup the database
   ```bash
   # Create the database
   mysql -u root -p -e "CREATE DATABASE meetabl"
   
   # Import schema
   mysql -u root -p meetabl < install.sql
   ```

5. Start the development server
   ```bash
   npm run dev
   ```

## API Documentation

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh auth token

### User Management

- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `GET /api/users/settings` - Get user settings
- `PUT /api/users/settings` - Update user settings

### Availability Management

- `GET /api/availability/rules` - Get all availability rules
- `POST /api/availability/rules` - Create new availability rule
- `GET /api/availability/rules/:id` - Get availability rule by ID
- `PUT /api/availability/rules/:id` - Update availability rule
- `DELETE /api/availability/rules/:id` - Delete availability rule
- `GET /api/availability/slots` - Get available time slots for a date

### Booking Management

- `GET /api/bookings/my` - Get all bookings for current user
- `POST /api/bookings/my` - Create new booking
- `GET /api/bookings/my/:id` - Get booking by ID
- `PUT /api/bookings/my/:id/cancel` - Cancel booking

### Public Booking

- `GET /api/bookings/public/:username` - Get public booking availability
- `POST /api/bookings/public/:username` - Create public booking

### Calendar Integration

- `GET /api/calendar/status` - Get calendar integration status
- `DELETE /api/calendar/disconnect/:provider` - Disconnect calendar
- `GET /api/calendar/google/auth` - Get Google OAuth URL
- `GET /api/calendar/microsoft/auth` - Get Microsoft OAuth URL

## Development

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm test` - Run tests
- `npm run test:unit` - Run unit tests
- `npm run test:coverage` - Run tests with coverage
- `npm run coverage:report` - Generate comprehensive coverage report and badges
- `npm run lint` - Run ESLint and markdownlint
- `npm run db:migrate` - Run database migrations
- `npm run security:check` - Run security audit

### Performance Testing

- `npm run benchmark` - Run performance benchmarks
- `npm run db:benchmark` - Database performance testing

### Database Monitoring

The API includes built-in database query monitoring:

- **Slow Query Detection**: Automatically logs queries exceeding threshold
- **Performance Statistics**: Track query performance by type and table
- **Connection Pool Monitoring**: Monitor database connection health
- **Monitoring API**: Access stats via `/api/health` endpoint

See [Database Monitoring Guide](docs/DATABASE_MONITORING.md) for configuration and usage.

### Load Testing

Load testing is available in the `meetabl-infra/load-testing` directory:

```bash
cd ../meetabl-infra/load-testing
npm install
npm run test:smoke    # Quick smoke test
npm run test:load     # Sustained load test
npm run test:stress   # Stress testing
```

See the [Load Testing README](../meetabl-infra/load-testing/README.md) for detailed instructions.

## Project Structure

```
meetabl-api/
├── src/                    # Source code
│   ├── config/             # Configuration files
│   │   ├── database.js     # Database configuration
│   │   ├── logger.js       # Logging configuration
│   │   └── passport.js     # Authentication configuration
│   ├── controllers/        # Route controllers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── availability.controller.js
│   │   ├── booking.controller.js
│   │   └── calendar.controller.js
│   ├── db/                 # Database scripts
│   │   └── migrate.js      # Database migration
│   ├── middlewares/        # Express middlewares
│   │   ├── auth.js         # Authentication middleware
│   │   └── validation.js   # Request validation
│   ├── models/             # Data models
│   │   ├── user.model.js
│   │   ├── calendar-token.model.js
│   │   ├── availability-rule.model.js
│   │   ├── booking.model.js
│   │   ├── notification.model.js
│   │   ├── user-settings.model.js
│   │   ├── audit-log.model.js
│   │   └── index.js
│   ├── routes/             # Route definitions
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── availability.routes.js
│   │   ├── booking.routes.js
│   │   └── calendar.routes.js
│   ├── app.js              # Express app setup
│   └── index.js            # Application entry point
├── tests/                  # Test files
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── fixtures/           # Test fixtures
├── logs/                   # Log files
├── .env.example            # Example environment variables
├── .eslintrc.js            # ESLint configuration
├── .gitignore              # Git ignore file
├── install.sql             # Database schema
├── jest.config.js          # Jest configuration
├── package.json            # Project metadata and dependencies
└── README.md               # Project documentation
```

## Accessibility Compliance

meetabl API is designed to support WCAG 2.2 AA/AAA compliance in the following ways:

1. **Accessible API Responses**: All error messages and user-facing content are designed to be clear and understandable.
2. **Timezone Support**: Full timezone support ensures appropriate time display for users with disabilities.
3. **Flexible Booking Options**: Support for buffer times and custom durations to accommodate users who may need additional time.
4. **Accessibility Settings**: User settings include accessibility mode toggles and alt text enablement.
5. **Structured Data**: Consistent and well-structured data to support accessible frontend implementation.

## Testing and Code Quality

meetabl API follows a comprehensive testing strategy to ensure code reliability and maintainability.

### Test Coverage

The project maintains high test coverage to ensure code quality. See [Test Coverage Report](docs/TEST_COVERAGE.md) for detailed metrics.

```bash
# Run all tests with coverage
npm run test:coverage

# Generate comprehensive coverage report with badges
npm run coverage:report
```

Coverage badges are automatically generated and can be found in the test coverage report.

### Testing Approach

- **Unit Tests**: Tests for individual components (models, controllers, services)
- **Integration Tests**: End-to-end workflow testing for complete user journeys
- **Performance Tests**: Response time benchmarks and scalability validation
- **Security Tests**: Input validation, authentication, and vulnerability testing
- **Mocking**: External dependencies are mocked to ensure tests are deterministic
- **Code Style**: ESLint and Markdownlint are used to maintain consistent code style

### Integration Test Workflows

The API includes comprehensive integration tests covering:

- **User Onboarding**: Complete registration and setup flow
- **Booking Scenarios**: Advanced booking workflows and edge cases
- **Error Handling**: Comprehensive error validation across all endpoints
- **Performance**: Response time benchmarks and concurrent load testing

See [Integration Tests Guide](tests/INTEGRATION_TESTS.md) for detailed information.

## License

This project is licensed under the ISC License.