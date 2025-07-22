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
const User = require('./user.model');

const CalendarToken = sequelize.define('CalendarToken', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  userId: {
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
  accessToken: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  scope: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'CalendarTokens',
  timestamps: false
});

// Define relationships
User.hasMany(CalendarToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
CalendarToken.belongsTo(User, { foreignKey: 'userId' });

module.exports = CalendarToken;
