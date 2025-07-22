/**
 * Calendar controller
 *
 * Handles OAuth integration with Google Calendar and Microsoft Graph
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
const { addSeconds } = require('date-fns');
const logger = require('../config/logger');
const { User, CalendarToken, AuditLog } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Get Google OAuth authorization URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGoogleAuthUrl = (req, res) => {
  try {
    const userId = req.user.id;

    // Check if Google OAuth credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      logger.warn('Google OAuth credentials not configured');
      return res.status(503).json({
        error: {
          code: 'service_unavailable',
          message: 'Google Calendar integration is not configured. Please contact your administrator.'
        }
      });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state: userId // Pass user ID as state parameter
    });

    // Log authorization request
    logger.info(`Google Calendar auth URL generated for user: ${userId}`);

    return res.status(200).json({ authUrl });
  } catch (error) {
    logger.error('Error generating Google auth URL:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to generate Google authorization URL'
      }
    });
  }
};

/**
 * Handle Google OAuth callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleGoogleCallback = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Missing authorization code or state'
        }
      });
    }

    // Verify user exists
    const userId = state;
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid user ID'
        }
      });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Check existing token
    const existingToken = await CalendarToken.findOne({
      where: { user_id: userId, provider: 'google' }
    });

    // Calculate expiry date
    const expiresAt = addSeconds(new Date(), tokens.expires_in);

    if (existingToken) {
      // Update existing token
      existingToken.access_token = tokens.access_token;
      existingToken.refresh_token = tokens.refresh_token || existingToken.refresh_token;
      existingToken.expires_at = expiresAt;
      existingToken.scope = tokens.scope;

      await existingToken.save({ transaction });
    } else {
      // Create new token
      await CalendarToken.create({
        id: uuidv4(),
        user_id: userId,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope
      }, { transaction });

      // Update user calendar provider
      user.calendar_provider = 'google';
      await user.save({ transaction });
    }

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'calendar.google.connect',
      metadata: {
        scope: tokens.scope
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log successful connection
    logger.info(`Google Calendar connected for user: ${userId}`);

    // Redirect to frontend
    return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?success=true&provider=google`);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error handling Google callback:', error);

    // Redirect to frontend with error
    return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=true&provider=google`);
  }
};

/**
 * Get Microsoft OAuth authorization URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMicrosoftAuthUrl = (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if Microsoft OAuth credentials are configured
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      logger.warn('Microsoft OAuth credentials not configured');
      return res.status(503).json({
        error: {
          code: 'service_unavailable',
          message: 'Microsoft Calendar integration is not configured. Please contact your administrator.'
        }
      });
    }

    // Microsoft OAuth configuration
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${
      process.env.MICROSOFT_CLIENT_ID
    }&response_type=code&redirect_uri=${
      encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI)
    }&scope=Calendars.ReadWrite%20offline_access&state=${
      userId
    }`;

    // Log authorization request
    logger.info(`Microsoft Calendar auth URL generated for user: ${userId}`);

    return res.status(200).json({ authUrl });
  } catch (error) {
    logger.error('Error generating Microsoft auth URL:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to generate Microsoft authorization URL'
      }
    });
  }
};

/**
 * Handle Microsoft OAuth callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleMicrosoftCallback = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Missing authorization code or state'
        }
      });
    }

    // Verify user exists
    const userId = state;
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid user ID'
        }
      });
    }

    // Exchange code for tokens
    const fetch = require('node-fetch');
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code'
      }).toString()
    });

    if (!tokenResponse.ok) {
      throw new Error(`Microsoft token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();

    // Check existing token
    const existingToken = await CalendarToken.findOne({
      where: { user_id: userId, provider: 'microsoft' }
    });

    // Calculate expiry date
    const expiresAt = addSeconds(new Date(), tokens.expires_in);

    if (existingToken) {
      // Update existing token
      existingToken.access_token = tokens.access_token;
      existingToken.refresh_token = tokens.refresh_token || existingToken.refresh_token;
      existingToken.expires_at = expiresAt;
      existingToken.scope = tokens.scope;

      await existingToken.save({ transaction });
    } else {
      // Create new token
      await CalendarToken.create({
        id: uuidv4(),
        user_id: userId,
        provider: 'microsoft',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope
      }, { transaction });

      // Update user calendar provider
      user.calendar_provider = 'microsoft';
      await user.save({ transaction });
    }

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'calendar.microsoft.connect',
      metadata: {
        scope: tokens.scope
      }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log successful connection
    logger.info(`Microsoft Calendar connected for user: ${userId}`);

    // Redirect to frontend
    return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?success=true&provider=microsoft`);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error handling Microsoft callback:', error);

    // Redirect to frontend with error
    return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=true&provider=microsoft`);
  }
};

/**
 * Get calendar integration status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCalendarStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user
    const user = await User.findOne({
      where: { id: userId },
      attributes: ['id', 'calendar_provider']
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'User not found'
        }
      });
    }

    // Find calendar tokens
    const tokens = await CalendarToken.findAll({
      where: { user_id: userId },
      attributes: ['provider', 'expires_at', 'scope']
    });

    const calendarStatus = {
      provider: user.calendar_provider,
      connected: user.calendar_provider !== 'none',
      connections: tokens.map((token) => ({
        provider: token.provider,
        expires_at: token.expires_at,
        scope: token.scope
      }))
    };

    return res.status(200).json(calendarStatus);
  } catch (error) {
    logger.error('Error getting calendar status:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get calendar integration status'
      }
    });
  }
};

/**
 * Disconnect calendar integration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const disconnectCalendar = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { provider } = req.params;

    // Validate provider
    if (!provider || !['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Invalid provider',
          params: [
            {
              param: 'provider',
              message: 'Provider must be "google" or "microsoft"'
            }
          ]
        }
      });
    }

    // Find user
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'User not found'
        }
      });
    }

    // Find and delete token
    const token = await CalendarToken.findOne({
      where: { user_id: userId, provider }
    });

    if (token) {
      await token.destroy({ transaction });
    }

    // Update user calendar provider if it matches the disconnected provider
    if (user.calendar_provider === provider) {
      user.calendar_provider = 'none';
      await user.save({ transaction });
    }

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: `calendar.${provider}.disconnect`,
      metadata: {}
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log disconnection
    logger.info(`${provider} Calendar disconnected for user: ${userId}`);

    return res.status(200).json({
      message: `${provider} Calendar disconnected successfully`
    });
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error disconnecting calendar:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to disconnect calendar integration'
      }
    });
  }
};

/**
 * Get Google Calendar integration status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGoogleStatus = (req, res) => {
  try {
    // Check if Google OAuth credentials are configured
    const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    
    return res.status(200).json({
      provider: 'google',
      configured: isConfigured,
      message: isConfigured 
        ? 'Google Calendar integration is available'
        : 'Google Calendar integration is not configured. OAuth credentials are missing.'
    });
  } catch (error) {
    logger.error('Error getting Google Calendar status:', error);
    
    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get Google Calendar status'
      }
    });
  }
};

/**
 * Get Microsoft Calendar integration status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMicrosoftStatus = (req, res) => {
  try {
    // Check if Microsoft OAuth credentials are configured
    const isConfigured = !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
    
    return res.status(200).json({
      provider: 'microsoft',
      configured: isConfigured,
      message: isConfigured 
        ? 'Microsoft Calendar integration is available'
        : 'Microsoft Calendar integration is not configured. OAuth credentials are missing.'
    });
  } catch (error) {
    logger.error('Error getting Microsoft Calendar status:', error);
    
    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get Microsoft Calendar status'
      }
    });
  }
};

module.exports = {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getMicrosoftAuthUrl,
  handleMicrosoftCallback,
  getCalendarStatus,
  disconnectCalendar,
  getGoogleStatus,
  getMicrosoftStatus
};
