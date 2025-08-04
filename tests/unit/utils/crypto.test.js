/**
 * Crypto Utilities Tests
 * Tests for cryptographic utility functions
 */

const crypto = require('crypto');
const {
  generateSecureToken,
  generateBookingConfirmationToken,
  generateUserVerificationToken,
  generatePasswordResetToken,
  validateTokenFormat,
  createTokenExpiration,
  isTokenExpired,
  generateTokenWithExpiration
} = require('../../../src/utils/crypto');

describe('Crypto Utilities', () => {
  describe('generateSecureToken', () => {
    it('should generate token with default length', () => {
      const token = generateSecureToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
    });

    it('should generate token with custom length', () => {
      const token16 = generateSecureToken(16);
      expect(token16.length).toBe(32); // 16 bytes = 32 hex characters

      const token64 = generateSecureToken(64);
      expect(token64.length).toBe(128); // 64 bytes = 128 hex characters
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('should only contain hexadecimal characters', () => {
      const token = generateSecureToken();
      expect(token).toMatch(/^[0-9a-f]+$/i);
    });

    it('should throw error for invalid bytes parameter', () => {
      expect(() => generateSecureToken(0)).toThrow('Bytes must be a positive number');
      expect(() => generateSecureToken(-1)).toThrow('Bytes must be a positive number');
      expect(() => generateSecureToken('32')).toThrow('Bytes must be a positive number');
      expect(() => generateSecureToken(null)).toThrow('Bytes must be a positive number');
    });
  });

  describe('Token Generation Functions', () => {
    it('should generate booking confirmation token', () => {
      const token = generateBookingConfirmationToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64);
      expect(token).toMatch(/^[0-9a-f]+$/i);
    });

    it('should generate user verification token', () => {
      const token = generateUserVerificationToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64);
      expect(token).toMatch(/^[0-9a-f]+$/i);
    });

    it('should generate password reset token', () => {
      const token = generatePasswordResetToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64);
      expect(token).toMatch(/^[0-9a-f]+$/i);
    });

    it('should generate different tokens for each function', () => {
      const booking = generateBookingConfirmationToken();
      const verification = generateUserVerificationToken();
      const reset = generatePasswordResetToken();

      expect(booking).not.toBe(verification);
      expect(booking).not.toBe(reset);
      expect(verification).not.toBe(reset);
    });
  });

  describe('validateTokenFormat', () => {
    it('should validate correct token format', () => {
      const validToken = crypto.randomBytes(32).toString('hex');
      expect(validateTokenFormat(validToken)).toBe(true);
    });

    it('should validate tokens with custom length', () => {
      const token32 = crypto.randomBytes(16).toString('hex'); // 32 chars
      expect(validateTokenFormat(token32, 32)).toBe(true);

      const token128 = crypto.randomBytes(64).toString('hex'); // 128 chars
      expect(validateTokenFormat(token128, 128)).toBe(true);
    });

    it('should reject invalid token formats', () => {
      // Wrong length
      expect(validateTokenFormat('abc123', 64)).toBe(false);
      expect(validateTokenFormat('a'.repeat(63), 64)).toBe(false);
      expect(validateTokenFormat('a'.repeat(65), 64)).toBe(false);

      // Non-hex characters
      expect(validateTokenFormat('g'.repeat(64))).toBe(false);
      expect(validateTokenFormat('xyz'.repeat(21) + 'g')).toBe(false);
      expect(validateTokenFormat('!@#$%^&*'.repeat(8))).toBe(false);

      // Invalid types
      expect(validateTokenFormat(null)).toBe(false);
      expect(validateTokenFormat(undefined)).toBe(false);
      expect(validateTokenFormat(123)).toBe(false);
      expect(validateTokenFormat({})).toBe(false);
    });

    it('should be case insensitive for hex validation', () => {
      const lowerToken = 'abcdef0123456789'.repeat(4);
      const upperToken = 'ABCDEF0123456789'.repeat(4);
      const mixedToken = 'AbCdEf0123456789'.repeat(4);

      expect(validateTokenFormat(lowerToken)).toBe(true);
      expect(validateTokenFormat(upperToken)).toBe(true);
      expect(validateTokenFormat(mixedToken)).toBe(true);
    });
  });

  describe('createTokenExpiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should create expiration with default 30 minutes', () => {
      const expiration = createTokenExpiration();
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.toISOString()).toBe('2024-01-01T12:30:00.000Z');
    });

    it('should create expiration with custom minutes', () => {
      const exp15 = createTokenExpiration(15);
      expect(exp15.toISOString()).toBe('2024-01-01T12:15:00.000Z');

      const exp60 = createTokenExpiration(60);
      expect(exp60.toISOString()).toBe('2024-01-01T13:00:00.000Z');

      const exp1440 = createTokenExpiration(1440); // 24 hours
      expect(exp1440.toISOString()).toBe('2024-01-02T12:00:00.000Z');
    });

    it('should throw error for invalid minutes', () => {
      expect(() => createTokenExpiration(0)).toThrow('Minutes must be a positive number');
      expect(() => createTokenExpiration(-30)).toThrow('Minutes must be a positive number');
      expect(() => createTokenExpiration('30')).toThrow('Minutes must be a positive number');
      expect(() => createTokenExpiration(null)).toThrow('Minutes must be a positive number');
    });
  });

  describe('isTokenExpired', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should correctly identify expired tokens', () => {
      const pastDate = new Date('2024-01-01T11:00:00Z');
      expect(isTokenExpired(pastDate)).toBe(true);

      const pastDateString = '2024-01-01T11:30:00Z';
      expect(isTokenExpired(pastDateString)).toBe(true);
    });

    it('should correctly identify non-expired tokens', () => {
      const futureDate = new Date('2024-01-01T13:00:00Z');
      expect(isTokenExpired(futureDate)).toBe(false);

      const futureDateString = '2024-01-01T12:30:00Z';
      expect(isTokenExpired(futureDateString)).toBe(false);
    });

    it('should handle edge case of current time', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      expect(isTokenExpired(now)).toBe(false); // Not expired at exact time
    });

    it('should throw error for invalid dates', () => {
      expect(() => isTokenExpired('invalid date')).toThrow('Invalid expiration date');
      expect(() => isTokenExpired(null)).toThrow('Invalid expiration date');
      expect(() => isTokenExpired(undefined)).toThrow('Invalid expiration date');
      expect(() => isTokenExpired(123)).toThrow('Invalid expiration date');
    });
  });

  describe('generateTokenWithExpiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should generate token with default expiration', () => {
      const result = generateTokenWithExpiration();
      
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
      expect(result.token).toMatch(/^[0-9a-f]{64}$/i);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.toISOString()).toBe('2024-01-01T12:30:00.000Z');
    });

    it('should generate token with custom parameters', () => {
      const result = generateTokenWithExpiration(16, 60);
      
      expect(result.token).toMatch(/^[0-9a-f]{32}$/i); // 16 bytes = 32 hex
      expect(result.expiresAt.toISOString()).toBe('2024-01-01T13:00:00.000Z');
    });

    it('should generate unique tokens on each call', () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(generateTokenWithExpiration());
      }

      const tokens = results.map(r => r.token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(10);
    });

    it('should handle errors from invalid parameters', () => {
      expect(() => generateTokenWithExpiration(0)).toThrow('Bytes must be a positive number');
      expect(() => generateTokenWithExpiration(32, 0)).toThrow('Minutes must be a positive number');
    });
  });

  describe('Cryptographic Security', () => {
    it('should use crypto.randomBytes for token generation', () => {
      // Spy on crypto.randomBytes
      const spy = jest.spyOn(crypto, 'randomBytes');
      
      generateSecureToken(32);
      expect(spy).toHaveBeenCalledWith(32);
      
      spy.mockRestore();
    });

    it('should have sufficient entropy in generated tokens', () => {
      // Generate multiple tokens and check for patterns
      const tokens = [];
      for (let i = 0; i < 1000; i++) {
        tokens.push(generateSecureToken(8)); // Smaller tokens for testing
      }

      // Check that all tokens are unique (high entropy)
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(1000);

      // Check character distribution (roughly uniform for hex)
      const charCounts = {};
      const allChars = tokens.join('');
      for (const char of allChars) {
        charCounts[char] = (charCounts[char] || 0) + 1;
      }

      // Each hex character should appear roughly equally
      const counts = Object.values(charCounts);
      const avg = counts.reduce((a, b) => a + b) / counts.length;
      const variance = counts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / counts.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be relatively small compared to average
      expect(stdDev / avg).toBeLessThan(0.1);
    });
  });
});