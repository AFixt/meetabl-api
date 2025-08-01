/**
 * Validation Utilities Tests
 * Tests for data validation utility functions
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
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.com',
        'user+tag@example.co.uk',
        'user_123@test-domain.com',
        'firstName.lastName@company.io'
      ];

      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'user@',
        '@example.com',
        'user@example',
        'user example@test.com',
        'user@.com',
        'user..test@example.com',
        '',
        null,
        undefined,
        123,
        {},
        []
      ];

      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('isValidPhone', () => {
    it('should validate correct phone formats', () => {
      const validPhones = [
        '1234567890',
        '+1 (234) 567-8900',
        '234.567.8900',
        '234-567-8900',
        '+44 20 7946 0958',
        '(555) 123-4567'
      ];

      validPhones.forEach(phone => {
        expect(isValidPhone(phone)).toBe(true);
      });
    });

    it('should reject invalid phone formats', () => {
      const invalidPhones = [
        '123456789', // Too few digits
        '123',
        'abcdefghij',
        '',
        null,
        undefined,
        123,
        {},
        []
      ];

      invalidPhones.forEach(phone => {
        expect(isValidPhone(phone)).toBe(false);
      });
    });
  });

  describe('isValidPassword', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'StrongPass123',
        'MyP@ssw0rd!',
        'TestUser123',
        'Complex1Password',
        'UPPER1lower'
      ];

      validPasswords.forEach(password => {
        expect(isValidPassword(password)).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const invalidPasswords = [
        'short1A', // Too short
        'alllowercase123',
        'ALLUPPERCASE123',
        'NoNumbers!',
        'nouppercasehere1',
        '12345678',
        '',
        null,
        undefined,
        123
      ];

      invalidPasswords.forEach(password => {
        expect(isValidPassword(password)).toBe(false);
      });
    });
  });

  describe('isValidTimezone', () => {
    it('should validate correct timezones', () => {
      const validTimezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'UTC',
        'America/Los_Angeles',
        'Australia/Sydney'
      ];

      validTimezones.forEach(timezone => {
        expect(isValidTimezone(timezone)).toBe(true);
      });
    });

    it('should reject invalid timezones', () => {
      const invalidTimezones = [
        'Invalid/Timezone',
        'America/InvalidCity',
        'NotATimezone',
        '',
        null,
        undefined,
        123,
        {},
        []
      ];

      invalidTimezones.forEach(timezone => {
        expect(isValidTimezone(timezone)).toBe(false);
      });
    });
  });

  describe('isValidDate', () => {
    it('should validate correct date formats', () => {
      const validDates = [
        new Date(),
        '2024-01-01',
        '2024-01-01T10:00:00Z',
        'January 1, 2024',
        new Date('2024-12-31'),
        1704067200000 // Timestamp
      ];

      validDates.forEach(date => {
        expect(isValidDate(date)).toBe(true);
      });
    });

    it('should reject invalid dates', () => {
      const invalidDates = [
        'Invalid Date',
        '2024-13-01', // Invalid month
        '2024-01-32', // Invalid day
        '',
        null,
        undefined,
        {},
        [],
        NaN
      ];

      invalidDates.forEach(date => {
        expect(isValidDate(date)).toBe(false);
      });
    });
  });

  describe('isValidDuration', () => {
    it('should validate correct durations', () => {
      const validDurations = [
        15,
        30,
        45,
        60,
        90,
        120,
        240,
        480,
        1440 // 24 hours
      ];

      validDurations.forEach(duration => {
        expect(isValidDuration(duration)).toBe(true);
      });
    });

    it('should reject invalid durations', () => {
      const invalidDurations = [
        14, // Too short
        1441, // Too long
        0,
        -30,
        NaN,
        Infinity,
        '30',
        null,
        undefined
      ];

      invalidDurations.forEach(duration => {
        expect(isValidDuration(duration)).toBe(false);
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      const inputs = [
        { input: '<script>alert("xss")</script>', expected: 'alert("xss")' },
        { input: '<p>Hello <b>World</b></p>', expected: 'Hello World' },
        { input: '<img src="x" onerror="alert(1)">', expected: '' },
        { input: '<a href="#">Link</a>', expected: 'Link' }
      ];

      inputs.forEach(({ input, expected }) => {
        expect(sanitizeInput(input)).toBe(expected);
      });
    });

    it('should decode HTML entities', () => {
      const inputs = [
        { input: '&lt;script&gt;', expected: '<script>' },
        { input: '&amp; &lt; &gt; &quot;', expected: '& < > "' },
        { input: '&#x27;Hello&#x27;', expected: "'Hello'" }
      ];

      inputs.forEach(({ input, expected }) => {
        expect(sanitizeInput(input)).toBe(expected);
      });
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  Hello World  ')).toBe('Hello World');
      expect(sanitizeInput('\n\tTest\n\t')).toBe('Test');
    });

    it('should handle invalid inputs', () => {
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
      expect(sanitizeInput(123)).toBe('');
      expect(sanitizeInput({})).toBe('');
    });
  });

  describe('validateBookingTime', () => {
    beforeEach(() => {
      // Mock current time for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should accept future dates', () => {
      const futureDate = new Date('2024-01-02T14:00:00Z');
      expect(validateBookingTime(futureDate)).toBe(true);
    });

    it('should reject past dates', () => {
      const pastDate = new Date('2023-12-31T14:00:00Z');
      expect(validateBookingTime(pastDate)).toBe(false);
    });

    it('should reject current time', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      expect(validateBookingTime(now)).toBe(false);
    });

    it('should validate business hours when required', () => {
      // Within business hours (9 AM - 6 PM)
      const validTime = new Date('2024-01-02T14:00:00Z'); // 2 PM
      expect(validateBookingTime(validTime, true)).toBe(true);

      // Outside business hours
      const earlyTime = new Date('2024-01-02T08:00:00Z'); // 8 AM
      expect(validateBookingTime(earlyTime, true)).toBe(false);

      const lateTime = new Date('2024-01-02T19:00:00Z'); // 7 PM
      expect(validateBookingTime(lateTime, true)).toBe(false);
    });

    it('should handle invalid dates', () => {
      expect(validateBookingTime('invalid date')).toBe(false);
      expect(validateBookingTime(null)).toBe(false);
      expect(validateBookingTime(undefined)).toBe(false);
    });
  });
});