/**
 * Sanitize Utility Tests
 * 
 * Tests for data sanitization utility functions
 * 
 * @author meetabl Team
 */

const { sanitizeLogData, sanitizeEmail, sanitizePhone } = require('../../../src/utils/sanitize');

describe('Sanitize Utilities', () => {
  describe('sanitizeLogData', () => {
    test('should redact password fields', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.username).toBe('testuser');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.email).toBe('test@example.com');
    });

    test('should redact token fields', () => {
      const data = {
        accessToken: 'jwt-token',
        refreshToken: 'refresh-jwt',
        apiKey: 'api-key-value',
        user: 'testuser'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.user).toBe('testuser');
    });

    test('should redact secret fields', () => {
      const data = {
        clientSecret: 'oauth-secret',
        jwtSecret: 'jwt-secret',
        secret: 'general-secret',
        normalField: 'normal-value'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.clientSecret).toBe('[REDACTED]');
      expect(sanitized.jwtSecret).toBe('[REDACTED]');
      expect(sanitized.secret).toBe('[REDACTED]');
      expect(sanitized.normalField).toBe('normal-value');
    });

    test('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John Doe',
          password: 'secret123',
          settings: {
            theme: 'dark',
            apiKey: 'nested-api-key'
          }
        },
        metadata: {
          token: 'bearer-token'
        }
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.user.name).toBe('John Doe');
      expect(sanitized.user.password).toBe('[REDACTED]');
      expect(sanitized.user.settings.theme).toBe('dark');
      expect(sanitized.user.settings.apiKey).toBe('[REDACTED]');
      expect(sanitized.metadata.token).toBe('[REDACTED]');
    });

    test('should handle arrays', () => {
      const data = {
        users: [
          { name: 'John', password: 'secret1' },
          { name: 'Jane', password: 'secret2' }
        ],
        tokens: ['token1', 'token2']
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.users[0].name).toBe('John');
      expect(sanitized.users[0].password).toBe('[REDACTED]');
      expect(sanitized.users[1].name).toBe('Jane');
      expect(sanitized.users[1].password).toBe('[REDACTED]');
      expect(sanitized.tokens).toEqual(['token1', 'token2']);
    });

    test('should handle null and undefined values', () => {
      const data = {
        name: 'Test',
        password: null,
        token: undefined,
        secret: '',
        apiKey: 0
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.name).toBe('Test');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.secret).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });

    test('should handle non-object inputs', () => {
      expect(sanitizeLogData('string')).toBe('string');
      expect(sanitizeLogData(123)).toBe(123);
      expect(sanitizeLogData(null)).toBe(null);
      expect(sanitizeLogData(undefined)).toBe(undefined);
      expect(sanitizeLogData([])).toEqual([]);
    });

    test('should handle circular references', () => {
      const data = { name: 'Test' };
      data.self = data; // Create circular reference

      const sanitized = sanitizeLogData(data);

      expect(sanitized.name).toBe('Test');
      expect(sanitized.self).toBe('[Circular Reference]');
    });
  });

  describe('sanitizeEmail', () => {
    test('should partially mask email addresses', () => {
      expect(sanitizeEmail('john.doe@example.com')).toBe('jo***@example.com');
      expect(sanitizeEmail('a@example.com')).toBe('a***@example.com');
      expect(sanitizeEmail('test@test.co')).toBe('te***@test.co');
    });

    test('should handle short emails', () => {
      expect(sanitizeEmail('a@b.c')).toBe('a***@b.c');
    });

    test('should handle invalid emails', () => {
      expect(sanitizeEmail('invalid-email')).toBe('invalid-email');
      expect(sanitizeEmail('')).toBe('');
      expect(sanitizeEmail(null)).toBe(null);
      expect(sanitizeEmail(undefined)).toBe(undefined);
    });

    test('should preserve domain', () => {
      const result = sanitizeEmail('user@subdomain.example.com');
      expect(result).toMatch(/@subdomain\.example\.com$/);
    });
  });

  describe('sanitizePhone', () => {
    test('should mask middle digits of phone numbers', () => {
      expect(sanitizePhone('+1234567890')).toBe('+12****7890');
      expect(sanitizePhone('1234567890')).toBe('12****7890');
      expect(sanitizePhone('+44 20 7123 4567')).toBe('+44 20 ****4567');
    });

    test('should handle short phone numbers', () => {
      expect(sanitizePhone('12345')).toBe('12***45');
      expect(sanitizePhone('123')).toBe('1*3');
    });

    test('should handle invalid phone numbers', () => {
      expect(sanitizePhone('')).toBe('');
      expect(sanitizePhone(null)).toBe(null);
      expect(sanitizePhone(undefined)).toBe(undefined);
      expect(sanitizePhone('abc')).toBe('a*c');
    });

    test('should preserve formatting characters', () => {
      expect(sanitizePhone('+1 (234) 567-8900')).toBe('+1 (234) ****8900');
      expect(sanitizePhone('234.567.8900')).toBe('234.567.***0');
    });
  });
});