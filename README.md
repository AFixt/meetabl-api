# AccessMeet API

A WCAG 2.2 AA/AAA compliant booking API for the AccessMeet platform. AccessMeet is a responsive and accessible microsaas booking system designed to compete with Calendly and other inaccessible calendar booking products.

## Features

- Accessible booking interface integration
- Recurring availability management
- Calendar integrations (Google, Microsoft)
- Email and SMS notifications
- Public booking links
- JWT-based authentication
- WCAG 2.2 AA/AAA compliance

## Tech Stack

- Node.js with Express
- MySQL/MariaDB with Sequelize ORM
- JWT authentication
- OAuth 2.0 integration

## Getting Started

### Prerequisites

- Node.js (LTS version)
- MySQL/MariaDB
- npm

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-org/accessmeet-api.git
   cd accessmeet-api
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
   mysql -u root -p -e "CREATE DATABASE accessmeet"
   
   # Import schema
   mysql -u root -p accessmeet < install.sql
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

## Project Structure

```
accessmeet-api/
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

AccessMeet API is designed to support WCAG 2.2 AA/AAA compliance in the following ways:

1. **Accessible API Responses**: All error messages and user-facing content are designed to be clear and understandable.
2. **Timezone Support**: Full timezone support ensures appropriate time display for users with disabilities.
3. **Flexible Booking Options**: Support for buffer times and custom durations to accommodate users who may need additional time.
4. **Accessibility Settings**: User settings include accessibility mode toggles and alt text enablement.
5. **Structured Data**: Consistent and well-structured data to support accessible frontend implementation.

## Testing and Code Quality

AccessMeet API follows a comprehensive testing strategy to ensure code reliability and maintainability.

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
- **Mocking**: External dependencies are mocked to ensure tests are deterministic
- **Code Style**: ESLint and Markdownlint are used to maintain consistent code style

## License

This project is licensed under the ISC License.