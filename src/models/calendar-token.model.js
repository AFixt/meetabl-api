/**
 * Calendar Token model
 *
 * Defines the CalendarToken model for Sequelize ORM
 * Used to store OAuth tokens for calendar providers
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const CalendarToken = sequelize.define('CalendarToken', {
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
      model: 'users',
      key: 'id'
    }
  },
  provider: {
    type: DataTypes.ENUM('google', 'microsoft'),
    allowNull: false
  },
  accessToken: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'access_token'
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'refresh_token'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  scope: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'calendar_tokens',
  timestamps: false
});

// Relationships are defined in associations.js to avoid circular dependencies

module.exports = CalendarToken;
