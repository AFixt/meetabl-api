/**
 * User controller
 *
 * Handles user profile management
 *
 * @author meetabl Team
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');
const { User, UserSettings, AuditLog } = require('../models');
const { sequelize } = require('../config/database');
const { asyncHandler, successResponse, notFoundError, validationError, unauthorizedError } = require('../utils/error-response');
const { uploadFile, deleteFile } = require('../services/storage.service');

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/', // Temporary storage
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
    }
  }
});

/**
 * Upload logo image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadLogo = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user.dataValues?.id;
    const { logoAltText } = req.body;

    if (!req.file) {
      throw validationError([{ field: 'logo', message: 'Logo image is required' }]);
    }

    // Additional image validation
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      throw validationError([{ field: 'logo', message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed' }]);
    }

    // Upload to S3
    const uploadResult = await uploadFile(req.file, 'logos');

    // Find or create user settings
    let settings = await UserSettings.findOne({ where: { userId: userId } });
    
    if (!settings) {
      settings = await UserSettings.create({
        id: uuidv4(),
        userId: userId
      });
    }

    // Delete old logo if exists
    if (settings.logoUrl) {
      try {
        // Extract S3 key from URL
        const urlParts = settings.logoUrl.split('/');
        const oldKey = urlParts.slice(-2).join('/'); // Get 'logos/filename.ext'
        await deleteFile(oldKey);
      } catch (deleteError) {
        logger.warn(`Failed to delete old logo: ${deleteError.message}`);
      }
    }

    // Update settings with new logo
    settings.logoUrl = uploadResult.url;
    if (logoAltText !== undefined) {
      settings.logoAltText = logoAltText;
    }
    
    await settings.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'user.logo.upload',
      metadata: {
        logoUrl: uploadResult.url,
        logoAltText: logoAltText,
        originalFilename: uploadResult.originalName,
        fileSize: uploadResult.size
      }
    });

    logger.info(`Logo uploaded for user: ${userId}`);

    return successResponse(res, {
      logoUrl: uploadResult.url,
      logoAltText: settings.logoAltText
    }, 'Logo uploaded successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Delete logo image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteLogo = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user.dataValues?.id;

    // Find user settings
    const settings = await UserSettings.findOne({ where: { userId: userId } });
    
    if (!settings || !settings.logoUrl) {
      throw notFoundError('Logo not found');
    }

    // Delete from S3
    try {
      const urlParts = settings.logoUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Get 'logos/filename.ext'
      await deleteFile(key);
    } catch (deleteError) {
      logger.warn(`Failed to delete logo from S3: ${deleteError.message}`);
    }

    // Update settings
    settings.logoUrl = null;
    settings.logoAltText = null;
    await settings.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'user.logo.delete',
      metadata: {
        deletedAt: new Date()
      }
    });

    logger.info(`Logo deleted for user: ${userId}`);

    return successResponse(res, null, 'Logo deleted successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user.dataValues?.id;

    // Find user with settings
    const user = await User.findOne({
      where: { id: userId },
      include: [{ model: UserSettings }],
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      throw notFoundError('User');
    }

    // Return user data
    return successResponse(res, user, 'User profile retrieved successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUser = asyncHandler(async (req, res) => {
  try {
    // Get userId from the authenticated user
    // Sequelize model instances expose their properties directly
    const userId = req.user.id || req.user.dataValues?.id;
    
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    
    const { firstName, lastName, email, username, timezone, language, phoneNumber } = req.body;

    // Find user
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      throw notFoundError('User');
    }

    // Track what fields were updated
    const updatedFields = {};

    // Update user fields
    if (firstName !== undefined && firstName !== user.firstName) {
      user.firstName = firstName;
      updatedFields.firstName = firstName;
    }
    if (lastName !== undefined && lastName !== user.lastName) {
      user.lastName = lastName;
      updatedFields.lastName = lastName;
    }
    if (email !== undefined && email !== user.email) {
      user.email = email;
      updatedFields.email = email;
    }
    if (username !== undefined && username !== user.username) {
      user.username = username;
      updatedFields.username = username;
    }
    if (timezone !== undefined && timezone !== user.timezone) {
      user.timezone = timezone;
      updatedFields.timezone = timezone;
    }
    if (language !== undefined && language !== user.language) {
      user.language = language;
      updatedFields.language = language;
    }
    if (phoneNumber !== undefined && phoneNumber !== user.phoneNumber) {
      user.phoneNumber = phoneNumber;
      updatedFields.phoneNumber = phoneNumber;
    }

    await user.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'user.update',
      metadata: {
        updated: updatedFields
      }
    });

    // Log update
    logger.info(`User profile updated: ${userId}`);

    // Return updated user
    return successResponse(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      calendar_provider: user.calendar_provider,
      created: user.created,
      updated: user.updated
    }, 'User profile updated successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Get user settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserSettings = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user.dataValues?.id;

    // Find settings
    let settings = await UserSettings.findOne({ where: { userId: userId } });

    // Create settings if not found
    if (!settings) {
      settings = await UserSettings.create({
        id: uuidv4(),
        userId: userId
      });
    }

    // Return settings
    return successResponse(res, settings, 'User settings retrieved successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Update user settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUserSettings = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user.dataValues?.id;
    const {
      branding_color, confirmation_email_copy, accessibility_mode, alt_text_enabled, booking_horizon, google_analytics_id, logo_alt_text, meeting_duration, buffer_minutes
    } = req.body;

    // Find settings
    let settings = await UserSettings.findOne({ where: { userId: userId } });

    // Create settings if not found
    if (!settings) {
      settings = await UserSettings.create({
        id: uuidv4(),
        userId: userId
      });
    }

    // Update settings fields
    if (branding_color !== undefined) settings.brandingColor = branding_color;
    if (confirmation_email_copy !== undefined) settings.confirmationEmailCopy = confirmation_email_copy;
    if (accessibility_mode !== undefined) settings.accessibilityMode = accessibility_mode;
    if (alt_text_enabled !== undefined) settings.altTextEnabled = alt_text_enabled;
    if (booking_horizon !== undefined) settings.bookingHorizon = booking_horizon;
    if (google_analytics_id !== undefined) settings.googleAnalyticsId = google_analytics_id;
    if (logo_alt_text !== undefined) settings.logoAltText = logo_alt_text;
    if (meeting_duration !== undefined) settings.meetingDuration = meeting_duration;
    if (buffer_minutes !== undefined) settings.bufferMinutes = buffer_minutes;

    await settings.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'user.settings.update',
      metadata: {
        updated: {
          branding_color, confirmation_email_copy, accessibility_mode, alt_text_enabled, booking_horizon, google_analytics_id, logo_alt_text, meeting_duration
        }
      }
    });

    // Log update
    logger.info(`User settings updated: ${userId}`);

    // Return updated settings
    return successResponse(res, settings, 'User settings updated successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Change user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const changePassword = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user.dataValues?.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      throw validationError([
        { field: 'currentPassword', message: 'Current password is required' },
        { field: 'newPassword', message: 'New password is required' }
      ]);
    }

    // Validate new password length
    if (newPassword.length < 6) {
      throw validationError([{ field: 'newPassword', message: 'New password must be at least 6 characters long' }]);
    }

    // Find user
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      throw notFoundError('User');
    }

    // Validate current password
    const isValidPassword = await user.validatePassword(currentPassword);
    if (!isValidPassword) {
      throw unauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'user.password.change',
      metadata: {
        changed_at: new Date()
      }
    });

    logger.info(`Password changed for user: ${userId}`);

    return successResponse(res, null, 'Password changed successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Delete user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAccount = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id || req.user.dataValues?.id;
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
      userId: userId,
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
    const userId = req.user.id || req.user.dataValues?.id;
    const {
      public_name, public_bio, public_avatar_url, branding_color, 
      booking_page_title, booking_page_description
    } = req.body;

    // Find or create user settings
    let settings = await UserSettings.findOne({ where: { userId: userId } });

    if (!settings) {
      settings = await UserSettings.create({
        id: uuidv4(),
        userId: userId
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
      userId: userId,
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
  updatePublicProfile,
  uploadLogo,
  deleteLogo,
  upload
};
