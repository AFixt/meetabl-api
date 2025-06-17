/**
 * Data Validation Utilities
 * 
 * Utility functions for validating various data types and formats
 * 
 * @author meetabl Team
 */

/**
 * Validates email address format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Phone number should have at least 10 digits
  return digits.length >= 10;
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {boolean} True if password meets strength requirements
 */
function isValidPassword(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // At least 8 characters, contains uppercase, lowercase, and number
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return minLength && hasUpper && hasLower && hasNumber;
}

/**
 * Validates timezone identifier
 * @param {string} timezone - Timezone to validate
 * @returns {boolean} True if valid timezone
 */
function isValidTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') {
    return false;
  }

  try {
    // Use Intl.DateTimeFormat to validate timezone
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validates date format and value
 * @param {string|Date} date - Date to validate
 * @returns {boolean} True if valid date
 */
function isValidDate(date) {
  if (!date) {
    return false;
  }

  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
}

/**
 * Validates booking duration in minutes
 * @param {number} duration - Duration in minutes
 * @returns {boolean} True if valid duration
 */
function isValidDuration(duration) {
  if (typeof duration !== 'number' || isNaN(duration)) {
    return false;
  }

  // Duration should be between 15 minutes and 24 hours (1440 minutes)
  return duration >= 15 && duration <= 1440;
}

/**
 * Sanitizes user input by removing HTML tags and trimming
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags and decode HTML entities
  const withoutTags = input.replace(/<[^>]*>/g, '');
  const decoded = withoutTags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");

  return decoded.trim();
}

/**
 * Validates booking time constraints
 * @param {Date} dateTime - Date and time to validate
 * @param {boolean} requireBusinessHours - Whether to enforce business hours
 * @returns {boolean} True if valid booking time
 */
function validateBookingTime(dateTime, requireBusinessHours = false) {
  if (!isValidDate(dateTime)) {
    return false;
  }

  const bookingDate = new Date(dateTime);
  const now = new Date();

  // Must be in the future
  if (bookingDate <= now) {
    return false;
  }

  // Check business hours if required (9 AM to 6 PM)
  if (requireBusinessHours) {
    const hour = bookingDate.getHours();
    if (hour < 9 || hour >= 18) {
      return false;
    }
  }

  return true;
}

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidPassword,
  isValidTimezone,
  isValidDate,
  isValidDuration,
  sanitizeInput,
  validateBookingTime
};