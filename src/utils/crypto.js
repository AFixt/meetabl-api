/**
 * Cryptographic Utilities
 * 
 * Provides secure token generation and validation utilities
 * for booking confirmations, user verification, and other security tokens
 * 
 * @author meetabl Team
 */

const crypto = require('crypto');

/**
 * Generates a secure random token
 * @param {number} bytes - Number of random bytes to generate (default: 32)
 * @returns {string} Hexadecimal token string
 */
const generateSecureToken = (bytes = 32) => {
  if (typeof bytes !== 'number' || bytes <= 0) {
    throw new Error('Bytes must be a positive number');
  }
  
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generates a booking confirmation token
 * @returns {string} 64-character hexadecimal token
 */
const generateBookingConfirmationToken = () => {
  return generateSecureToken(32); // 32 bytes = 64 hex characters
};

/**
 * Generates a user verification token
 * @returns {string} 64-character hexadecimal token
 */
const generateUserVerificationToken = () => {
  return generateSecureToken(32);
};

/**
 * Generates a password reset token
 * @returns {string} 64-character hexadecimal token
 */
const generatePasswordResetToken = () => {
  return generateSecureToken(32);
};

/**
 * Validates token format (hexadecimal string of expected length)
 * @param {string} token - Token to validate
 * @param {number} expectedLength - Expected character length (default: 64)
 * @returns {boolean} True if token has valid format
 */
const validateTokenFormat = (token, expectedLength = 64) => {
  if (typeof token !== 'string') {
    return false;
  }
  
  // Check length
  if (token.length !== expectedLength) {
    return false;
  }
  
  // Check if it's a valid hexadecimal string
  const hexRegex = /^[0-9a-f]+$/i;
  return hexRegex.test(token);
};

/**
 * Creates a token expiration date
 * @param {number} minutesFromNow - Minutes from current time (default: 30)
 * @returns {Date} Expiration date
 */
const createTokenExpiration = (minutesFromNow = 30) => {
  if (typeof minutesFromNow !== 'number' || minutesFromNow <= 0) {
    throw new Error('Minutes must be a positive number');
  }
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + minutesFromNow);
  return expiresAt;
};

/**
 * Checks if a token has expired
 * @param {Date|string} expirationDate - Token expiration date
 * @returns {boolean} True if token has expired
 */
const isTokenExpired = (expirationDate) => {
  const expiry = typeof expirationDate === 'string' 
    ? new Date(expirationDate) 
    : expirationDate;
    
  if (!(expiry instanceof Date) || isNaN(expiry.getTime())) {
    throw new Error('Invalid expiration date');
  }
  
  return new Date() > expiry;
};

/**
 * Generates a token with expiration
 * @param {number} bytes - Number of random bytes (default: 32)
 * @param {number} minutesFromNow - Minutes until expiration (default: 30)
 * @returns {Object} Object containing token and expiresAt date
 */
const generateTokenWithExpiration = (bytes = 32, minutesFromNow = 30) => {
  const token = generateSecureToken(bytes);
  const expiresAt = createTokenExpiration(minutesFromNow);
  
  return {
    token,
    expiresAt
  };
};

module.exports = {
  generateSecureToken,
  generateBookingConfirmationToken,
  generateUserVerificationToken,
  generatePasswordResetToken,
  validateTokenFormat,
  createTokenExpiration,
  isTokenExpired,
  generateTokenWithExpiration
};