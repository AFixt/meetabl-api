/**
 * User Settings model
 *
 * Defines the UserSettings model for Sequelize ORM
 * Stores user preferences, branding, and accessibility settings
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');

const UserSettings = sequelize.define('UserSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  brandingColor: {
    type: DataTypes.STRING(7),
    defaultValue: '#000000',
    validate: {
      is: /^#[0-9A-F]{6}$/i
    }
  },
  confirmationEmailCopy: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  accessibilityMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  altTextEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  publicName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  publicBio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  publicAvatarUrl: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  bookingPageTitle: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  bookingPageDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'UserSettings',
  timestamps: false
});

// Define relationships
User.hasOne(UserSettings, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserSettings.belongsTo(User, { foreignKey: 'userId' });

module.exports = UserSettings;
