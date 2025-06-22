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
const outsetaService = require('../services/outseta.service');

/**
 * Verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateJWT = async (req, res, next) => {
  try {
    // Try to get token from cookie first, then Authorization header
    let token = req.cookies.jwt || req.cookies.token;
    let isOutsetaToken = false;
    
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

    let decoded;
    let user;

    // Check if this is an Outseta token (they have a different format)
    if (token.includes('.') && token.split('.').length === 3) {
      // Try to decode as JWT first
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtError) {
        // If JWT verification fails, try Outseta validation
        try {
          const outsetaData = await outsetaService.validateToken(token);
          isOutsetaToken = true;
          
          // Find user by Outseta UID
          user = await User.findOne({ where: { outseta_uid: outsetaData.uid } });
          
          if (!user) {
            // Create user from Outseta data if not exists
            user = await User.create({
              outseta_uid: outsetaData.uid,
              email: outsetaData.email,
              firstName: outsetaData.firstName,
              lastName: outsetaData.lastName,
              timezone: outsetaData.timezone || 'UTC',
              role: 'user',
              status: 'active',
              emailVerified: true,
              emailVerifiedAt: new Date()
            });
          }
        } catch (outsetaError) {
          logger.error('Token validation failed', { error: outsetaError.message });
          return res.status(401).json({
            error: {
              code: 'unauthorized',
              message: 'Invalid token'
            }
          });
        }
      }
    } else {
      // Assume it's an Outseta token if it doesn't look like a JWT
      try {
        const outsetaData = await outsetaService.validateToken(token);
        isOutsetaToken = true;
        
        user = await User.findOne({ where: { outseta_uid: outsetaData.uid } });
        
        if (!user) {
          return res.status(401).json({
            error: {
              code: 'unauthorized',
              message: 'User not found'
            }
          });
        }
      } catch (error) {
        return res.status(401).json({
          error: {
            code: 'unauthorized',
            message: 'Invalid token'
          }
        });
      }
    }

    // If it's a JWT token and we haven't found the user yet
    if (!isOutsetaToken && decoded) {
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
      user = await User.findOne({ where: { id: decoded.userId } });

      if (!user) {
        return res.status(401).json({
          error: {
            code: 'unauthorized',
            message: 'User not found'
          }
        });
      }
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
