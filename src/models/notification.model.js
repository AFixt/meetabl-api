/**
 * Notification model
 *
 * Defines the Notification model for Sequelize ORM
 * Used to track email and SMS notifications sent for bookings
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'bookings',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('email', 'sms'),
    allowNull: false
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'failed'),
    defaultValue: 'pending'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'notifications',
  timestamps: false
});

// Relationships are defined in associations.js to avoid circular dependencies

module.exports = Notification;
