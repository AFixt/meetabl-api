/**
 * Two-Factor Authentication Service
 * 
 * Handles TOTP (Time-based One-Time Password) generation and verification
 * using Google Authenticator compatible tokens
 * 
 * @author meetabl Team
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const logger = require('../config/logger');
const { User, AuditLog } = require('../models');
const { v4: uuidv4 } = require('uuid');

class TwoFactorAuthService {
  /**
   * Generate a new secret for 2FA setup
   * @param {Object} user - User object
   * @returns {Promise<Object>} Secret and QR code data
   */
  async generateSecret(user) {
    try {
      const secret = speakeasy.generateSecret({
        name: `meetabl (${user.email})`,
        issuer: 'meetabl',
        length: 32
      });

      // Generate QR code for easy setup
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      logger.info(`2FA secret generated for user ${user.id}`);

      return {
        secret: secret.base32,
        qr_code: qrCodeUrl,
        backup_codes: await this.generateBackupCodes(),
        manual_entry_key: secret.base32
      };
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      throw new Error('Failed to generate 2FA secret');
    }
  }

  /**
   * Verify TOTP token
   * @param {string} token - 6-digit TOTP token
   * @param {string} secret - User's 2FA secret
   * @param {number} window - Time window for token validation (default: 2)
   * @returns {boolean} Whether token is valid
   */
  verifyToken(token, secret, window = 2) {
    try {
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window
      });

      return verified;
    } catch (error) {
      logger.error('Error verifying 2FA token:', error);
      return false;
    }
  }

  /**
   * Enable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} token - Verification token
   * @param {string} secret - 2FA secret
   * @returns {Promise<Object>} Result with backup codes
   */
  async enable2FA(userId, token, secret) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify the token before enabling
      if (!this.verifyToken(token, secret)) {
        throw new Error('Invalid verification token');
      }

      // Generate backup codes
      const backupCodes = await this.generateBackupCodes();
      const hashedBackupCodes = await this.hashBackupCodes(backupCodes);

      // Enable 2FA for the user
      await user.update({
        two_factor_enabled: true,
        two_factor_secret: secret,
        two_factor_backup_codes: JSON.stringify(hashedBackupCodes),
        two_factor_enabled_at: new Date()
      });

      // Create audit log
      await AuditLog.create({
        id: uuidv4(),
        user_id: userId,
        action: 'user.2fa_enabled',
        metadata: {
          enabled_at: new Date(),
          backup_codes_generated: backupCodes.length
        }
      });

      logger.info(`2FA enabled for user ${userId}`);

      return {
        enabled: true,
        backup_codes: backupCodes,
        message: '2FA has been enabled successfully. Save these backup codes in a secure location.'
      };
    } catch (error) {
      logger.error(`Error enabling 2FA for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Disable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} token - Current 2FA token or backup code
   * @returns {Promise<Object>} Result
   */
  async disable2FA(userId, token) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.two_factor_enabled) {
        throw new Error('2FA is not enabled');
      }

      // Verify token or backup code
      const isValidToken = this.verifyToken(token, user.two_factor_secret);
      const isValidBackupCode = await this.verifyBackupCode(token, user.two_factor_backup_codes);

      if (!isValidToken && !isValidBackupCode) {
        throw new Error('Invalid token or backup code');
      }

      // Disable 2FA
      await user.update({
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: null,
        two_factor_enabled_at: null
      });

      // Create audit log
      await AuditLog.create({
        id: uuidv4(),
        user_id: userId,
        action: 'user.2fa_disabled',
        metadata: {
          disabled_at: new Date(),
          disabled_method: isValidToken ? 'totp_token' : 'backup_code'
        }
      });

      logger.info(`2FA disabled for user ${userId}`);

      return {
        disabled: true,
        message: '2FA has been disabled successfully'
      };
    } catch (error) {
      logger.error(`Error disabling 2FA for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Verify 2FA during login
   * @param {Object} user - User object
   * @param {string} token - 2FA token or backup code
   * @returns {Promise<Object>} Verification result
   */
  async verifyLogin2FA(user, token) {
    try {
      if (!user.two_factor_enabled) {
        return { verified: true, method: 'disabled' };
      }

      // Try TOTP token first
      const isValidToken = this.verifyToken(token, user.two_factor_secret);
      if (isValidToken) {
        // Log successful 2FA verification
        await AuditLog.create({
          id: uuidv4(),
          user_id: user.id,
          action: 'user.2fa_verified',
          metadata: {
            method: 'totp_token',
            verified_at: new Date()
          }
        });

        return { verified: true, method: 'totp' };
      }

      // Try backup code
      const backupCodeResult = await this.verifyAndConsumeBackupCode(token, user);
      if (backupCodeResult.verified) {
        // Log backup code usage
        await AuditLog.create({
          id: uuidv4(),
          user_id: user.id,
          action: 'user.2fa_backup_code_used',
          metadata: {
            used_at: new Date(),
            remaining_codes: backupCodeResult.remaining_codes
          }
        });

        return { verified: true, method: 'backup_code', remaining_codes: backupCodeResult.remaining_codes };
      }

      // Log failed 2FA attempt
      await AuditLog.create({
        id: uuidv4(),
        user_id: user.id,
        action: 'user.2fa_failed',
        metadata: {
          failed_at: new Date(),
          ip_address: null // Would be passed from request
        }
      });

      return { verified: false, method: 'invalid' };
    } catch (error) {
      logger.error(`Error verifying 2FA for user ${user.id}:`, error);
      return { verified: false, method: 'error' };
    }
  }

  /**
   * Generate backup codes
   * @returns {Promise<Array>} Array of backup codes
   */
  async generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      // Generate 8-character backup codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash backup codes for storage
   * @param {Array} codes - Array of backup codes
   * @returns {Promise<Array>} Array of hashed codes
   */
  async hashBackupCodes(codes) {
    const bcrypt = require('bcrypt');
    const hashedCodes = [];
    
    for (const code of codes) {
      const hash = await bcrypt.hash(code, 10);
      hashedCodes.push({ code: hash, used: false });
    }
    
    return hashedCodes;
  }

  /**
   * Verify backup code
   * @param {string} code - Backup code to verify
   * @param {string} storedCodes - JSON string of stored backup codes
   * @returns {Promise<boolean>} Whether code is valid
   */
  async verifyBackupCode(code, storedCodes) {
    try {
      if (!storedCodes) return false;

      const bcrypt = require('bcrypt');
      const codes = JSON.parse(storedCodes);
      
      for (const storedCode of codes) {
        if (!storedCode.used && await bcrypt.compare(code, storedCode.code)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Error verifying backup code:', error);
      return false;
    }
  }

  /**
   * Verify and consume backup code
   * @param {string} code - Backup code to verify
   * @param {Object} user - User object
   * @returns {Promise<Object>} Verification result with remaining codes
   */
  async verifyAndConsumeBackupCode(code, user) {
    try {
      if (!user.two_factor_backup_codes) {
        return { verified: false, remaining_codes: 0 };
      }

      const bcrypt = require('bcrypt');
      const codes = JSON.parse(user.two_factor_backup_codes);
      let codeUsed = false;
      
      for (const storedCode of codes) {
        if (!storedCode.used && await bcrypt.compare(code, storedCode.code)) {
          storedCode.used = true;
          codeUsed = true;
          break;
        }
      }
      
      if (!codeUsed) {
        return { verified: false, remaining_codes: codes.filter(c => !c.used).length };
      }

      // Update user with consumed backup code
      await user.update({
        two_factor_backup_codes: JSON.stringify(codes)
      });

      const remainingCodes = codes.filter(c => !c.used).length;
      
      return { verified: true, remaining_codes: remainingCodes };
    } catch (error) {
      logger.error('Error verifying and consuming backup code:', error);
      return { verified: false, remaining_codes: 0 };
    }
  }

  /**
   * Regenerate backup codes
   * @param {string} userId - User ID
   * @param {string} token - Current 2FA token
   * @returns {Promise<Object>} New backup codes
   */
  async regenerateBackupCodes(userId, token) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.two_factor_enabled) {
        throw new Error('2FA is not enabled');
      }

      // Verify current token
      if (!this.verifyToken(token, user.two_factor_secret)) {
        throw new Error('Invalid 2FA token');
      }

      // Generate new backup codes
      const newBackupCodes = await this.generateBackupCodes();
      const hashedBackupCodes = await this.hashBackupCodes(newBackupCodes);

      // Update user
      await user.update({
        two_factor_backup_codes: JSON.stringify(hashedBackupCodes)
      });

      // Create audit log
      await AuditLog.create({
        id: uuidv4(),
        user_id: userId,
        action: 'user.2fa_backup_codes_regenerated',
        metadata: {
          regenerated_at: new Date(),
          new_codes_count: newBackupCodes.length
        }
      });

      logger.info(`Backup codes regenerated for user ${userId}`);

      return {
        backup_codes: newBackupCodes,
        message: 'New backup codes generated. Save these in a secure location.'
      };
    } catch (error) {
      logger.error(`Error regenerating backup codes for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get 2FA status for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} 2FA status
   */
  async get2FAStatus(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['two_factor_enabled', 'two_factor_enabled_at', 'two_factor_backup_codes']
      });

      if (!user) {
        throw new Error('User not found');
      }

      let remainingBackupCodes = 0;
      if (user.two_factor_backup_codes) {
        const codes = JSON.parse(user.two_factor_backup_codes);
        remainingBackupCodes = codes.filter(c => !c.used).length;
      }

      return {
        enabled: user.two_factor_enabled || false,
        enabled_at: user.two_factor_enabled_at,
        backup_codes_remaining: remainingBackupCodes
      };
    } catch (error) {
      logger.error(`Error getting 2FA status for user ${userId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new TwoFactorAuthService();