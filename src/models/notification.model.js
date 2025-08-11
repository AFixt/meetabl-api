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
    type: DataTypes.ENUM('booking_created', 'booking_updated', 'booking_cancelled', 'reminder'),
    allowNull: false
  },
  channel: {
    type: DataTypes.ENUM('email', 'sms'),
    allowNull: false,
    defaultValue: 'email'
  },
  recipient: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  scheduledFor: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'scheduled_for'
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
    allowNull: true,
    field: 'error_message'
  },
  errorDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_details'
  }
}, {
  tableName: 'notifications',
  timestamps: false
});

// Relationships are defined in associations.js to avoid circular dependencies

module.exports = Notification;
