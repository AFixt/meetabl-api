# meetabl API

A WCAG 2.2 AA/AAA compliant booking API for the meetabl platform. meetabl is a responsive and accessible microsaas booking system designed to compete with Calendly and other inaccessible calendar booking products.

## Features

### Core Functionality
- **Accessible booking interface integration** with WCAG 2.2 AA/AAA compliance
- **Recurring availability management** with flexible rules and exceptions
- **Calendar integrations** (Google Calendar, Microsoft Outlook)
- **Multi-channel notifications** (Email, SMS, push notifications)
- **Public booking links** with customizable branding
- **Team collaboration** with role-based access control
- **Payment processing** with Stripe integration
- **User subscription management** with Stripe integration

### Enterprise Features
- **Progressive Web App (PWA)** with offline capabilities
- **Comprehensive health checks** for load balancers and monitoring
- **Application Performance Monitoring (APM)** with OpenTelemetry
- **Structured logging** with automated rotation and management
- **Real-time metrics** and performance tracking
- **Background job processing** with BullMQ
- **Advanced caching** with Redis integration
- **Security hardening** with rate limiting and CSRF protection

### Developer Experience
- **OpenAPI/Swagger documentation** with interactive testing
- **Comprehensive test suite** with integration workflows
- **Performance benchmarking** and load testing
- **Database monitoring** with query optimization
- **CI/CD integration** with GitHub Actions
- **Docker containerization** ready for deployment

## Tech Stack

### Core Framework
- **Node.js 22 LTS** with Express.js 4.x
- **MySQL/MariaDB 8.0+** with Sequelize ORM 6.x
- **Redis 7+** for session management and caching
- **TypeScript support** with modern ES modules

### Authentication & Security
- **JWT authentication** with refresh tokens and enhanced security
- **OAuth 2.0 integration** (Google Calendar, Microsoft Graph, GitHub)
- **CSRF protection** with double-submit cookies
- **Rate limiting** with Express rate limiter
- **Helmet.js** for security headers
- **Input validation** with express-validator

### Integrations & APIs
- **AWS SDK v3** for cloud storage (S3)
- **Stripe API** for payment processing
- **Stripe API** for subscription and payment management
- **Twilio API** for SMS notifications
- **Nodemailer** for email notifications
- **Google Calendar API** and **Microsoft Graph API**

### Monitoring & Observability
- **OpenTelemetry** for distributed tracing and metrics
- **Prometheus** metrics exporter
- **Winston & Bunyan** for structured logging
- **Express Status Monitor** for real-time metrics
- **Comprehensive health checks** for Kubernetes and load balancers

### Development & Testing
- **Jest** for unit and integration testing
- **ESLint** and **Markdownlint** for code quality
- **Supertest** for API testing
- **Coverage reporting** with badges
- **Performance benchmarking** tools

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

### Monitoring & Health Checks

- `GET /health` - Basic health check for load balancers
- `GET /healthz` - Kubernetes-style health check
- `GET /ready` - Readiness probe endpoint
- `GET /alive` - Liveness probe endpoint
- `GET /ping` - Simple connectivity test
- `GET /api/monitoring/health` - Comprehensive health check
- `GET /api/monitoring/health/:component` - Individual component health
- `GET /api/monitoring/metrics` - Performance metrics (authenticated)
- `GET /api/monitoring/stats` - Application statistics (authenticated)

### Progressive Web App (PWA)

- `GET /manifest.json` - Web app manifest
- `GET /service-worker.js` - Service worker script
- `POST /api/pwa/subscribe` - Subscribe to push notifications (authenticated)
- `DELETE /api/pwa/unsubscribe` - Unsubscribe from notifications (authenticated)
- `POST /api/pwa/sync` - Background sync endpoint (authenticated)
- `GET /api/pwa/offline-data` - Essential offline data (authenticated)
- `GET /api/pwa/status` - PWA capabilities and status

### Team Management

- `GET /api/teams` - Get user's teams (authenticated)
- `POST /api/teams` - Create new team (authenticated)
- `GET /api/teams/:id` - Get team details (authenticated)
- `PUT /api/teams/:id` - Update team (authenticated)
- `DELETE /api/teams/:id` - Delete team (authenticated)
- `POST /api/teams/:id/members` - Add team member (authenticated)
- `DELETE /api/teams/:id/members/:userId` - Remove team member (authenticated)

### Payment & Subscriptions

- `GET /api/subscriptions/status` - Get subscription status (authenticated)
- `POST /api/payments/webhook` - Stripe webhook endpoint
- `GET /api/payments/setup-intent` - Create payment setup intent (authenticated)

For complete API documentation, visit `/api/docs` when the server is running.

## Development

### Development Scripts

#### Server Management
- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm run dev:debug` - Start server with debugger enabled
- `npm run pm2:dev` - Start with PM2 for development
- `npm run pm2:prod` - Start with PM2 for production

#### Testing & Quality
- `npm test` - Run all tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:coverage` - Run tests with coverage report
- `npm run coverage:report` - Generate comprehensive coverage report with badges
- `npm run lint` - Run ESLint and Markdownlint
- `npm run lint:js` - Run JavaScript linting only
- `npm run lint:md` - Run Markdown linting only
- `npm run security:check` - Run security audit with npm audit and Snyk

#### Database Management
- `npm run db:migrate` - Run database migrations (respects NODE_ENV)
- `npm run db:migrate:dev` - Run migrations for development
- `npm run db:migrate:test` - Run migrations for testing
- `npm run db:migrate:prod` - Run migrations for production
- `npm run db:seed` - Seed database with sample data

#### Performance & Monitoring
- `npm run benchmark` - Run API performance benchmarks
- `npm run benchmark:api` - Benchmark API endpoints
- `npm run benchmark:db` - Benchmark database operations
- `npm run load-test` - Run comprehensive load tests
- `npm run load-test:stress` - Run stress testing

### Performance Testing

- `npm run benchmark` - Run performance benchmarks
- `npm run db:benchmark` - Database performance testing

### Monitoring & Observability

The API includes comprehensive monitoring and observability features:

#### Health Checks
Multiple health check endpoints for different use cases:
- `/health` - Load balancer health check (fast, basic)
- `/healthz` - Kubernetes-style health check
- `/ready` - Readiness probe for container orchestration
- `/alive` - Liveness probe for container management
- `/api/monitoring/health` - Comprehensive health check with all components

See [Health Checks Guide](docs/HEALTH_CHECKS.md) for deployment configurations.

#### Application Performance Monitoring (APM)
- **OpenTelemetry integration** with distributed tracing
- **Prometheus metrics** exported on port 9090
- **Real-time performance tracking** with custom metrics
- **Request/response monitoring** with detailed timing
- **Database query performance** tracking and optimization

#### Logging Strategy
- **Structured JSON logging** with Winston and Bunyan
- **Automatic log rotation** and compression
- **Audit logging** for security and compliance events
- **Log management API** with cleanup and statistics
- **Multiple log transports** (console, file, external services)

See [Logging Strategy Guide](docs/LOGGING_STRATEGY.md) for configuration.

#### Database Monitoring
- **Slow Query Detection**: Automatically logs queries exceeding threshold
- **Performance Statistics**: Track query performance by type and table
- **Connection Pool Monitoring**: Monitor database connection health
- **Query optimization recommendations** based on performance data

See [Database Monitoring Guide](docs/DATABASE_MONITORING.md) for configuration and usage.

#### Progressive Web App (PWA)
- **Service Worker** for offline capabilities and caching
- **Web App Manifest** for installation on mobile and desktop
- **Background sync** for offline data synchronization
- **Push notifications** for real-time updates
- **Offline fallback pages** with accessibility features

See [PWA Implementation Guide](docs/PWA_IMPLEMENTATION.md) for details.

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

## Deployment

### Environment Configuration

Create production environment file:

```bash
cp .env.example .env.production
```

Required environment variables:

```bash
# Application
NODE_ENV=production
PORT=3000
JWT_SECRET=your-256-bit-secret
SESSION_SECRET=your-session-secret

# Database
DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=meetabl
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# Redis (optional, for sessions and caching)
REDIS_URL=redis://your-redis-host:6379

# External Services (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Monitoring (optional)
ENABLE_TELEMETRY=true
METRICS_PORT=9090
LOG_LEVEL=info
```

### Docker Deployment

1. **Build Docker image**:
```bash
docker build -t meetabl-api:latest .
```

2. **Run with Docker Compose**:
```bash
docker-compose up -d
```

Example `docker-compose.yml`:
```yaml
version: '3.8'
services:
  api:
    image: meetabl-api:latest
    ports:
      - "3000:3000"
      - "9090:9090"  # Metrics port
    environment:
      - NODE_ENV=production
      - DB_HOST=db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=meetabl
    volumes:
      - db_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  db_data:
  redis_data:
```

### Kubernetes Deployment

Example Kubernetes manifests:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meetabl-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: meetabl-api
  template:
    metadata:
      labels:
        app: meetabl-api
    spec:
      containers:
      - name: meetabl-api
        image: meetabl-api:latest
        ports:
        - containerPort: 3000
        - containerPort: 9090  # Metrics
        
        # Health check probes
        livenessProbe:
          httpGet:
            path: /alive
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
```

### Load Balancer Configuration

#### NGINX
```nginx
upstream meetabl_api {
    server api1.example.com:3000;
    server api2.example.com:3000;
    server api3.example.com:3000;
}

server {
    listen 80;
    server_name api.meetabl.com;

    location /health {
        access_log off;
        proxy_pass http://meetabl_api;
        proxy_connect_timeout 5s;
        proxy_read_timeout 5s;
    }

    location / {
        proxy_pass http://meetabl_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### AWS Application Load Balancer
Health check configuration:
- **Path**: `/health`
- **Timeout**: 5 seconds
- **Interval**: 15 seconds
- **Healthy threshold**: 2
- **Unhealthy threshold**: 3

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations run (`npm run db:migrate:prod`)
- [ ] SSL/TLS certificates installed
- [ ] Health checks configured in load balancer
- [ ] Monitoring and alerting set up
- [ ] Log aggregation configured
- [ ] Backup strategy implemented
- [ ] Security headers verified
- [ ] Rate limiting configured
- [ ] CDN configured for static assets (if applicable)

### Scaling Considerations

- **Horizontal scaling**: API is stateless and can be scaled horizontally
- **Database**: Consider read replicas for read-heavy workloads
- **Redis**: Use Redis Cluster for high availability
- **File storage**: Use AWS S3 or similar for file uploads
- **CDN**: Configure CloudFront or similar for static assets
- **Monitoring**: Set up Prometheus and Grafana for metrics
- **Logging**: Use ELK stack or similar for log aggregation

## Project Structure

```
meetabl-api/
├── src/                    # Source code
│   ├── config/             # Configuration files
│   │   ├── database.js     # Database configuration with Node.js 22 optimizations
│   │   ├── logger.js       # Enhanced logging with Winston/Bunyan
│   │   ├── session.js      # Redis session configuration
│   │   ├── telemetry.js    # OpenTelemetry and APM configuration
│   │   └── passport.js     # OAuth authentication configuration
│   ├── controllers/        # Route controllers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── availability.controller.js
│   │   ├── booking.controller.js
│   │   ├── calendar.controller.js
│   │   ├── team.controller.js
│   │   ├── payment.controller.js
│   │   └── analytics.controller.js
│   ├── db/                 # Database scripts
│   │   ├── migrate.js      # Database migration
│   │   └── seed.js         # Database seeding
│   ├── middlewares/        # Express middlewares
│   │   ├── auth.js         # JWT authentication
│   │   ├── validation.js   # Express-validator middleware
│   │   ├── csrf.js         # CSRF protection
│   │   ├── logging.js      # Request/response logging
│   │   ├── performance.js  # Performance monitoring
│   │   └── pwa.js          # Progressive Web App features
│   ├── models/             # Sequelize data models
│   │   ├── user.model.js
│   │   ├── calendar-token.model.js
│   │   ├── availability-rule.model.js
│   │   ├── booking.model.js
│   │   ├── notification.model.js
│   │   ├── user-settings.model.js
│   │   ├── audit-log.model.js
│   │   ├── team.model.js
│   │   ├── team-member.model.js
│   │   └── index.js
│   ├── routes/             # Express route definitions
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── availability.routes.js
│   │   ├── booking.routes.js
│   │   ├── calendar.routes.js
│   │   ├── team.routes.js
│   │   ├── payment.routes.js
│   │   ├── analytics.routes.js
│   │   ├── notification.routes.js
│   │   ├── monitoring.routes.js
│   │   ├── stripe-webhook.routes.js
│   │   ├── subscription.routes.js
│   │   ├── pwa.routes.js
│   │   └── docs.routes.js
│   ├── services/           # Business logic services
│   │   ├── email.service.js
│   │   ├── sms.service.js
│   │   ├── calendar.service.js
│   │   ├── payment.service.js
│   │   ├── team.service.js
│   │   ├── metrics.service.js
│   │   ├── health-check.service.js
│   │   ├── log-management.service.js
│   │   ├── stripe.service.js
│   │   └── webhook.service.js
│   ├── utils/              # Utility functions
│   │   ├── error-response.js
│   │   ├── validation.js
│   │   ├── sanitize.js
│   │   ├── db-monitor.js
│   │   └── rate-limiter.js
│   ├── jobs/               # Background job processors
│   │   ├── notification-processor.js
│   │   └── db-monitor-job.js
│   ├── telemetry.js        # Telemetry initialization
│   ├── app.js              # Express app setup with all middleware
│   └── index.js            # Application entry point
├── public/                 # Static assets for PWA
│   ├── manifest.json       # Web app manifest
│   ├── service-worker.js   # Service worker for offline support
│   ├── offline.html        # Offline fallback page
│   └── icons/              # PWA icons (various sizes)
├── docs/                   # Comprehensive documentation
│   ├── HEALTH_CHECKS.md    # Health check implementation guide
│   ├── LOGGING_STRATEGY.md # Logging configuration and usage
│   ├── PWA_IMPLEMENTATION.md # Progressive Web App features
│   ├── DATABASE_MONITORING.md # Database performance monitoring
│   ├── standards/          # Development standards and patterns
│   └── api/                # API documentation
├── tests/                  # Test suites
│   ├── unit/               # Unit tests by component
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── services/
│   │   ├── middlewares/
│   │   └── utils/
│   ├── integration/        # Integration and workflow tests
│   │   ├── routes/
│   │   └── workflows/
│   ├── fixtures/           # Test data and mocks
│   └── setup.js            # Test environment setup
├── logs/                   # Log files (auto-managed)
│   ├── audit/              # Audit logs (1 year retention)
│   ├── errors/             # Error logs
│   └── archive/            # Compressed archived logs
├── scripts/                # Development and deployment scripts
│   ├── generate-coverage.js
│   ├── setup-local-db.js
│   └── benchmark-runner.sh
├── .env.example            # Example environment variables
├── .eslintrc.js            # ESLint configuration
├── .gitignore              # Git ignore patterns
├── docker-compose.yml      # Docker development environment
├── Dockerfile              # Docker image definition
├── ecosystem.config.js     # PM2 process management
├── install.sql             # Database schema
├── jest.config.js          # Jest testing configuration
├── nodemon.json            # Nodemon development configuration
├── package.json            # Dependencies and scripts
└── README.md               # This documentation
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