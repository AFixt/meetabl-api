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
const calendarService = require('../services/calendar.service');

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
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
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

    // Calculate expiry date
    const expiresAt = addSeconds(new Date(), tokens.expires_in);

    // Create a temporary token to fetch the email first
    const tempTokenId = uuidv4();
    const newToken = await CalendarToken.create({
      id: tempTokenId,
      userId: userId,
      provider: 'google',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: expiresAt,
      scope: tokens.scope,
      email: 'pending@google.com' // Temporary email
    }, { transaction });

    // Now fetch the email from Google
    try {
      const googleEmail = await calendarService.getGoogleUserEmail(userId, tokens.access_token);
      
      // Check if this email is already connected for this user
      const existingTokenWithEmail = await CalendarToken.findOne({
        where: { 
          userId: userId, 
          provider: 'google',
          email: googleEmail 
        },
        transaction
      });

      if (existingTokenWithEmail && existingTokenWithEmail.id !== tempTokenId) {
        // Email already connected, update existing token instead
        existingTokenWithEmail.accessToken = tokens.access_token;
        existingTokenWithEmail.refreshToken = tokens.refresh_token || existingTokenWithEmail.refreshToken;
        existingTokenWithEmail.expiresAt = expiresAt;
        existingTokenWithEmail.scope = tokens.scope;
        await existingTokenWithEmail.save({ transaction });
        
        // Delete the temporary token we created
        await CalendarToken.destroy({
          where: { id: tempTokenId },
          transaction
        });
        
        logger.info(`Updated existing Google calendar connection for email: ${googleEmail}`);
      } else {
        // New email connection, update the token we just created
        newToken.email = googleEmail;
        await newToken.save({ transaction });
        
        logger.info(`Added new Google calendar connection for email: ${googleEmail}`);
      }
      
      // Update user calendar provider if not already set
      if (user.calendar_provider !== 'google' && user.calendar_provider !== 'microsoft') {
        user.calendar_provider = 'google';
        await user.save({ transaction });
      }
    } catch (error) {
      logger.warn('Failed to fetch Google email, continuing without it:', error);
      // Keep the token but with the temporary email
    }

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
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
    return res.redirect(`${process.env.FRONTEND_URL}/calendar?success=true&provider=google`);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error handling Google callback:', error);

    // Redirect to frontend with error
    return res.redirect(`${process.env.FRONTEND_URL}/calendar?error=true&provider=google`);
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
    // Include User.Read scope to fetch user's email address
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${
      process.env.MICROSOFT_CLIENT_ID
    }&response_type=code&redirect_uri=${
      encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI)
    }&scope=User.Read%20Calendars.ReadWrite%20offline_access&state=${
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
      const errorBody = await tokenResponse.text();
      logger.error('Microsoft token exchange error details:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorBody,
        clientId: process.env.MICROSOFT_CLIENT_ID,
        redirectUri: process.env.MICROSOFT_REDIRECT_URI
      });
      throw new Error(`Microsoft token exchange failed: ${tokenResponse.status} - ${errorBody}`);
    }

    const tokens = await tokenResponse.json();

    // Debug log the Microsoft token response
    logger.info('Microsoft token response received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      userId: userId
    });

    // Calculate expiry date
    const expiresAt = addSeconds(new Date(), tokens.expires_in);

    // Create a temporary token to fetch the email first
    const tempTokenId = uuidv4();
    const newToken = await CalendarToken.create({
      id: tempTokenId,
      userId: userId,
      provider: 'microsoft',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: expiresAt,
      scope: tokens.scope,
      email: 'pending@microsoft.com' // Temporary email
    }, { transaction });

    // Now fetch the email from Microsoft
    try {
      const microsoftEmail = await calendarService.getMicrosoftUserEmail(userId, tokens.access_token);
      
      // Check if this email is already connected for this user
      const existingTokenWithEmail = await CalendarToken.findOne({
        where: { 
          userId: userId, 
          provider: 'microsoft',
          email: microsoftEmail 
        },
        transaction
      });

      if (existingTokenWithEmail && existingTokenWithEmail.id !== tempTokenId) {
        // Email already connected, update existing token instead
        existingTokenWithEmail.accessToken = tokens.access_token;
        existingTokenWithEmail.refreshToken = tokens.refresh_token || existingTokenWithEmail.refreshToken;
        existingTokenWithEmail.expiresAt = expiresAt;
        existingTokenWithEmail.scope = tokens.scope;
        await existingTokenWithEmail.save({ transaction });
        
        // Delete the temporary token we created
        await CalendarToken.destroy({
          where: { id: tempTokenId },
          transaction
        });
        
        logger.info(`Updated existing Microsoft calendar connection for email: ${microsoftEmail}`);
      } else {
        // New email connection, update the token we just created
        newToken.email = microsoftEmail;
        await newToken.save({ transaction });
        
        logger.info(`Added new Microsoft calendar connection for email: ${microsoftEmail}`);
      }
      
      // Update user calendar provider if not already set
      if (user.calendar_provider !== 'microsoft') {
        user.calendar_provider = 'microsoft';
        await user.save({ transaction });
      }
    } catch (error) {
      logger.warn('Failed to fetch Microsoft email, continuing without it:', error);
      // Keep the token but with the temporary email
    }

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
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
    return res.redirect(`${process.env.FRONTEND_URL}/calendar?success=true&provider=microsoft`);
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error handling Microsoft callback:', error);

    // Redirect to frontend with error
    return res.redirect(`${process.env.FRONTEND_URL}/calendar?error=true&provider=microsoft`);
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
      attributes: ['id', 'email', 'calendar_provider']
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
      where: { userId: userId },
      attributes: ['id', 'provider', 'email', 'expiresAt', 'scope', 'createdAt', 'updatedAt']
    });

    // For tokens without email, try to fetch it
    for (const token of tokens) {
      if (!token.email) {
        try {
          if (token.provider === 'google') {
            token.email = await calendarService.getGoogleUserEmail(userId);
          } else if (token.provider === 'microsoft') {
            token.email = await calendarService.getMicrosoftUserEmail(userId);
          }
          // Save the email for future use
          await token.save();
        } catch (error) {
          logger.warn(`Failed to fetch ${token.provider} email for user ${userId}:`, error);
          // Fallback to user's email if we can't fetch from provider
          token.email = user.email;
        }
      }
    }

    const calendarStatus = {
      provider: user.calendar_provider,
      connected: user.calendar_provider !== 'none',
      connections: tokens.map((token) => ({
        id: token.id,
        provider: token.provider,
        email: token.email || user.email, // Use token email if available, otherwise user's email
        isActive: true, // Token exists means it's active
        userId: userId,
        expires_at: token.expiresAt,
        scope: token.scope,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt
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
 * Disconnect calendar integration by token ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const disconnectCalendar = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { tokenId } = req.params;

    // Validate token ID
    if (!tokenId) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Token ID is required'
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

    // Find and delete token (ensure it belongs to the user)
    const token = await CalendarToken.findOne({
      where: { id: tokenId, userId: userId }
    });

    if (!token) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Calendar token not found'
        }
      });
    }

    const provider = token.provider;
    await token.destroy({ transaction });

    // Update user calendar provider if it was the last token of this provider
    const remainingTokens = await CalendarToken.count({
      where: { userId: userId, provider }
    });

    if (user.calendar_provider === provider && remainingTokens === 0) {
      user.calendar_provider = 'none';
      await user.save({ transaction });
    }

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: `calendar.${provider}.disconnect`,
      metadata: { tokenId }
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
 * Legacy: Disconnect calendar by provider (for backward compatibility)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const disconnectCalendarByProvider = async (req, res) => {
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

    // Find and delete all tokens for this provider
    const tokens = await CalendarToken.findAll({
      where: { userId: userId, provider }
    });

    for (const token of tokens) {
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
      userId: userId,
      action: `calendar.${provider}.disconnect_all`,
      metadata: { tokenCount: tokens.length }
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Log disconnection
    logger.info(`${provider} Calendar(s) disconnected for user: ${userId}`);

    return res.status(200).json({
      message: `${provider} Calendar(s) disconnected successfully`,
      tokensRemoved: tokens.length
    });
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error disconnecting calendar by provider:', error);

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
  disconnectCalendarByProvider,
  getGoogleStatus,
  getMicrosoftStatus
};
