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
const { asyncHandler, successResponse, notFoundError, validationError, unauthorizedError, forbiddenError } = require('../utils/error-response');
// Use local storage if AWS credentials are not configured
let uploadFile, deleteFile;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET) {
  ({ uploadFile, deleteFile } = require('../services/storage.service'));
} else {
  logger.warn('AWS credentials not configured, using local storage for file uploads');
  ({ uploadFile, deleteFile } = require('../services/local-storage.service'));
}

// Configure multer for file uploads
console.log('[MULTER CONFIG] Creating multer instance');
console.log('[MULTER CONFIG] Temp dir:', '/tmp/uploads/');
console.log('[MULTER CONFIG] File size limit:', 5 * 1024 * 1024, 'bytes');

const upload = multer({
  dest: '/tmp/uploads/', // Temporary storage
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    console.log('[MULTER fileFilter] ===================');
    console.log('[MULTER fileFilter] Timestamp:', new Date().toISOString());
    console.log('[MULTER fileFilter] Called with file:', file);
    console.log('[MULTER fileFilter] File fieldname:', file.fieldname);
    console.log('[MULTER fileFilter] File mimetype:', file.mimetype);
    console.log('[MULTER fileFilter] File originalname:', file.originalname);
    console.log('[MULTER fileFilter] File encoding:', file.encoding);
    console.log('[MULTER fileFilter] Request URL:', req.url);
    console.log('[MULTER fileFilter] Request method:', req.method);
    console.log('[MULTER fileFilter] Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('[MULTER fileFilter] Request user ID:', req.user ? req.user.id : 'NO USER');
    console.log('[MULTER fileFilter] Request session:', req.session ? 'EXISTS' : 'NO SESSION');
    
    // Check if file is an image
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      console.log('[MULTER fileFilter] ✓ File type allowed');
      cb(null, true);
    } else {
      console.log('[MULTER fileFilter] ✗ File type NOT allowed');
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
    }
    console.log('[MULTER fileFilter] ===================');
  }
});
console.log('[MULTER CONFIG] Multer instance created:', typeof upload);
console.log('[MULTER CONFIG] Upload methods available:', Object.keys(upload));

/**
 * Upload logo image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadLogo = asyncHandler(async (req, res) => {
  console.log('[CONTROLLER uploadLogo] ===================');
  console.log('[CONTROLLER uploadLogo] Function called at:', new Date().toISOString());
  console.log('[CONTROLLER uploadLogo] Request ID:', req.id || 'no-id');
  console.log('[CONTROLLER uploadLogo] Request method:', req.method);
  console.log('[CONTROLLER uploadLogo] Request URL:', req.url);
  console.log('[CONTROLLER uploadLogo] Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('[CONTROLLER uploadLogo] Request user:', req.user ? JSON.stringify({ id: req.user.id, email: req.user.email }) : 'NO USER');
  console.log('[CONTROLLER uploadLogo] Request session:', req.session ? 'EXISTS' : 'NO SESSION');
  console.log('[CONTROLLER uploadLogo] Request cookies:', req.cookies ? Object.keys(req.cookies) : 'NO COOKIES');
  console.log('[CONTROLLER uploadLogo] Request file:', req.file ? JSON.stringify(req.file, null, 2) : 'NO FILE');
  console.log('[CONTROLLER uploadLogo] Request body:', JSON.stringify(req.body, null, 2));
  console.log('[CONTROLLER uploadLogo] Request files:', req.files ? JSON.stringify(req.files, null, 2) : 'NO FILES');
  
  try {
    const userId = req.user.id || req.user.dataValues?.id;
    console.log('[CONTROLLER uploadLogo] userId extracted:', userId);
    
    const { logoAltText } = req.body;
    console.log('[CONTROLLER uploadLogo] logoAltText:', logoAltText);

    // Check if this is an alt text only update (no file provided)
    if (!req.file) {
      console.log('[CONTROLLER uploadLogo] No file found in request - updating alt text only');
      
      // Find user settings
      let settings = await UserSettings.findOne({ where: { userId: userId } });
      
      if (!settings || !settings.logoUrl) {
        throw validationError([{ field: 'logo', message: 'No existing logo to update alt text for' }]);
      }
      
      // Update only the alt text
      await settings.update({
        logoAltText: logoAltText || ''
      });
      
      logger.info(`Logo alt text updated for user: ${userId}`);
      
      return successResponse(res, {
        logoUrl: settings.logoUrl,
        logoAltText: settings.logoAltText
      }, 'Alt text updated successfully');
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
 * Upload avatar image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadAvatar = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user.dataValues?.id;

    if (!req.file) {
      throw validationError([{ field: 'avatar', message: 'Avatar image is required' }]);
    }

    // Additional image validation
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      throw validationError([{ field: 'avatar', message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed' }]);
    }

    // Upload to S3
    const uploadResult = await uploadFile(req.file, 'avatars');

    // Find user
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw notFoundError('User not found');
    }

    // Delete old avatar if exists
    if (user.avatarUrl) {
      try {
        // Extract S3 key from URL
        const urlParts = user.avatarUrl.split('/');
        const oldKey = urlParts.slice(-2).join('/'); // Get 'avatars/filename.ext'
        await deleteFile(oldKey);
      } catch (deleteError) {
        logger.warn(`Failed to delete old avatar: ${deleteError.message}`);
      }
    }

    // Update user with new avatar
    user.avatarUrl = uploadResult.url;
    await user.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'user.avatar.upload',
      metadata: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        url: uploadResult.url
      }
    });

    logger.info(`Avatar uploaded for user: ${userId}`);

    return successResponse(res, {
      avatarUrl: uploadResult.url
    }, 'Avatar uploaded successfully');
  } catch (error) {
    throw error;
  }
});

/**
 * Delete avatar image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAvatar = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id || req.user.dataValues?.id;

    // Find user
    const user = await User.findByPk(userId);
    
    if (!user || !user.avatarUrl) {
      throw notFoundError('Avatar not found');
    }

    // Delete from S3
    try {
      const urlParts = user.avatarUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Get 'avatars/filename.ext'
      await deleteFile(key);
    } catch (deleteError) {
      logger.warn(`Failed to delete avatar from S3: ${deleteError.message}`);
    }

    // Update user
    user.avatarUrl = null;
    await user.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'user.avatar.delete',
      metadata: {
        deletedAt: new Date()
      }
    });

    logger.info(`Avatar deleted for user: ${userId}`);

    return successResponse(res, null, 'Avatar deleted successfully');
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
      include: [{ model: UserSettings, as: 'settings' }],
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

    // Get user with subscription data
    const user = await User.findByPk(userId, {
      attributes: [
        'plan_type',
        'stripe_subscription_id',
        'stripe_subscription_status',
        'stripe_price_id',
        'stripe_current_period_end',
        'stripe_customer_id'
      ]
    });

    // Find settings
    let settings = await UserSettings.findOne({ where: { userId: userId } });

    // Create settings if not found
    if (!settings) {
      settings = await UserSettings.create({
        id: uuidv4(),
        userId: userId
      });
    }

    // Get plan limits from configuration
    const { PLAN_LIMITS } = require('../config/stripe-products');
    const planType = user.plan_type?.toUpperCase() || 'FREE';
    const planLimits = PLAN_LIMITS[planType] || PLAN_LIMITS.FREE;

    // Combine settings with subscription data
    const settingsData = settings.toJSON();
    const combinedData = {
      ...settingsData,
      // Include subscription data from user record
      plan_type: user.plan_type,
      stripe_subscription_id: user.stripe_subscription_id,
      stripe_subscription_status: user.stripe_subscription_status,
      stripe_price_id: user.stripe_price_id,
      stripe_current_period_end: user.stripe_current_period_end,
      stripe_customer_id: user.stripe_customer_id,
      // Include plan limits from configuration
      max_event_types: planLimits.maxEventTypes,
      max_calendars: planLimits.maxCalendars,
      can_remove_branding: planLimits.canRemoveBranding || false,
      can_customize_avatar: planLimits.canCustomizeAvatar || false,
      can_customize_booking_page: planLimits.canCustomizeBookingPage || false,
      can_use_meeting_polls: planLimits.canUseMeetingPolls || false
    };

    // Return combined data
    return successResponse(res, combinedData, 'User settings retrieved successfully');
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
      branding_color, confirmation_email_copy, accessibility_mode, alt_text_enabled, booking_horizon, google_analytics_id, logo_alt_text, meeting_duration, buffer_minutes, requires_confirmation,
      // Booking page customization fields
      booking_page_primary_color, booking_page_secondary_color, booking_page_background_color, 
      booking_page_text_color, booking_page_font_size, booking_page_font_family
    } = req.body;

    // Check if user can customize booking page
    const user = await User.findByPk(userId);
    if (!user) {
      throw notFoundError('User');
    }

    // Validate booking page customization permission
    if ((booking_page_primary_color || booking_page_secondary_color || booking_page_background_color || 
         booking_page_text_color || booking_page_font_size || booking_page_font_family) && 
        !user.can_customize_booking_page) {
      throw forbiddenError('Booking page customization requires a Basic or Professional subscription');
    }

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
    if (requires_confirmation !== undefined) settings.requiresConfirmation = requires_confirmation;

    // Update booking page customization fields (if user has permission)
    if (user.can_customize_booking_page) {
      if (booking_page_primary_color !== undefined) settings.bookingPagePrimaryColor = booking_page_primary_color;
      if (booking_page_secondary_color !== undefined) settings.bookingPageSecondaryColor = booking_page_secondary_color;
      if (booking_page_background_color !== undefined) settings.bookingPageBackgroundColor = booking_page_background_color;
      if (booking_page_text_color !== undefined) settings.bookingPageTextColor = booking_page_text_color;
      if (booking_page_font_size !== undefined) settings.bookingPageFontSize = booking_page_font_size;
      if (booking_page_font_family !== undefined) settings.bookingPageFontFamily = booking_page_font_family;
    }

    await settings.save();

    // Create audit log
    await AuditLog.create({
      id: uuidv4(),
      userId: userId,
      action: 'user.settings.update',
      metadata: {
        updated: {
          branding_color, confirmation_email_copy, accessibility_mode, alt_text_enabled, booking_horizon, google_analytics_id, logo_alt_text, meeting_duration, buffer_minutes, requires_confirmation,
          booking_page_primary_color, booking_page_secondary_color, booking_page_background_color,
          booking_page_text_color, booking_page_font_size, booking_page_font_family
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

    // Find user by username
    const user = await User.findOne({
      where: { username },
      include: [{ model: UserSettings, as: 'settings' }],
      attributes: { exclude: ['password', 'password_hash'] }
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
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      timezone: user.timezone,
      can_remove_branding: user.can_remove_branding,
      can_customize_booking_page: user.can_customize_booking_page,
      settings: {
        brandingColor: user.settings?.brandingColor || '#004085',
        googleAnalyticsId: user.settings?.googleAnalyticsId || null,
        bookingPageTitle: user.settings?.bookingPageTitle || null,
        bookingPageDescription: user.settings?.bookingPageDescription || null,
        // Booking page customization fields
        bookingPagePrimaryColor: user.settings?.bookingPagePrimaryColor || '#003b49',
        bookingPageSecondaryColor: user.settings?.bookingPageSecondaryColor || '#ff6b6b',
        bookingPageBackgroundColor: user.settings?.bookingPageBackgroundColor || '#ffffff',
        bookingPageTextColor: user.settings?.bookingPageTextColor || '#333333',
        bookingPageFontSize: user.settings?.bookingPageFontSize || 'medium',
        bookingPageFontFamily: user.settings?.bookingPageFontFamily || 'Inter, sans-serif'
      }
    };

    return res.status(200).json({
      success: true,
      data: publicProfile
    });
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
  uploadAvatar,
  deleteAvatar,
  upload
};
