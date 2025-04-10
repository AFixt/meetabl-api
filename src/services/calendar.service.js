/**
 * Calendar service
 *
 * Manages external calendar integrations and event syncing
 *
 * @author meetabl Team
 */

const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
const moment = require('moment');
const logger = require('../config/logger');
const { CalendarToken, User } = require('../models');

/**
 * Get Google auth client for a user
 * @param {string} userId - User ID
 * @returns {Promise<OAuth2Client>} Google OAuth2 client
 */
const getGoogleAuthClient = async (userId) => {
  try {
    // Find token
    const token = await CalendarToken.findOne({
      where: { user_id: userId, provider: 'google' }
    });

    if (!token) {
      throw new Error('Google Calendar not connected');
    }

    // Check if token is expired
    if (moment(token.expires_at).isBefore(moment())) {
      await refreshGoogleToken(token);
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token
    });

    return oauth2Client;
  } catch (error) {
    logger.error(`Error getting Google auth client for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Refresh Google access token
 * @param {Object} token - CalendarToken instance
 * @returns {Promise<void>}
 */
const refreshGoogleToken = async (token) => {
  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: token.refresh_token
    });

    // Refresh token
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update token in database
    token.access_token = credentials.access_token;
    token.expires_at = moment().add(credentials.expires_in, 'seconds').toDate();
    await token.save();

    logger.info(`Refreshed Google token for user ${token.user_id}`);
  } catch (error) {
    logger.error(`Error refreshing Google token:`, error);
    throw error;
  }
};

/**
 * Get Microsoft Graph client for a user
 * @param {string} userId - User ID
 * @returns {Promise<Client>} Microsoft Graph client
 */
const getMicrosoftGraphClient = async (userId) => {
  try {
    // Find token
    const token = await CalendarToken.findOne({
      where: { user_id: userId, provider: 'microsoft' }
    });

    if (!token) {
      throw new Error('Microsoft Calendar not connected');
    }

    // Check if token is expired
    if (moment(token.expires_at).isBefore(moment())) {
      await refreshMicrosoftToken(token);
    }

    // Create Microsoft Graph client
    const client = Client.init({
      authProvider: (done) => {
        done(null, token.access_token);
      }
    });

    return client;
  } catch (error) {
    logger.error(`Error getting Microsoft Graph client for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Refresh Microsoft access token
 * @param {Object} token - CalendarToken instance
 * @returns {Promise<void>}
 */
const refreshMicrosoftToken = async (token) => {
  try {
    // Exchange refresh token for new access token
    const fetch = require('node-fetch');
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI
      }).toString()
    });

    if (!tokenResponse.ok) {
      throw new Error(`Microsoft token refresh failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();

    // Update token in database
    token.access_token = tokens.access_token;
    token.refresh_token = tokens.refresh_token || token.refresh_token;
    token.expires_at = moment().add(tokens.expires_in, 'seconds').toDate();
    await token.save();

    logger.info(`Refreshed Microsoft token for user ${token.user_id}`);
  } catch (error) {
    logger.error(`Error refreshing Microsoft token:`, error);
    throw error;
  }
};

/**
 * Create calendar event for booking
 * @param {Object} booking - Booking instance
 * @returns {Promise<Object>} Created event details
 */
const createCalendarEvent = async (booking) => {
  try {
    // Get user
    const user = await User.findOne({ where: { id: booking.user_id } });

    if (!user || !user.calendar_provider || user.calendar_provider === 'none') {
      logger.info(`No calendar provider configured for user ${booking.user_id}`);
      return null;
    }

    // Format event times
    const startTime = moment(booking.start_time).format();
    const endTime = moment(booking.end_time).format();

    // Create event based on provider
    if (user.calendar_provider === 'google') {
      return await createGoogleCalendarEvent(user.id, {
        summary: `Meeting with ${booking.customer_name}`,
        description: booking.description || 'meetabl booking',
        start: { dateTime: startTime, timeZone: user.timezone },
        end: { dateTime: endTime, timeZone: user.timezone },
        attendees: [{ email: booking.customer_email }]
      });
    } else if (user.calendar_provider === 'microsoft') {
      return await createMicrosoftCalendarEvent(user.id, {
        subject: `Meeting with ${booking.customer_name}`,
        body: {
          contentType: 'text',
          content: booking.description || 'meetabl booking'
        },
        start: { dateTime: startTime, timeZone: user.timezone },
        end: { dateTime: endTime, timeZone: user.timezone },
        attendees: [
          {
            emailAddress: { address: booking.customer_email },
            type: 'required'
          }
        ]
      });
    }

    return null;
  } catch (error) {
    logger.error(`Error creating calendar event for booking ${booking.id}:`, error);
    throw error;
  }
};

/**
 * Create Google Calendar event
 * @param {string} userId - User ID
 * @param {Object} eventDetails - Event details
 * @returns {Promise<Object>} Created event
 */
const createGoogleCalendarEvent = async (userId, eventDetails) => {
  try {
    // Get Google auth client
    const auth = await getGoogleAuthClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    // Create event
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventDetails,
      sendUpdates: 'all'
    });

    logger.info(`Google Calendar event created for user ${userId}: ${response.data.id}`);
    return response.data;
  } catch (error) {
    logger.error(`Error creating Google Calendar event:`, error);
    throw error;
  }
};

/**
 * Create Microsoft Calendar event
 * @param {string} userId - User ID
 * @param {Object} eventDetails - Event details
 * @returns {Promise<Object>} Created event
 */
const createMicrosoftCalendarEvent = async (userId, eventDetails) => {
  try {
    // Get Microsoft Graph client
    const client = await getMicrosoftGraphClient(userId);

    // Create event
    const response = await client
      .api('/me/events')
      .post(eventDetails);

    logger.info(`Microsoft Calendar event created for user ${userId}: ${response.id}`);
    return response;
  } catch (error) {
    logger.error(`Error creating Microsoft Calendar event:`, error);
    throw error;
  }
};

module.exports = {
  createCalendarEvent,
  getGoogleAuthClient,
  getMicrosoftGraphClient
};