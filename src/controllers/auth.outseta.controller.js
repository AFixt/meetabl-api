/**
 * Authentication controller for Outseta integration
 *
 * Handles authentication flow with Outseta
 *
 * @author meetabl Team
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { User, AuditLog, JwtBlacklist } = require('../models');
const outsetaService = require('../services/outseta.service');
const { asyncHandler, successResponse, unauthorizedError } = require('../utils/error-response');

/**
 * Register a new user - Redirects to Outseta
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const register = asyncHandler(async (req, res) => {
  const redirectUrl = req.query.redirect || process.env.APP_URL || 'http://localhost:3000';
  const planId = req.query.plan;
  
  // Log registration attempt
  await AuditLog.create({
    userId: null,
    action: 'register_redirect',
    resource: 'auth',
    resourceId: null,
    details: { redirectUrl, planId },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  // Redirect to Outseta signup
  const signupUrl = outsetaService.getSignupUrl(redirectUrl, planId);
  res.json({
    message: 'Redirect to Outseta signup',
    redirectUrl: signupUrl
  });
});

/**
 * Login user - Redirects to Outseta
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const login = asyncHandler(async (req, res) => {
  const redirectUrl = req.query.redirect || process.env.APP_URL || 'http://localhost:3000';
  
  // Log login attempt
  await AuditLog.create({
    userId: null,
    action: 'login_redirect',
    resource: 'auth',
    resourceId: null,
    details: { redirectUrl },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  // Redirect to Outseta login
  const loginUrl = outsetaService.getLoginUrl(redirectUrl);
  res.json({
    message: 'Redirect to Outseta login',
    redirectUrl: loginUrl
  });
});

/**
 * Handle Outseta callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const callback = asyncHandler(async (req, res) => {
  const { access_token } = req.body;

  if (!access_token) {
    throw unauthorizedError('Access token is required');
  }

  // Validate token with Outseta
  const userData = await outsetaService.validateToken(access_token);

  // Find or create user in local database
  let user = await User.findOne({ where: { outseta_uid: userData.uid } });

  if (!user) {
    // Check if user exists with same email but no Outseta ID
    user = await User.findOne({ where: { email: userData.email } });
    
    if (user) {
      // Update existing user with Outseta ID
      await user.update({
        outseta_uid: userData.uid,
        emailVerified: true,
        emailVerifiedAt: new Date()
      });
    } else {
      // Create new user
      user = await User.create({
        outseta_uid: userData.uid,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        timezone: userData.timezone || 'UTC',
        role: 'user',
        status: 'active',
        emailVerified: true,
        emailVerifiedAt: new Date()
      });
    }
  }

  // Update subscription info
  try {
    const subscription = await outsetaService.getUserSubscription(userData.uid);
    if (subscription) {
      await user.update({
        subscription_plan: subscription.plan?.name,
        subscription_status: subscription.status,
        subscription_end_date: subscription.endDate
      });
    }
  } catch (error) {
    logger.warn('Failed to fetch subscription info', { error: error.message });
  }

  // Create JWT token for local session
  const jti = uuidv4();
  
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      jti: jti
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      algorithm: 'HS256'
    }
  );

  // Create refresh token
  const refreshToken = jwt.sign(
    {
      userId: user.id,
      jti: uuidv4()
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      algorithm: 'HS256'
    }
  );

  // Set secure cookies
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  // Log successful login
  await AuditLog.create({
    userId: user.id,
    action: 'login',
    resource: 'auth',
    resourceId: user.id,
    details: { method: 'outseta' },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  successResponse(res, {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      subscriptionPlan: user.subscription_plan,
      subscriptionStatus: user.subscription_status
    },
    message: 'Login successful'
  });
});

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies.jwt || req.headers.authorization?.substring(7);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Add token to blacklist
      if (decoded.jti) {
        await JwtBlacklist.create({
          jwtId: decoded.jti,
          userId: decoded.userId,
          expiresAt: new Date(decoded.exp * 1000)
        });
      }

      // Log logout
      await AuditLog.create({
        userId: req.user.id,
        action: 'logout',
        resource: 'auth',
        resourceId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    } catch (error) {
      logger.error('Error during logout:', error);
    }
  }

  // Clear cookies
  res.clearCookie('jwt');
  res.clearCookie('refreshToken');

  successResponse(res, { message: 'Logout successful' });
});

/**
 * Refresh JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw unauthorizedError('Refresh token not provided');
  }

  // Verify refresh token
  const decoded = jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
  );

  // Get user
  const user = await User.findOne({ where: { id: decoded.userId } });

  if (!user || user.status !== 'active') {
    throw unauthorizedError('Invalid refresh token');
  }

  // Check if user has Outseta ID and validate with Outseta
  if (user.outseta_uid) {
    try {
      await outsetaService.getUser(user.outseta_uid);
    } catch (error) {
      throw unauthorizedError('User validation failed');
    }
  }

  // Generate new tokens
  const jti = uuidv4();
  
  const newToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      jti: jti
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      algorithm: 'HS256'
    }
  );

  const newRefreshToken = jwt.sign(
    {
      userId: user.id,
      jti: uuidv4()
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      algorithm: 'HS256'
    }
  );

  // Set new cookies
  res.cookie('jwt', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  successResponse(res, {
    message: 'Token refreshed successfully'
  });
});

/**
 * Get current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;

  // Update subscription info if user has Outseta ID
  if (user.outseta_uid) {
    try {
      const subscription = await outsetaService.getUserSubscription(user.outseta_uid);
      if (subscription) {
        await user.update({
          subscription_plan: subscription.plan?.name,
          subscription_status: subscription.status,
          subscription_end_date: subscription.endDate
        });
      }
    } catch (error) {
      logger.warn('Failed to fetch subscription info', { error: error.message });
    }
  }

  successResponse(res, {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      subscriptionPlan: user.subscription_plan,
      subscriptionStatus: user.subscription_status,
      emailVerified: user.emailVerified
    }
  });
});

module.exports = {
  register,
  login,
  callback,
  logout,
  refreshToken,
  getCurrentUser
};