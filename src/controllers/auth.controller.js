/**
 * Authentication controller
 *
 * Handles user registration, login, and token management
 *
 * @author meetabl Team
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { User, UserSettings, AuditLog, JwtBlacklist } = require('../models');
const { sequelize } = require('../config/database');
const { sendPasswordResetEmail, sendEmailVerification } = require('../services/notification.service');
const { asyncHandler, successResponse, conflictError, unauthorizedError, notFoundError, validationError, createError } = require('../utils/error-response');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const register = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      name, email, password, timezone
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      throw conflictError('Email already in use');
    }

    // Create user
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = uuidv4();
    
    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    const user = await User.create({
      id: userId,
      name,
      email,
      password_hash: passwordHash,
      timezone: timezone || 'UTC',
      email_verified: false,
      email_verification_token: hashedVerificationToken,
      email_verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
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

    // Generate JWT token with unique ID
    const jti = uuidv4();
    const token = jwt.sign(
      { userId: user.id, jti },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Commit transaction
    await transaction.commit();
    
    // Send verification email
    try {
      await sendEmailVerification(user, verificationToken);
    } catch (emailError) {
      logger.error('Error sending verification email:', emailError);
      // Continue anyway - user can request resend
    }

    // Log successful registration
    logger.info(`User registered: ${email}`);

    // Set secure httpOnly cookies for tokens
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    res.cookie('token', token, cookieOptions);

    // Return user data without token
    return successResponse(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      email_verified: user.email_verified
    }, 'User registered successfully', 201);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const login = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      throw unauthorizedError('Invalid email or password');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw unauthorizedError('Invalid email or password');
    }

    // Generate JWT token with unique ID
    const jti = uuidv4();
    const token = jwt.sign(
      { userId: user.id, jti },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Generate refresh token with unique ID
    const refreshJti = uuidv4();
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh', jti: refreshJti },
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

    // Set secure httpOnly cookies for tokens
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    const refreshCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    };

    res.cookie('token', token, cookieOptions);
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    // Return user data without tokens
    return successResponse(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone
    }, 'Login successful');
  } catch (error) {
    throw error;
  }
});

/**
 * Refresh auth token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refreshToken = asyncHandler(async (req, res) => {
  try {
    // Get refresh token from cookie instead of body
    const tokenFromCookie = req.cookies.refreshToken;

    if (!tokenFromCookie) {
      throw validationError([{ field: 'refreshToken', message: 'Refresh token is required' }]);
    }

    // Verify refresh token
    const decoded = jwt.verify(tokenFromCookie, process.env.JWT_SECRET);

    if (!decoded.userId || decoded.type !== 'refresh') {
      throw unauthorizedError('Invalid refresh token');
    }

    // Find user
    const user = await User.findOne({ where: { id: decoded.userId } });

    if (!user) {
      throw unauthorizedError('User not found');
    }

    // Generate new JWT token with unique ID
    const jti = uuidv4();
    const token = jwt.sign(
      { userId: user.id, jti },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Generate new refresh token with unique ID
    const newRefreshJti = uuidv4();
    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh', jti: newRefreshJti },
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

    // Set secure httpOnly cookies for new tokens
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    const refreshCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    };

    res.cookie('token', token, cookieOptions);
    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);

    // Return success without tokens
    return successResponse(res, null, 'Tokens refreshed successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = asyncHandler(async (req, res) => {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies.token || 
                  (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                    ? req.headers.authorization.substring(7) 
                    : null);

    if (!token) {
      throw validationError([{ field: 'token', message: 'Authorization token required' }]);
    }
    
    // Decode token to get jti and expiration
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) {
      throw validationError([{ field: 'token', message: 'Invalid token format' }]);
    }

    // Calculate expiration time
    const expiresAt = new Date(decoded.exp * 1000);

    // Add token to blacklist
    await JwtBlacklist.create({
      id: uuidv4(),
      jwtId: decoded.jti,
      token,
      userId: decoded.userId,
      reason: 'logout',
      expiresAt
    });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: decoded.userId,
      action: 'user.logout',
      metadata: {
        jti: decoded.jti
      }
    });

    logger.info(`User logged out: ${decoded.userId}`);

    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');

    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Request password reset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const forgotPassword = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists or not for security
      return successResponse(res, null, 'If an account exists with this email, a password reset link has been sent.');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save hashed token and expiration to user
    user.password_reset_token = hashedToken;
    user.password_reset_expires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Send password reset email
    try {
      await sendPasswordResetEmail(user, resetToken);
    } catch (emailError) {
      logger.error('Error sending password reset email:', emailError);
      // Still return success to not reveal if email exists
    }

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: user.id,
      action: 'user.password_reset_requested',
      metadata: {
        email
      }
    });

    logger.info(`Password reset requested for: ${email}`);

    return successResponse(res, null, 'If an account exists with this email, a password reset link has been sent.');
  } catch (error) {
    throw error;
  }
});

/**
 * Reset password with token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resetPassword = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { token, password } = req.body;

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      where: {
        password_reset_token: hashedToken,
        password_reset_expires: { [sequelize.Op.gt]: Date.now() }
      }
    });

    if (!user) {
      throw validationError([{ field: 'token', message: 'Invalid or expired reset token' }]);
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(password, salt);
    user.password_reset_token = null;
    user.password_reset_expires = null;
    await user.save({ transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: user.id,
      action: 'user.password_reset_completed',
      metadata: {
        email: user.email
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    logger.info(`Password reset completed for: ${user.email}`);

    return successResponse(res, null, 'Password has been reset successfully');
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Verify email with token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { token } = req.body;

    if (!token) {
      throw validationError([{ field: 'token', message: 'Verification token is required' }]);
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid verification token
    const user = await User.findOne({
      where: {
        email_verification_token: hashedToken,
        email_verification_expires: { [sequelize.Op.gt]: Date.now() }
      }
    });

    if (!user) {
      throw validationError([{ field: 'token', message: 'Invalid or expired verification token' }]);
    }

    // Update user as verified
    user.email_verified = true;
    user.email_verification_token = null;
    user.email_verification_expires = null;
    await user.save({ transaction });

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: user.id,
      action: 'user.email_verified',
      metadata: {
        email: user.email
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    logger.info(`Email verified for: ${user.email}`);

    return successResponse(res, null, 'Email verified successfully');
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();
    throw error;
  }
});

/**
 * Resend verification email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resendVerificationEmail = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      throw notFoundError('User');
    }

    // Check if already verified
    if (user.email_verified) {
      throw validationError([{ field: 'email', message: 'Email is already verified' }]);
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    // Update user with new token
    user.email_verification_token = hashedToken;
    user.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    // Send verification email
    try {
      await sendEmailVerification(user, verificationToken);
    } catch (emailError) {
      logger.error('Error sending verification email:', emailError);
      throw createError('EXTERNAL_SERVICE_ERROR', 'Failed to send verification email');
    }

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: user.id,
      action: 'user.verification_email_resent',
      metadata: {
        email: user.email
      }
    });

    logger.info(`Verification email resent to: ${user.email}`);

    return successResponse(res, null, 'Verification email has been sent');
  } catch (error) {
    throw error;
  }
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail
};
