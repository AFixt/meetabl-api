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
    // Try to get token from cookie first, then Authorization header (for backward compatibility)
    let token = req.cookies.token;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Authentication required'
        }
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

    // Attach user to request
    req.user = user;

    // Log authentication
    logger.debug(`User authenticated: ${user.id}`);

    next();
  } catch (error) {
    // Handle different JWT errors
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Token expired'
        }
      });
    } if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid token'
        }
      });
    }

    logger.error('Authentication error:', error);

    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Authentication failed'
      }
    });
  }
};

module.exports = {
  authenticateJWT
};
