/**
 * Authentication middleware
 *
 * Handles JWT verification and user authentication
 *
 * @author meetabl Team
 */

const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const { User, JwtBlacklist } = require('../models');

/**
 * Verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateJWT = async (req, res, next) => {
  
  try {
    // Debug logging
    logger.debug('Auth middleware processing request');
    
    // Try to get token from cookie first, then Authorization header
    let token = req.cookies.jwt || req.cookies.token;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      logger.debug('Auth middleware - no token found in cookies or headers');
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Authentication required'
        }
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          error: {
            code: 'unauthorized',
            message: 'Token expired'
          }
        });
      } else if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          error: {
            code: 'unauthorized',
            message: 'Invalid token'
          }
        });
      }
      throw error;
    }

    // Check if token is blacklisted
    if (decoded.jti) {
      const blacklistedToken = await JwtBlacklist.findOne({
        where: { jwtId: decoded.jti }
      });

      if (blacklistedToken) {
        return res.status(401).json({
          error: {
            code: 'unauthorized',
            message: 'Token has been revoked'
          }
        });
      }
    }

    // Get user from database
    const user = await User.findOne({ where: { id: decoded.userId } });

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'User not found'
        }
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Account is not active'
        }
      });
    }

    // Attach user to request
    req.user = user;

    // Log authentication
    logger.debug(`User authenticated: ${user.id}`);

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Middleware to require email verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Authentication required'
      }
    });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({
      error: {
        code: 'email_not_verified',
        message: 'Please verify your email address to continue'
      }
    });
  }

  next();
};

module.exports = {
  authenticate: authenticateJWT,
  authenticateJWT,
  requireEmailVerification
};