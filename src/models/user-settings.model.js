/**
 * User Settings model
 *
 * Defines the UserSettings model for Sequelize ORM
 * Stores user preferences, branding, and accessibility settings
 *
 * @author AccessMeet Team
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
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  branding_color: {
    type: DataTypes.STRING(7),
    defaultValue: '#000000',
    validate: {
      is: /^#[0-9A-F]{6}$/i
    }
  },
  confirmation_email_copy: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  accessibility_mode: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  alt_text_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'user_settings',
  timestamps: false
});

// Define relationships
User.hasOne(UserSettings, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserSettings.belongsTo(User, { foreignKey: 'user_id' });

module.exports = UserSettings;
