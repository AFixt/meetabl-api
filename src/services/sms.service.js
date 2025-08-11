/**
 * SMS Service
 * 
 * Handles sending SMS notifications using Twilio
 * 
 * @author meetabl Team
 */

const twilio = require('twilio');
const logger = require('../config/logger');

// Twilio client
let client = null;

/**
 * Initialize the Twilio client
 * @returns {Object} The Twilio client
 */
function getClient() {
  if (!client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      logger.warn('Twilio credentials not configured');
      return null;
    }
    
    client = twilio(accountSid, authToken);
  }
  
  return client;
}

/**
 * Send an SMS message
 * 
 * @param {string} to - The recipient phone number
 * @param {string} message - The message to send
 * @returns {Promise<Object>} The Twilio message object
 */
async function sendSMS(to, message) {
  try {
    const twilioClient = getClient();
    
    if (!twilioClient) {
      throw new Error('Twilio client not configured');
    }
    
    const from = process.env.TWILIO_PHONE_NUMBER;
    
    if (!from) {
      throw new Error('Twilio phone number not configured');
    }
    
    logger.info(`Sending SMS to ${to}`);
    
    const result = await twilioClient.messages.create({
      body: message,
      from,
      to
    });
    
    logger.info(`SMS sent successfully, SID: ${result.sid}`);
    return result;
  } catch (error) {
    logger.error('Error sending SMS:', error);
    throw error;
  }
}

module.exports = {
  sendSMS
};
