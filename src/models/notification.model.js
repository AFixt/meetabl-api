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
const Booking = require('./booking.model');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  booking_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: Booking,
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('email', 'sms'),
    allowNull: false
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'failed'),
    defaultValue: 'pending'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'notifications',
  timestamps: false
});

// Define relationships
Booking.hasMany(Notification, { foreignKey: 'booking_id', onDelete: 'CASCADE' });
Notification.belongsTo(Booking, { foreignKey: 'booking_id' });

module.exports = Notification;
