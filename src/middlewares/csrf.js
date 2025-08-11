/**
 * CSRF Protection Middleware
 * 
 * Implements CSRF protection using the csrf library for state-changing operations
 * 
 * @author meetabl Team
 */

const csrf = require('csrf');
const logger = require('../config/logger');

// Create CSRF instance
const tokens = new csrf();

/**
 * Generate CSRF secret for session
 */
const generateSecret = () => {
  return tokens.secretSync();
};

/**
 * Generate CSRF token from secret
 */
const generateToken = (secret) => {
  return tokens.create(secret);
};

/**
 * Verify CSRF token against secret
 */
const verifyToken = (secret, token) => {
  return tokens.verify(secret, token);
};

/**
 * Middleware to add CSRF token to session
 */
const initializeCsrf = (req, res, next) => {
  // Initialize CSRF secret if not exists
  if (!req.session?.csrfSecret) {
    if (!req.session) {
      req.session = {};
    }
    req.session.csrfSecret = generateSecret();
  }
  next();
};

/**
 * Middleware to provide CSRF token endpoint
 */
const provideCsrfToken = (req, res) => {
  const secret = req.session?.csrfSecret;
  if (!secret) {
    return res.status(400).json({
      error: {
        code: 'csrf_not_initialized',
        message: 'CSRF protection not initialized'
      }
    });
  }

  const token = generateToken(secret);
  res.json({ csrfToken: token });
};

/**
 * Middleware to protect against CSRF attacks
 * Validates CSRF token from header or body
 */
const protectCsrf = (req, res, next) => {
  // Skip CSRF protection for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API endpoints that use JWT authentication
  // Since JWT tokens provide sufficient protection against CSRF when properly implemented
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  const secret = req.session?.csrfSecret;
  if (!secret) {
    logger.warn('CSRF protection attempted without secret', {
      method: req.method,
      url: req.url,
      ip: req.ip
    });
    return res.status(403).json({
      error: {
        code: 'csrf_no_secret',
        message: 'CSRF protection not initialized'
      }
    });
  }

  // Get token from header or body
  const token = req.headers['x-csrf-token'] || 
                req.headers['x-xsrf-token'] || 
                req.body?._csrf ||
                req.query._csrf;

  if (!token) {
    logger.warn('CSRF token missing', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      headers: Object.keys(req.headers)
    });
    return res.status(403).json({
      error: {
        code: 'csrf_token_missing',
        message: 'CSRF token required'
      }
    });
  }

  if (!verifyToken(secret, token)) {
    logger.warn('Invalid CSRF token', {
      method: req.method,
      url: req.url,
      ip: req.ip
    });
    return res.status(403).json({
      error: {
        code: 'csrf_token_invalid',
        message: 'Invalid CSRF token'
      }
    });
  }

  next();
};

/**
 * Middleware to conditionally protect against CSRF attacks
 * Skips protection for public routes
 */
const protectCsrfConditional = (req, res, next) => {
  // Skip CSRF protection for public routes
  if (req.path.includes('/public/')) {
    return next();
  }
  
  // Apply CSRF protection for all other routes
  return protectCsrf(req, res, next);
};

module.exports = {
  initializeCsrf,
  provideCsrfToken,
  protectCsrf,
  protectCsrfConditional,
  generateSecret,
  generateToken,
  verifyToken
};