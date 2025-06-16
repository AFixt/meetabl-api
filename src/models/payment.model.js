/**
 * Payment model
 *
 * Defines the Payment model for Sequelize ORM
 * Represents payment transactions for bookings
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Booking = require('./booking.model');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  booking_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: 'bookings',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD',
    validate: {
      isUppercase: true,
      len: [3, 3]
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
    allowNull: false,
    defaultValue: 'pending'
  },
  stripe_payment_intent_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define relationships
Payment.belongsTo(User, { foreignKey: 'user_id' });
Payment.belongsTo(Booking, { foreignKey: 'booking_id' });
User.hasMany(Payment, { foreignKey: 'user_id' });
Booking.hasOne(Payment, { foreignKey: 'booking_id' });

module.exports = Payment;