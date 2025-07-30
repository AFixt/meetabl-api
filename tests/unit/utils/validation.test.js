/**
 * Validation Utility Tests
 * 
 * Tests for data validation utility functions
 * 
 * @author meetabl Team
 */

const {
  isValidEmail,
  isValidPhone,
  isValidPassword,
  isValidTimezone,
  isValidDate,
  isValidDuration,
  sanitizeInput,
  validateBookingTime
} = require('../../../src/utils/validation');

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    test('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
      expect(isValidEmail('123@domain.com')).toBe(true);
    });

    test('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user.domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    test('should validate correct phone formats', () => {
      expect(isValidPhone('+1234567890')).toBe(true);
      expect(isValidPhone('1234567890')).toBe(true);
      expect(isValidPhone('+44 20 7123 4567')).toBe(true);
      expect(isValidPhone('(555) 123-4567')).toBe(true);
      expect(isValidPhone('555.123.4567')).toBe(true);
    });

    test('should reject invalid phone formats', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('abc123def')).toBe(false);
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone(null)).toBe(false);
      expect(isValidPhone(undefined)).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    test('should validate strong passwords', () => {
      expect(isValidPassword('Password123!')).toBe(true);
      expect(isValidPassword('MySecure123')).toBe(true);
      expect(isValidPassword('Test123456')).toBe(true);
    });

    test('should reject weak passwords', () => {
      expect(isValidPassword('password')).toBe(false); // No uppercase or numbers
      expect(isValidPassword('PASSWORD')).toBe(false); // No lowercase or numbers
      expect(isValidPassword('123456')).toBe(false); // No letters
      expect(isValidPassword('Pass1')).toBe(false); // Too short
      expect(isValidPassword('')).toBe(false);
      expect(isValidPassword(null)).toBe(false);
      expect(isValidPassword(undefined)).toBe(false);
    });
  });

  describe('isValidTimezone', () => {
    test('should validate correct timezone identifiers', () => {
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('America/Los_Angeles')).toBe(true);
    });

    test('should reject invalid timezone identifiers', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('NotATimezone')).toBe(false); // Invalid timezone
      expect(isValidTimezone('GMT+5')).toBe(false); // Invalid format
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone(null)).toBe(false);
      expect(isValidTimezone(undefined)).toBe(false);
    });
  });

  describe('isValidDate', () => {
    test('should validate correct date formats', () => {
      expect(isValidDate('2024-01-01')).toBe(true);
      expect(isValidDate('2024-12-31')).toBe(true);
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate(new Date('2024-01-01'))).toBe(true);
    });

    test('should reject invalid dates', () => {
      expect(isValidDate('2024-13-01')).toBe(false); // Invalid month
      expect(isValidDate('2024-01-32')).toBe(false); // Invalid day
      expect(isValidDate('invalid-date')).toBe(false);
      expect(isValidDate('')).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate(new Date('invalid'))).toBe(false);
    });
  });

  describe('isValidDuration', () => {
    test('should validate reasonable duration values', () => {
      expect(isValidDuration(15)).toBe(true);
      expect(isValidDuration(30)).toBe(true);
      expect(isValidDuration(60)).toBe(true);
      expect(isValidDuration(120)).toBe(true);
      expect(isValidDuration(480)).toBe(true); // 8 hours
    });

    test('should reject invalid duration values', () => {
      expect(isValidDuration(0)).toBe(false);
      expect(isValidDuration(-30)).toBe(false);
      expect(isValidDuration(1441)).toBe(false); // More than 24 hours
      expect(isValidDuration(5)).toBe(false); // Too short
      expect(isValidDuration('30')).toBe(false); // String
      expect(isValidDuration(null)).toBe(false);
      expect(isValidDuration(undefined)).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    test('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>test')).toBe('alert("xss")test');
      expect(sanitizeInput('<b>Bold text</b>')).toBe('Bold text');
      expect(sanitizeInput('<div>Content</div>')).toBe('Content');
    });

    test('should trim whitespace', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
      expect(sanitizeInput('\n\ttest\t\n')).toBe('test');
    });

    test('should handle special characters', () => {
      expect(sanitizeInput('test&amp;more')).toBe('test&more');
      expect(sanitizeInput('test&lt;script&gt;')).toBe('test<script>');
    });

    test('should handle empty or invalid inputs', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput('   ')).toBe('');
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
    });
  });

  describe('validateBookingTime', () => {
    test('should validate future booking times', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);
      
      expect(validateBookingTime(futureDate)).toBe(true);
    });

    test('should reject past booking times', () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      
      expect(validateBookingTime(pastDate)).toBe(false);
    });

    test('should validate business hours', () => {
      const businessHour = new Date();
      businessHour.setHours(10, 0, 0, 0); // 10 AM
      businessHour.setDate(businessHour.getDate() + 1); // Tomorrow
      
      expect(validateBookingTime(businessHour, true)).toBe(true);
    });

    test('should reject non-business hours when required', () => {
      const earlyHour = new Date();
      earlyHour.setHours(6, 0, 0, 0); // 6 AM
      earlyHour.setDate(earlyHour.getDate() + 1); // Tomorrow
      
      expect(validateBookingTime(earlyHour, true)).toBe(false);
      
      const lateHour = new Date();
      lateHour.setHours(22, 0, 0, 0); // 10 PM
      lateHour.setDate(lateHour.getDate() + 1); // Tomorrow
      
      expect(validateBookingTime(lateHour, true)).toBe(false);
    });

    test('should handle invalid date inputs', () => {
      expect(validateBookingTime(null)).toBe(false);
      expect(validateBookingTime(undefined)).toBe(false);
      expect(validateBookingTime('invalid')).toBe(false);
      expect(validateBookingTime(new Date('invalid'))).toBe(false);
    });
  });
});