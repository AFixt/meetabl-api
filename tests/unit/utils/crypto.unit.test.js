/**
 * Unit tests for crypto utilities
 * 
 * Tests secure token generation and validation functions
 * 
 * @author meetabl Team
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

describe('Crypto Utils', () => {
  describe('generateSecureToken', () => {
    test('should generate a token with default 32 bytes (64 hex characters)', () => {
      const token = generateSecureToken();
      
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
      expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
    });

    test('should generate tokens with custom byte length', () => {
      const token16 = generateSecureToken(16);
      const token8 = generateSecureToken(8);
      
      expect(token16.length).toBe(32); // 16 bytes = 32 hex characters
      expect(token8.length).toBe(16);  // 8 bytes = 16 hex characters
    });

    test('should generate unique tokens on each call', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });

    test('should throw error for invalid byte count', () => {
      expect(() => generateSecureToken(0)).toThrow('Bytes must be a positive number');
      expect(() => generateSecureToken(-1)).toThrow('Bytes must be a positive number');
      expect(() => generateSecureToken('invalid')).toThrow('Bytes must be a positive number');
    });
  });

  describe('generateBookingConfirmationToken', () => {
    test('should generate a 64-character hex token', () => {
      const token = generateBookingConfirmationToken();
      
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64);
      expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
    });

    test('should generate unique tokens', () => {
      const token1 = generateBookingConfirmationToken();
      const token2 = generateBookingConfirmationToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateUserVerificationToken', () => {
    test('should generate a 64-character hex token', () => {
      const token = generateUserVerificationToken();
      
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64);
      expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
    });

    test('should generate unique tokens', () => {
      const token1 = generateUserVerificationToken();
      const token2 = generateUserVerificationToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generatePasswordResetToken', () => {
    test('should generate a 64-character hex token', () => {
      const token = generatePasswordResetToken();
      
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64);
      expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
    });

    test('should generate unique tokens', () => {
      const token1 = generatePasswordResetToken();
      const token2 = generatePasswordResetToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateTokenFormat', () => {
    test('should validate correct token format', () => {
      const validToken = 'a1b2c3d4e5f67890abcdef1234567890a1b2c3d4e5f67890abcdef1234567890';
      
      expect(validateTokenFormat(validToken)).toBe(true);
    });

    test('should validate tokens with custom length', () => {
      const shortToken = 'a1b2c3d4e5f67890';
      
      expect(validateTokenFormat(shortToken, 16)).toBe(true);
      expect(validateTokenFormat(shortToken, 64)).toBe(false);
    });

    test('should reject invalid token formats', () => {
      expect(validateTokenFormat('')).toBe(false);
      expect(validateTokenFormat('invalid-token')).toBe(false); // Contains dash
      expect(validateTokenFormat('zzzzzz')).toBe(false); // Invalid hex character
      expect(validateTokenFormat('a1b2c3')).toBe(false); // Wrong length
      expect(validateTokenFormat(123)).toBe(false); // Not a string
      expect(validateTokenFormat(null)).toBe(false);
      expect(validateTokenFormat(undefined)).toBe(false);
    });

    test('should handle case insensitive hex validation', () => {
      const upperToken = 'A1B2C3D4E5F67890ABCDEF1234567890A1B2C3D4E5F67890ABCDEF1234567890';
      const lowerToken = 'a1b2c3d4e5f67890abcdef1234567890a1b2c3d4e5f67890abcdef1234567890';
      const mixedToken = 'A1b2C3d4E5f67890ABcdef1234567890a1B2c3D4e5F67890ABcdef1234567890';
      
      expect(validateTokenFormat(upperToken)).toBe(true);
      expect(validateTokenFormat(lowerToken)).toBe(true);
      expect(validateTokenFormat(mixedToken)).toBe(true);
    });
  });

  describe('createTokenExpiration', () => {
    test('should create expiration date 30 minutes from now by default', () => {
      const now = new Date();
      const expiration = createTokenExpiration();
      const expectedTime = new Date(now.getTime() + (30 * 60 * 1000));
      
      // Allow for small timing differences
      expect(Math.abs(expiration.getTime() - expectedTime.getTime())).toBeLessThan(1000);
    });

    test('should create expiration date with custom minutes', () => {
      const now = new Date();
      const expiration = createTokenExpiration(60); // 1 hour
      const expectedTime = new Date(now.getTime() + (60 * 60 * 1000));
      
      expect(Math.abs(expiration.getTime() - expectedTime.getTime())).toBeLessThan(1000);
    });

    test('should throw error for invalid minutes', () => {
      expect(() => createTokenExpiration(0)).toThrow('Minutes must be a positive number');
      expect(() => createTokenExpiration(-5)).toThrow('Minutes must be a positive number');
      expect(() => createTokenExpiration('invalid')).toThrow('Minutes must be a positive number');
    });
  });

  describe('isTokenExpired', () => {
    test('should return false for future date', () => {
      const futureDate = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutes from now
      
      expect(isTokenExpired(futureDate)).toBe(false);
    });

    test('should return true for past date', () => {
      const pastDate = new Date(Date.now() - (30 * 60 * 1000)); // 30 minutes ago
      
      expect(isTokenExpired(pastDate)).toBe(true);
    });

    test('should handle string dates', () => {
      const futureDateString = new Date(Date.now() + (30 * 60 * 1000)).toISOString();
      const pastDateString = new Date(Date.now() - (30 * 60 * 1000)).toISOString();
      
      expect(isTokenExpired(futureDateString)).toBe(false);
      expect(isTokenExpired(pastDateString)).toBe(true);
    });

    test('should throw error for invalid date', () => {
      expect(() => isTokenExpired('invalid-date')).toThrow('Invalid expiration date');
      expect(() => isTokenExpired(null)).toThrow('Invalid expiration date');
      expect(() => isTokenExpired(123)).toThrow('Invalid expiration date');
    });
  });

  describe('generateTokenWithExpiration', () => {
    test('should generate token with expiration using defaults', () => {
      const result = generateTokenWithExpiration();
      
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBe(64);
      expect(result.expiresAt instanceof Date).toBe(true);
      
      // Should expire in about 30 minutes
      const expectedTime = new Date(Date.now() + (30 * 60 * 1000));
      expect(Math.abs(result.expiresAt.getTime() - expectedTime.getTime())).toBeLessThan(1000);
    });

    test('should generate token with custom parameters', () => {
      const result = generateTokenWithExpiration(16, 60); // 16 bytes, 60 minutes
      
      expect(result.token.length).toBe(32); // 16 bytes = 32 hex characters
      
      const expectedTime = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour
      expect(Math.abs(result.expiresAt.getTime() - expectedTime.getTime())).toBeLessThan(1000);
    });

    test('should generate unique tokens with each call', () => {
      const result1 = generateTokenWithExpiration();
      const result2 = generateTokenWithExpiration();
      
      expect(result1.token).not.toBe(result2.token);
    });
  });

  describe('Security Properties', () => {
    test('should generate cryptographically secure tokens', () => {
      // Generate multiple tokens and check for patterns
      const tokens = [];
      for (let i = 0; i < 100; i++) {
        tokens.push(generateSecureToken());
      }
      
      // Check uniqueness
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(100);
      
      // Check that tokens don't have obvious patterns
      const firstChars = tokens.map(token => token.charAt(0));
      const uniqueFirstChars = new Set(firstChars);
      expect(uniqueFirstChars.size).toBeGreaterThan(5); // Should have variety
    });

    test('should generate tokens with high entropy', () => {
      const token = generateSecureToken();
      
      // Count character frequency
      const charCounts = {};
      for (const char of token) {
        charCounts[char] = (charCounts[char] || 0) + 1;
      }
      
      // No character should appear excessively
      const maxCount = Math.max(...Object.values(charCounts));
      expect(maxCount).toBeLessThan(token.length / 4); // No char more than 25% of token
    });
  });

  describe('Integration with crypto module', () => {
    test('should use Node.js crypto.randomBytes', () => {
      // Spy on crypto.randomBytes to ensure it's being called
      const spy = jest.spyOn(crypto, 'randomBytes');
      
      generateSecureToken(16);
      
      expect(spy).toHaveBeenCalledWith(16);
      
      spy.mockRestore();
    });
  });
});