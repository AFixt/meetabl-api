/**
 * BookingRequest model
 *
 * Defines the BookingRequest model for Sequelize ORM
 * Represents a pending booking request awaiting email confirmation
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const BookingRequest = sequelize.define('BookingRequest', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  eventTypeId: {
    type: DataTypes.UUID,
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
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  confirmationToken: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'confirmation_token',
    unique: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'expired', 'cancelled'),
    defaultValue: 'pending',
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'confirmed_at'
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
  tableName: 'booking_requests',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

// Relationships are defined in associations.js to avoid circular dependencies

module.exports = BookingRequest;