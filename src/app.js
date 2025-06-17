/**
 * Main Express application setup
 *
 * Configures the Express application with middlewares, routes, and error handling
 *
 * @author meetabl Team
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const logger = require('./config/logger');
const { processNotifications } = require('./jobs/notification-processor');
const { initializeCsrf, protectCsrf, provideCsrfToken } = require('./middlewares/csrf');

// Validate critical environment variables at startup
function validateEnvironment() {
  const requiredEnvVars = {
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV
  };

  const missing = [];
  const invalid = [];

  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      missing.push(key);
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET) {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret.length < 32) {
      invalid.push('JWT_SECRET must be at least 32 characters long');
    }
    if (!/[A-Z]/.test(jwtSecret) || !/[a-z]/.test(jwtSecret) || !/[0-9]/.test(jwtSecret)) {
      invalid.push('JWT_SECRET should contain uppercase, lowercase, and numeric characters');
    }
  }

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (invalid.length > 0) {
    logger.error(`Invalid environment configuration: ${invalid.join(', ')}`);
    process.exit(1);
  }

  logger.info('Environment validation passed');
}

// Validate environment before proceeding
validateEnvironment();

// Use appropriate database configuration based on environment
const { initializeDatabase } = process.env.NODE_ENV === 'test'
  ? require('./models/test-models')
  : process.env.AWS_LAMBDA_FUNCTION_NAME 
    ? require('./config/database-serverless')
    : require('./config/database');

// Create Express app
const app = express();

// Apply basic middlewares
app.use(helmet());

// Configure CORS for multiple origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['X-Total-Count']
}));

// Add raw body parsing for Stripe webhooks
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Apply JSON body parsing to all other routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration for CSRF protection
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize CSRF protection
app.use(initializeCsrf);

// Apply rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    return res.status(429).json({
      error: {
        code: 'too_many_requests',
        message: 'Too many requests, please try again later.'
      }
    });
  }
});
app.use(limiter);

// Add request logging middleware
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip
  }, 'Request received');
  next();
});

// Import routes
// Note: These will be created in separate files
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const availabilityRoutes = require('./routes/availability.routes');
const bookingRoutes = require('./routes/booking.routes');
const calendarRoutes = require('./routes/calendar.routes');
const notificationRoutes = require('./routes/notification.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const teamRoutes = require('./routes/team.routes');
const paymentRoutes = require('./routes/payment.routes');

// CSRF token endpoint
app.get('/api/csrf-token', provideCsrfToken);

// Apply CSRF protection to state-changing routes
// Skip authentication routes as they typically don't need CSRF (using JWT)
app.use('/api/users', protectCsrf);
app.use('/api/availability', protectCsrf);
app.use('/api/bookings', protectCsrf);
app.use('/api/calendar', protectCsrf);
app.use('/api/notifications', protectCsrf);
app.use('/api/analytics', protectCsrf);
app.use('/api/teams', protectCsrf);
app.use('/api/payments', protectCsrf);

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/payments', paymentRoutes);

// Default route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'meetabl API is running',
    version: '1.0.0',
    documentation: 'See README.md for API documentation'
  });
});

// 404 handler
app.use((req, res) => {
  logger.info(`Not found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: {
      code: 'not_found',
      message: 'The requested resource was not found.'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error({
    err: {
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      params: req.params,
      query: req.query,
      body: req.body
    }
  }, 'Error processing request');

  // Don't expose error details in production
  const isProduction = process.env.NODE_ENV === 'production';

  return res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'internal_server_error',
      message: err.message || 'An unexpected error occurred',
      params: !isProduction && err.params ? err.params : undefined
    }
  });
});

/**
 * Initialize the application
 * @returns {Promise<Express>} The configured Express application
 */
const initializeApp = async () => {
  try {
    // Initialize database connection
    await initializeDatabase();

    // Setup basic notification processing job
    // In production, you would use a proper job scheduler
    // like node-cron, Bull, or a dedicated service
    if (process.env.NODE_ENV !== 'test') {
      // Run once at startup
      processNotifications().catch((err) => logger.error('Error in initial notification processing:', err));

      // Then every 5 minutes
      setInterval(() => {
        processNotifications().catch((err) => logger.error('Error in scheduled notification processing:', err));
      }, 5 * 60 * 1000);

      logger.info('Notification processor scheduled');
    }

    logger.info('Application initialized successfully');
    return app;
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    throw error;
  }
};

module.exports = { app, initializeApp };
