/**
 * Availability Rule model
 *
 * Defines the AvailabilityRule model for Sequelize ORM
 * Used to store user's recurring availability patterns
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const AvailabilityRule = sequelize.define('AvailabilityRule', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  userId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  dayOfWeek: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    field: 'day_of_week',
    validate: {
      min: 0,
      max: 6
    }
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false,
    field: 'start_time'
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false,
    field: 'end_time'
  },
  bufferMinutes: {
    type: DataTypes.SMALLINT,
    defaultValue: 0,
    field: 'buffer_minutes',
    validate: {
      min: 0
    }
  },
  maxBookingsPerDay: {
    type: DataTypes.SMALLINT,
    allowNull: true,
    field: 'max_bookings_per_day',
    validate: {
      min: 1
    }
  }
}, {
  tableName: 'availability_rules',
  timestamps: false
});

// Relationships are defined in associations.js to avoid circular dependencies

module.exports = AvailabilityRule;
