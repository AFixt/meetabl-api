/**
 * Data Sanitization Utilities
 * 
 * Utility functions for sanitizing sensitive data in logs and outputs
 * 
 * @author meetabl Team
 */

/**
 * Sanitizes log data by redacting sensitive fields
 * @param {any} data - The data to sanitize
 * @param {Set} seen - Set to track circular references
 * @returns {any} Sanitized data
 */
function sanitizeLogData(data, seen = new Set()) {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitive types
  if (typeof data !== 'object') {
    return data;
  }

  // Handle circular references
  if (seen.has(data)) {
    return '[Circular Reference]';
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, seen));
  }

  seen.add(data);

  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'apikey', 'accesstoken', 
    'refreshtoken', 'clientsecret', 'jwtsecret', 'apiKey', 'accessToken',
    'refreshToken', 'clientSecret', 'jwtSecret'
  ];

  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, seen);
    } else {
      sanitized[key] = value;
    }
  }

  seen.delete(data);
  return sanitized;
}

/**
 * Sanitizes email addresses for logging
 * @param {string} email - Email address to sanitize
 * @returns {string} Partially masked email
 */
function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return email;
  }

  const atIndex = email.indexOf('@');
  if (atIndex === -1) {
    return email; // Not a valid email format
  }

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);

  if (localPart.length <= 2) {
    return localPart + '***' + domain;
  }

  return localPart.substring(0, 2) + '***' + domain;
}

/**
 * Sanitizes phone numbers for logging
 * @param {string} phone - Phone number to sanitize
 * @returns {string} Partially masked phone number
 */
function sanitizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return phone;
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) {
    return phone.charAt(0) + '*'.repeat(Math.max(1, phone.length - 2)) + phone.slice(-1);
  }

  // Find the position of the last 4 digits in the original string
  const lastFourDigits = digits.slice(-4);
  const firstDigits = digits.slice(0, Math.min(4, digits.length - 4));
  
  // Replace middle part with asterisks while preserving formatting
  let result = phone;
  const digitsToMask = digits.slice(firstDigits.length, -4);
  
  if (digitsToMask.length > 0) {
    for (const digit of digitsToMask) {
      result = result.replace(digit, '*');
    }
  }
  
  return result;
}

module.exports = {
  sanitizeLogData,
  sanitizeEmail,
  sanitizePhone
};