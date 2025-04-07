/**
 * Calendar Token model
 *
 * Defines the CalendarToken model for Sequelize ORM
 * Used to store OAuth tokens for calendar providers
 *
 * @author AccessMeet Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');
const User = require('./user.model');

const CalendarToken = sequelize.define('CalendarToken', {
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
  provider: {
    type: DataTypes.ENUM('google', 'microsoft'),
    allowNull: false
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  scope: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'calendar_tokens',
  timestamps: false
});

// Define relationships
User.hasMany(CalendarToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
CalendarToken.belongsTo(User, { foreignKey: 'user_id' });

module.exports = CalendarToken;
