/**
 * Notification model
 *
 * Defines the Notification model for Sequelize ORM
 * Used to track email and SMS notifications sent for bookings
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Booking = require('./booking.model');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bookingId: {
    type: DataTypes.INTEGER,
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
  tableName: 'Notifications',
  timestamps: false
});

// Define relationships
Booking.hasMany(Notification, { foreignKey: 'bookingId', onDelete: 'CASCADE' });
Notification.belongsTo(Booking, { foreignKey: 'bookingId' });

module.exports = Notification;
