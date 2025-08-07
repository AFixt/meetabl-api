/**
 * Calendar service
 *
 * Manages external calendar integrations and event syncing
 *
 * @author meetabl Team
 */

const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
const { isBefore, addSeconds, formatISO } = require('date-fns');
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
    if (isBefore(new Date(token.expires_at), new Date())) {
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
      access_token: token.accessToken,
      refresh_token: token.refreshToken
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
      refresh_token: token.refreshToken
    });

    // Refresh token
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update token in database
    token.accessToken = credentials.access_token;
    token.expiresAt = addSeconds(new Date(), credentials.expires_in);
    await token.save();

    logger.info(`Refreshed Google token for user ${token.userId}`);
  } catch (error) {
    logger.error('Error refreshing Google token:', error);
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
    if (isBefore(new Date(token.expiresAt), new Date())) {
      await refreshMicrosoftToken(token);
    }

    // Create Microsoft Graph client
    const client = Client.init({
      authProvider: (done) => {
        done(null, token.accessToken);
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
    // Use native fetch (available in Node.js 18+)
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI
      }).toString()
    });

    if (!tokenResponse.ok) {
      throw new Error(`Microsoft token refresh failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();

    // Update token in database
    token.accessToken = tokens.access_token;
    token.refreshToken = tokens.refresh_token || token.refreshToken;
    token.expiresAt = addSeconds(new Date(), tokens.expires_in);
    await token.save();

    logger.info(`Refreshed Microsoft token for user ${token.userId}`);
  } catch (error) {
    logger.error('Error refreshing Microsoft token:', error);
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
    const user = await User.findOne({ where: { id: booking.userId } });

    if (!user || !user.calendar_provider || user.calendar_provider === 'none') {
      logger.info(`No calendar provider configured for user ${booking.userId}`);
      return null;
    }

    // Format event times - handle both camelCase and snake_case
    const startTime = formatISO(new Date(booking.startTime || booking.start_time));
    const endTime = formatISO(new Date(booking.endTime || booking.end_time));

    // Create event based on provider
    if (user.calendar_provider === 'google') {
      return await createGoogleCalendarEvent(user.id, {
        summary: `Meeting with ${booking.customerName || booking.customer_name}`,
        description: booking.description || booking.notes || 'meetabl booking',
        start: { dateTime: startTime, timeZone: user.timezone },
        end: { dateTime: endTime, timeZone: user.timezone },
        attendees: [{ email: booking.customerEmail || booking.customer_email }]
      });
    } if (user.calendar_provider === 'microsoft') {
      return await createMicrosoftCalendarEvent(user.id, {
        subject: `Meeting with ${booking.customerName || booking.customer_name}`,
        body: {
          contentType: 'text',
          content: booking.description || booking.notes || 'meetabl booking'
        },
        start: { dateTime: startTime, timeZone: user.timezone },
        end: { dateTime: endTime, timeZone: user.timezone },
        attendees: [
          {
            emailAddress: { address: booking.customerEmail || booking.customer_email },
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
    logger.error('Error creating Google Calendar event:', error);
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
    logger.error('Error creating Microsoft Calendar event:', error);
    throw error;
  }
};

/**
 * Get busy times from Google Calendar
 * @param {string} userId - User ID
 * @param {Date} startTime - Start time for query
 * @param {Date} endTime - End time for query
 * @returns {Promise<Array>} Array of busy time intervals
 */
const getGoogleBusyTimes = async (userId, startTime, endTime) => {
  try {
    const auth = await getGoogleAuthClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    // Get events for the date range
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: formatISO(startTime),
      timeMax: formatISO(endTime),
      singleEvents: true,
      orderBy: 'startTime'
    });

    // Convert events to busy time intervals
    // Include all events except cancelled or transparent ones
    const busyTimes = response.data.items
      .filter(event => event.start && event.end && event.status !== 'cancelled')
      .map(event => ({
        start: new Date(event.start.dateTime || event.start.date),
        end: new Date(event.end.dateTime || event.end.date)
      }));

    logger.info(`Found ${busyTimes.length} Google calendar busy times for user ${userId}`, {
      startTime: formatISO(startTime),
      endTime: formatISO(endTime),
      events: busyTimes.map(bt => ({
        start: bt.start.toISOString(),
        end: bt.end.toISOString()
      }))
    });

    return busyTimes;
  } catch (error) {
    logger.error(`Error getting Google busy times for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Get busy times from Microsoft Calendar
 * @param {string} userId - User ID
 * @param {Date} startTime - Start time for query
 * @param {Date} endTime - End time for query
 * @returns {Promise<Array>} Array of busy time intervals
 */
const getMicrosoftBusyTimes = async (userId, startTime, endTime) => {
  try {
    const client = await getMicrosoftGraphClient(userId);

    // Get events for the date range
    // We need events that overlap with our time range, so:
    // - Events that start before our end time AND
    // - Events that end after our start time
    logger.debug(`Microsoft Graph API query for user ${userId}:`, {
      filter: `start/dateTime lt '${formatISO(endTime)}' and end/dateTime gt '${formatISO(startTime)}'`,
      startTime: formatISO(startTime),
      endTime: formatISO(endTime)
    });
    
    // Use calendarView to properly handle recurring events
    // This endpoint expands recurring events into individual occurrences
    // MUST use calendarView for recurring events to work properly
    const response = await client
      .api('/me/calendarView')
      .query({
        startDateTime: formatISO(startTime),
        endDateTime: formatISO(endTime)
      })
      .select('start,end,subject,isCancelled,showAs,isAllDay,location')
      .orderby('start/dateTime')
      .top(500)
      .get();
    
    logger.debug(`Microsoft Graph API response for user ${userId}:`, {
      eventCount: response.value?.length || 0,
      events: response.value?.slice(0, 5).map(e => ({
        subject: e.subject,
        start: e.start,
        end: e.end,
        showAs: e.showAs,
        isCancelled: e.isCancelled
      }))
    });

    // Convert events to busy time intervals
    // Include ALL events except cancelled ones - let the user decide their availability
    // Some users mark actual meetings as "free" in their calendar
    const busyTimes = response.value
      .filter(event => {
        // Only filter out cancelled events and events without proper start/end times
        const include = event.start && event.end && !event.isCancelled;
        if (!include && event.start) {
          logger.debug(`Event filtered out:`, {
            subject: event.subject,
            showAs: event.showAs,
            isCancelled: event.isCancelled,
            hasStart: !!event.start,
            hasEnd: !!event.end,
            reason: !event.start ? 'no start' : !event.end ? 'no end' : 'cancelled'
          });
        }
        return include;
      })
      .map(event => ({
        start: new Date(event.start.dateTime || event.start.date),
        end: new Date(event.end.dateTime || event.end.date)
      }));

    logger.info(`Found ${busyTimes.length} Microsoft calendar busy times for user ${userId}`, {
      startTime: formatISO(startTime),
      endTime: formatISO(endTime),
      events: busyTimes.map(bt => ({
        start: bt.start.toISOString(),
        end: bt.end.toISOString()
      }))
    });

    return busyTimes;
  } catch (error) {
    logger.error(`Error getting Microsoft busy times for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Get all busy times from integrated calendars
 * @param {string} userId - User ID
 * @param {Date} startTime - Start time for query
 * @param {Date} endTime - End time for query
 * @returns {Promise<Array>} Array of busy time intervals from all calendars
 */
const getAllBusyTimes = async (userId, startTime, endTime) => {
  try {
    const allBusyTimes = [];

    // Check which calendar providers are connected
    const tokens = await CalendarToken.findAll({
      where: { user_id: userId }
    });

    logger.info(`Found ${tokens.length} calendar tokens for user ${userId}`, {
      providers: tokens.map(t => ({
        provider: t.provider,
        email: t.email,
        expiresAt: t.expiresAt
      }))
    });

    // Fetch busy times from each connected provider
    for (const token of tokens) {
      try {
        logger.info(`Fetching ${token.provider} calendar events for ${token.email || userId}`);
        
        if (token.provider === 'google') {
          const googleBusyTimes = await getGoogleBusyTimes(userId, startTime, endTime);
          allBusyTimes.push(...googleBusyTimes);
          logger.info(`Added ${googleBusyTimes.length} Google calendar busy times`);
        } else if (token.provider === 'microsoft') {
          const microsoftBusyTimes = await getMicrosoftBusyTimes(userId, startTime, endTime);
          allBusyTimes.push(...microsoftBusyTimes);
          logger.info(`Added ${microsoftBusyTimes.length} Microsoft calendar busy times`);
        }
      } catch (error) {
        // Log error but don't fail the entire request if one calendar fails
        logger.error(`Error fetching ${token.provider} calendar for user ${userId}:`, {
          error: error.message,
          stack: error.stack,
          provider: token.provider,
          email: token.email
        });
      }
    }

    logger.info(`Total busy times found for user ${userId}: ${allBusyTimes.length}`);
    return allBusyTimes;
  } catch (error) {
    logger.error(`Error getting all busy times for user ${userId}:`, error);
    throw error;
  }
};

module.exports = {
  createCalendarEvent,
  getGoogleAuthClient,
  getMicrosoftGraphClient,
  getGoogleBusyTimes,
  getMicrosoftBusyTimes,
  getAllBusyTimes,
  getGoogleUserEmail,
  getMicrosoftUserEmail
};

/**
 * Get Google user email
 * @param {string} userId - User ID
 * @param {string} accessToken - Access token to use
 * @returns {Promise<string>} User's Google email
 */
async function getGoogleUserEmail(userId, accessToken) {
  try {
    // Create OAuth2 client with the specific access token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials with the provided access token
    oauth2Client.setCredentials({
      access_token: accessToken
    });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    
    const response = await oauth2.userinfo.get();
    return response.data.email;
  } catch (error) {
    logger.error(`Error getting Google user email for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get Microsoft user email
 * @param {string} userId - User ID
 * @param {string} accessToken - Access token to use
 * @returns {Promise<string>} User's Microsoft email
 */
async function getMicrosoftUserEmail(userId, accessToken) {
  try {
    // Create Microsoft Graph client with the specific access token
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
    
    const response = await client
      .api('/me')
      .select('mail,userPrincipalName')
      .get();
    
    return response.mail || response.userPrincipalName;
  } catch (error) {
    logger.error(`Error getting Microsoft user email for user ${userId}:`, error);
    throw error;
  }
}
