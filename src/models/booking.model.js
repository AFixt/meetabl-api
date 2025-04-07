/**
 * Booking model
 *
 * Defines the Booking model for Sequelize ORM
 * Represents a scheduled meeting or appointment
 *
 * @author AccessMeet Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');
const User = require('./user.model');

const Booking = sequelize.define('Booking', {
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
  customer_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  customer_email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  calendar_event_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('confirmed', 'cancelled'),
    defaultValue: 'confirmed'
  },
  created: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'bookings',
  timestamps: true,
  createdAt: 'created',
  updatedAt: false
});

// Define relationships
User.hasMany(Booking, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Booking.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Booking;
