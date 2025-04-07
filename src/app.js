/**
 * Main Express application setup
 *
 * Configures the Express application with middlewares, routes, and error handling
 *
 * @author AccessMeet Team
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const logger = require('./config/logger');
const { processNotifications } = require('./jobs/notification-processor');

// Use test database configuration when in test environment
const { initializeDatabase } = process.env.NODE_ENV === 'test' 
  ? require('./models/test-models')
  : require('./config/database');

// Create Express app
const app = express();

// Apply basic middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

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

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/calendar', calendarRoutes);

// Default route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'AccessMeet API is running',
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
    // In production, you would use a proper job scheduler like node-cron, Bull, or a dedicated service
    if (process.env.NODE_ENV !== 'test') {
      // Run once at startup
      processNotifications().catch(err => logger.error('Error in initial notification processing:', err));
      
      // Then every 5 minutes
      setInterval(() => {
        processNotifications().catch(err => logger.error('Error in scheduled notification processing:', err));
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
