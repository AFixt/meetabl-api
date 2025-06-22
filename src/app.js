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
const logger = require('./config/logger');
const { processNotifications } = require('./jobs/notification-processor');
const { initializeCsrf, protectCsrf, provideCsrfToken } = require('./middlewares/csrf');
const { initializeSession, sessionCleanup, sessionSecurity } = require('./config/session');
const dbMonitor = require('./utils/db-monitor');
const { errorHandler, notFoundError } = require('./utils/error-response');

// Validate critical environment variables at startup
function validateEnvironment() {
  const requiredEnvVars = {
    JWT_SECRET: process.env.JWT_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET,
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

  // Validate SESSION_SECRET strength
  if (process.env.SESSION_SECRET) {
    const sessionSecret = process.env.SESSION_SECRET;
    if (sessionSecret.length < 32) {
      invalid.push('SESSION_SECRET must be at least 32 characters long');
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

// Apply security middlewares with comprehensive CSP
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some UI frameworks
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some analytics
        "https://apis.google.com",
        "https://accounts.google.com"
      ],
      connectSrc: [
        "'self'",
        "https://api.github.com", // For OAuth
        "https://graph.microsoft.com", // For Microsoft Calendar
        "https://login.microsoftonline.com",
        "https://accounts.google.com",
        "https://www.googleapis.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://*.gravatar.com",
        "https://avatar.githubusercontent.com"
      ],
      frameSrc: [
        "'self'",
        "https://accounts.google.com"
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for OAuth compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin for API
}));

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

// Redis-based session configuration
const sessionMiddleware = await initializeSession();
app.use(sessionMiddleware);
app.use(sessionCleanup);
app.use(sessionSecurity);

// Initialize CSRF protection
app.use(initializeCsrf);

// Apply rate limiting with different limits for different endpoint types
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}, endpoint: ${req.path}`);
    return res.status(429).json({
      error: {
        code: 'too_many_requests',
        message
      }
    });
  }
});

// General API rate limiting (higher limit)
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  200, // Increased from 100 for normal operations
  'Too many requests, please try again later.'
);

// Strict rate limiting for authentication endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes  
  5, // Very restrictive for login attempts
  'Too many authentication attempts, please try again in 15 minutes.'
);

// Moderate rate limiting for password reset endpoints
const passwordResetLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // Only 3 password reset attempts per hour
  'Too many password reset requests, please try again in 1 hour.'
);

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Apply strict rate limiting to authentication endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);

// Add request logging middleware
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url.replace(/\/\d+/g, '/[ID]'), // Replace numeric IDs with placeholder
    ip: req.ip,
    userAgent: req.get('User-Agent') || 'Unknown'
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
const docsRoutes = require('./routes/docs.routes');
const outsetaRoutes = require('./routes/outseta.routes');

// Database monitoring endpoint (only in development/staging)
if (process.env.NODE_ENV !== 'production') {
  app.use(dbMonitor.createExpressMiddleware());
}

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
app.use('/api/outseta', outsetaRoutes);

// Documentation routes (no rate limiting for docs)
app.use('/api/docs', docsRoutes);

// Default route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'meetabl API is running',
    version: '1.0.0',
    documentation: 'See README.md for API documentation'
  });
});

// Health check endpoint with monitoring info
app.get('/api/health', async (req, res) => {
  try {
    const { sequelize, getPoolStats } = require('./config/database');
    const dbStatus = await sequelize.authenticate().then(() => 'connected').catch(() => 'disconnected');
    
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: {
        status: dbStatus,
        pool: getPoolStats()
      },
      monitoring: {
        enabled: dbMonitor.enabled,
        slowQueryThreshold: dbMonitor.slowQueryThreshold
      }
    };

    // Include detailed stats in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      response.monitoring.stats = dbMonitor.getStats();
      response.monitoring.slowQueries = dbMonitor.getSlowQueries(5);
    }

    res.status(200).json(response);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Failed to perform health check'
    });
  }
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

// Utility function to sanitize sensitive data from logs
const sanitizeForLogging = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveFields = [
    'password', 'token', 'secret', 'authorization', 'cookie',
    'email', 'phone', 'ssn', 'credit_card', 'customer_email',
    'customer_phone', 'customer_name', 'name'
  ];
  
  const sanitized = Array.isArray(data) ? [] : {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// 404 handler
app.use((req, res, next) => {
  const error = notFoundError('Route not found');
  next(error);
});

// Standardized error handling middleware
app.use(errorHandler);

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
