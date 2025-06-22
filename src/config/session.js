/**
 * Session configuration
 * 
 * This file configures Express session middleware with Redis store
 * for scalable session management
 * 
 * @author meetabl Team
 */

const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const redisConfig = require('./redis');
const logger = require('./logger');

/**
 * Create Redis client for session store
 */
const createRedisClient = async () => {
  try {
    const client = createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
        connectTimeout: 5000, // 5 second timeout
        commandTimeout: 3000  // 3 second command timeout
      },
      password: redisConfig.password
    });

    client.on('error', (err) => {
      logger.error('Redis session store error:', err);
    });

    client.on('connect', () => {
      logger.info('Redis session store connected');
    });

    client.on('ready', () => {
      logger.info('Redis session store ready');
    });

    client.on('reconnecting', () => {
      logger.warn('Redis session store reconnecting');
    });

    // Try to connect with timeout
    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis connection timeout')), 6000);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    return client;
  } catch (error) {
    logger.error('Failed to create Redis client for sessions:', error);
    return null;
  }
};

/**
 * Session configuration options
 */
const getSessionConfig = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const redisClient = await createRedisClient();
  
  const config = {
    name: 'meetabl.sid',
    secret: process.env.SESSION_SECRET || 'meetabl-development-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on each request
    cookie: {
      secure: isProduction, // Require HTTPS in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: parseInt(process.env.SESSION_TIMEOUT, 10) || (24 * 60 * 60 * 1000), // 24 hours default
      sameSite: isProduction ? 'strict' : 'lax' // CSRF protection
    },
    proxy: isProduction // Trust proxy in production
  };

  // Use Redis store if available, otherwise fall back to memory store
  if (redisClient) {
    config.store = new RedisStore({
      client: redisClient,
      prefix: 'meetabl:sess:',
      ttl: Math.floor(config.cookie.maxAge / 1000), // TTL in seconds
      disableTouch: false // Allow session extension
    });
    logger.info('Using Redis session store');
  } else {
    logger.warn('Redis unavailable, falling back to memory session store (not recommended for production)');
  }

  return config;
};

/**
 * Session cleanup middleware
 * Cleans up expired sessions and handles session errors
 */
const sessionCleanup = (req, res, next) => {
  // Add session regeneration helper
  req.regenerateSession = (callback) => {
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed:', err);
        return callback(err);
      }
      callback(null);
    });
  };

  // Add session destruction helper
  req.destroySession = (callback) => {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destruction failed:', err);
        return callback(err);
      }
      res.clearCookie('meetabl.sid');
      callback(null);
    });
  };

  next();
};

/**
 * Session security middleware
 * Implements session security best practices
 */
const sessionSecurity = (req, res, next) => {
  // Check for session hijacking
  if (req.session && req.session.userAgent && req.session.userAgent !== req.get('User-Agent')) {
    logger.warn('Potential session hijacking detected', {
      sessionId: req.sessionID,
      expectedUserAgent: req.session.userAgent,
      actualUserAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    // Destroy potentially compromised session
    return req.destroySession((err) => {
      if (err) {
        logger.error('Failed to destroy compromised session:', err);
      }
      res.status(401).json({
        error: {
          code: 'session_security_violation',
          message: 'Session security violation detected'
        }
      });
    });
  }

  // Store user agent for session validation
  if (req.session && !req.session.userAgent) {
    req.session.userAgent = req.get('User-Agent');
  }

  next();
};

/**
 * Initialize session middleware
 */
const initializeSession = async () => {
  const config = await getSessionConfig();
  return session(config);
};

module.exports = {
  initializeSession,
  sessionCleanup,
  sessionSecurity,
  createRedisClient
};