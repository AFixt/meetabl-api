/**
 * Booking model
 *
 * Defines the Booking model for Sequelize ORM
 * Represents a scheduled meeting or appointment
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  userId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    field: 'user_id'
  },
  eventTypeId: {
    type: DataTypes.STRING(36),
    allowNull: true,
    field: 'event_type_id'
  },
  customerName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'customer_name',
    validate: {
      notEmpty: true
    }
  },
  customerEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'customer_email',
    validate: {
      isEmail: true
    }
  },
  customerPhone: {
    type: DataTypes.STRING(25),
    allowNull: true,
    field: 'customer_phone'
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_time'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_time'
  },
  calendarEventId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'calendar_event_id'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  meetingUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'meeting_url'
  },
  status: {
    type: DataTypes.ENUM('confirmed', 'cancelled'),
    defaultValue: 'confirmed'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated'
  }
}, {
  tableName: 'bookings',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

// Relationships are defined in associations.js to avoid circular dependencies

module.exports = Booking;
