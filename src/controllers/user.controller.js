/**
 * User controller
 *
 * Handles user profile management
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { User, UserSettings, AuditLog } = require('../models');

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

module.exports = {
  getCurrentUser,
  updateUser,
  getUserSettings,
  updateUserSettings
};
