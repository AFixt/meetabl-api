/**
 * Authentication controller
 *
 * Handles user registration, login, and token management
 *
 * @author AccessMeet Team
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { User, UserSettings, AuditLog } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const register = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      name, email, password, timezone
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Email already in use',
          params: [
            {
              param: 'email',
              message: 'A user with this email already exists'
            }
          ]
        }
      });
    }

    // Create user
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = uuidv4();

    const user = await User.create({
      id: userId,
      name,
      email,
      password_hash: passwordHash,
      timezone: timezone || 'UTC'
    }, { transaction });

    // Create default user settings
    await UserSettings.create({
      id: uuidv4(),
      user_id: userId
    }, { transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'user.register',
      metadata: {
        email,
        timezone
      }
    }, { transaction });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Commit transaction
    await transaction.commit();

    // Log successful registration
    logger.info(`User registered: ${email}`);

    // Return user data and token
    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      token
    });
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Registration error:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to register user'
      }
    });
  }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid email or password'
        }
      });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid email or password'
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: user.id,
      action: 'user.login',
      metadata: {
        email
      }
    });

    // Log successful login
    logger.info(`User logged in: ${email}`);

    // Return user data and tokens
    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to log in'
      }
    });
  }
};

/**
 * Refresh auth token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Refresh token is required',
          params: [
            {
              param: 'refreshToken',
              message: 'Refresh token is required'
            }
          ]
        }
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (!decoded.userId || decoded.type !== 'refresh') {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid refresh token'
        }
      });
    }

    // Find user
    const user = await User.findOne({ where: { id: decoded.userId } });

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'User not found'
        }
      });
    }

    // Generate new JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: user.id,
      action: 'user.token_refresh',
      metadata: {}
    });

    // Log token refresh
    logger.info(`Token refreshed for user: ${user.id}`);

    // Return new tokens
    return res.status(200).json({
      token,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    // Handle JWT errors
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Refresh token expired'
        }
      });
    } if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid refresh token'
        }
      });
    }

    logger.error('Token refresh error:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to refresh token'
      }
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken
};
