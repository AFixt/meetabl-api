/**
 * User Settings model
 *
 * Defines the UserSettings model for Sequelize ORM
 * Stores user preferences, branding, and accessibility settings
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');
const User = require('./user.model');

const UserSettings = sequelize.define('UserSettings', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  userId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'user_id',
    references: {
      model: User,
      key: 'id'
    }
  },
  brandingColor: {
    type: DataTypes.STRING(7),
    defaultValue: '#000000',
    field: 'branding_color',
    validate: {
      is: /^#[0-9A-F]{6}$/i
    }
  },
  confirmationEmailCopy: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'confirmation_email_copy'
  },
  accessibilityMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'accessibility_mode'
  },
  altTextEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'alt_text_enabled'
  },
  publicName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'public_name'
  },
  publicBio: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'public_bio'
  },
  publicAvatarUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'public_avatar_url'
  },
  bookingPageTitle: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'booking_page_title'
  },
  bookingPageDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'booking_page_description'
  },
  bookingHorizon: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    field: 'booking_horizon',
    validate: {
      isIn: [[7, 14, 21, 30]]
    }
  }
}, {
  tableName: 'UserSettings',
  timestamps: false
});

// Define relationships
User.hasOne(UserSettings, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserSettings.belongsTo(User, { foreignKey: 'userId' });

module.exports = UserSettings;
