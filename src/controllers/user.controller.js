/**
 * User controller
 *
 * Handles user profile management
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');
const { User, UserSettings, AuditLog } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user with settings
    const user = await User.findOne({
      where: { id: userId },
      include: [{ model: UserSettings }],
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'User not found'
        }
      });
    }

    // Return user data
    return res.status(200).json(user);
  } catch (error) {
    logger.error('Error getting user profile:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get user profile'
      }
    });
  }
};

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, timezone } = req.body;

    // Find user
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'User not found'
        }
      });
    }

    // Update user fields
    if (name) user.name = name;
    if (timezone) user.timezone = timezone;

    await user.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'user.update',
      metadata: {
        updated: { name, timezone }
      }
    });

    // Log update
    logger.info(`User profile updated: ${userId}`);

    // Return updated user
    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      calendar_provider: user.calendar_provider,
      created: user.created,
      updated: user.updated
    });
  } catch (error) {
    logger.error('Error updating user profile:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to update user profile'
      }
    });
  }
};

/**
 * Get user settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find settings
    let settings = await UserSettings.findOne({ where: { user_id: userId } });

    // Create settings if not found
    if (!settings) {
      settings = await UserSettings.create({
        id: uuidv4(),
        user_id: userId
      });
    }

    // Return settings
    return res.status(200).json(settings);
  } catch (error) {
    logger.error('Error getting user settings:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get user settings'
      }
    });
  }
};

/**
 * Update user settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUserSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      branding_color, confirmation_email_copy, accessibility_mode, alt_text_enabled
    } = req.body;

    // Find settings
    let settings = await UserSettings.findOne({ where: { user_id: userId } });

    // Create settings if not found
    if (!settings) {
      settings = await UserSettings.create({
        id: uuidv4(),
        user_id: userId
      });
    }

    // Update settings fields
    if (branding_color !== undefined) settings.branding_color = branding_color;
    if (confirmation_email_copy !== undefined) settings.confirmation_email_copy = confirmation_email_copy;
    if (accessibility_mode !== undefined) settings.accessibility_mode = accessibility_mode;
    if (alt_text_enabled !== undefined) settings.alt_text_enabled = alt_text_enabled;

    await settings.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'user.settings.update',
      metadata: {
        updated: {
          branding_color, confirmation_email_copy, accessibility_mode, alt_text_enabled
        }
      }
    });

    // Log update
    logger.info(`User settings updated: ${userId}`);

    // Return updated settings
    return res.status(200).json(settings);
  } catch (error) {
    logger.error('Error updating user settings:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to update user settings'
      }
    });
  }
};

/**
 * Change user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Current password and new password are required',
          params: []
        }
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'New password must be at least 6 characters long',
          params: [
            {
              param: 'newPassword',
              message: 'Password too short'
            }
          ]
        }
      });
    }

    // Find user
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'User not found'
        }
      });
    }

    // Validate current password
    const isValidPassword = await user.validatePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Current password is incorrect'
        }
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'user.password.change',
      metadata: {
        changed_at: new Date()
      }
    });

    logger.info(`Password changed for user: ${userId}`);

    return res.status(200).json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Error changing password:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to change password'
      }
    });
  }
};

/**
 * Delete user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAccount = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { password } = req.body;

    // Validate password is provided
    if (!password) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Password is required to delete account',
          params: [
            {
              param: 'password',
              message: 'Password is required'
            }
          ]
        }
      });
    }

    // Find user
    const user = await User.findOne({ 
      where: { id: userId },
      transaction 
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'User not found'
        }
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      await transaction.rollback();
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid password'
        }
      });
    }

    // Create final audit log entry
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'user.account.deleted',
      metadata: {
        email: user.email,
        deleted_at: new Date()
      }
    }, { transaction });

    // Delete user (cascades to related records due to foreign key constraints)
    await user.destroy({ transaction });

    // Commit transaction
    await transaction.commit();

    logger.info(`Account deleted for user: ${userId}`);

    return res.status(200).json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    // Rollback transaction
    await transaction.rollback();

    logger.error('Error deleting account:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to delete account'
      }
    });
  }
};

/**
 * Get public profile by username
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username (using email as username for now)
    const user = await User.findOne({
      where: { email: username },
      include: [{ model: UserSettings }],
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'User profile not found'
        }
      });
    }

    // Return public profile data
    const publicProfile = {
      name: user.name,
      timezone: user.timezone,
      branding_color: user.UserSetting?.branding_color || '#007bff',
      accessibility_mode: user.UserSetting?.accessibility_mode || false,
      alt_text_enabled: user.UserSetting?.alt_text_enabled || false
    };

    return res.status(200).json(publicProfile);
  } catch (error) {
    logger.error('Error getting public profile:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to get public profile'
      }
    });
  }
};

/**
 * Update public profile settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updatePublicProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      public_name, public_bio, public_avatar_url, branding_color, 
      booking_page_title, booking_page_description
    } = req.body;

    // Find or create user settings
    let settings = await UserSettings.findOne({ where: { user_id: userId } });

    if (!settings) {
      settings = await UserSettings.create({
        id: uuidv4(),
        user_id: userId
      });
    }

    // Update public profile fields
    if (public_name !== undefined) settings.public_name = public_name;
    if (public_bio !== undefined) settings.public_bio = public_bio;
    if (public_avatar_url !== undefined) settings.public_avatar_url = public_avatar_url;
    if (branding_color !== undefined) settings.branding_color = branding_color;
    if (booking_page_title !== undefined) settings.booking_page_title = booking_page_title;
    if (booking_page_description !== undefined) settings.booking_page_description = booking_page_description;

    await settings.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action: 'user.public_profile.update',
      metadata: {
        updated: {
          public_name, public_bio, public_avatar_url, branding_color,
          booking_page_title, booking_page_description
        }
      }
    });

    logger.info(`Public profile updated: ${userId}`);

    return res.status(200).json({
      message: 'Public profile updated successfully',
      profile: {
        public_name: settings.public_name,
        public_bio: settings.public_bio,
        public_avatar_url: settings.public_avatar_url,
        branding_color: settings.branding_color,
        booking_page_title: settings.booking_page_title,
        booking_page_description: settings.booking_page_description
      }
    });
  } catch (error) {
    logger.error('Error updating public profile:', error);

    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'Failed to update public profile'
      }
    });
  }
};

module.exports = {
  getCurrentUser,
  updateUser,
  getUserSettings,
  updateUserSettings,
  changePassword,
  deleteAccount,
  getPublicProfile,
  updatePublicProfile
};
