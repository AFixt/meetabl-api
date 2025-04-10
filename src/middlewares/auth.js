/**
 * Authentication middleware
 *
 * Handles JWT verification and user authentication
 *
 * @author meetabl Team
 */

const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const { User } = require('../models');

/**
 * Verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Authentication required'
        }
      });
    }

    const tokenParts = authHeader.split(' ');

    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid authentication format'
        }
      });
    }

    const token = tokenParts[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
