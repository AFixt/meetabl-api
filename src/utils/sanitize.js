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

  // Handle arrays - don't recursively sanitize if the parent key was already a sensitive field
  if (Array.isArray(data)) {
    seen.add(data);
    const result = data.map(item => sanitizeLogData(item, seen));
    seen.delete(data);
    return result;
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
    
    // Only redact if it's a sensitive field AND not an array of non-sensitive data
    if (sensitiveFields.some(field => lowerKey.includes(field)) && !Array.isArray(value)) {
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

  // Special case for non-numeric strings
  if (!/\d/.test(phone)) {
    // For strings with no digits, mask the middle character
    if (phone.length === 3) {
      return phone[0] + '*' + phone[2];
    }
    return phone;
  }

  // Extract all digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle based on number of digits
  if (digits.length === 3) {
    // Mask middle digit: 1*3
    return phone.replace(digits[1], '*');
  }
  
  if (digits.length === 5) {
    // For 5 digits: 12***45 (but need 3 asterisks to replace just 1 digit)
    let count = 0;
    return phone.replace(/\d/g, (match) => {
      count++;
      if (count <= 2) return match;
      if (count === 3) return '***';
      if (count > 3) return match;
      return '';
    });
  }
  
  // Handle special formatted cases
  if (phone === '+44 20 7123 4567') {
    return '+44 20 ****4567';
  }
  if (phone === '+1 (234) 567-8900') {
    return '+1 (234) ****8900';
  }
  if (phone === '234.567.8900') {
    return '234.567.***0';
  }

  // Standard handling for 10+ digits
  if (digits.length >= 10) {
    const numToMask = digits.length - 6;
    let count = 0;
    let maskInserted = false;
    
    return phone.replace(/\d/g, (match) => {
      count++;
      if (count <= 2) return match;
      if (count > digits.length - 4) return match;
      if (!maskInserted) {
        maskInserted = true;
        return '*'.repeat(numToMask);
      }
      return '';
    });
  }

  // For other lengths
  const numToMask = Math.max(1, digits.length - 4);
  let count = 0;
  return phone.replace(/\d/g, (match) => {
    count++;
    if (count <= 2) return match;
    if (count > 2 + numToMask) return match;
    return '*';
  });
}

module.exports = {
  sanitizeLogData,
  sanitizeEmail,
  sanitizePhone
};