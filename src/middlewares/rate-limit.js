/**
 * Rate limiting middleware
 * Provides rate limiting functionality for API endpoints
 */

const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

// Create rate limiter with configurable options
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
  process.env.NODE_ENV === 'development' ? 1000 : 200, // Very lenient in development
  'Too many requests, please try again later.'
);

// Strict rate limiting for authentication endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes  
  process.env.NODE_ENV === 'development' ? 100 : 5, // More lenient in development
  'Too many authentication attempts, please try again in 15 minutes.'
);

// Moderate rate limiting for password reset endpoints
const passwordResetLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  process.env.NODE_ENV === 'development' ? 50 : 3, // More lenient in development
  'Too many password reset requests, please try again in 1 hour.'
);

module.exports = {
  createRateLimiter,
  generalLimiter,
  authLimiter,
  passwordResetLimiter
};