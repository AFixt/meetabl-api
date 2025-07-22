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
const User = require('./user.model');

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
      model: User,
      key: 'id'
    }
  },
  day_of_week: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    validate: {
      min: 0,
      max: 6
    }
  },
  start_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  end_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  buffer_minutes: {
    type: DataTypes.SMALLINT,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  max_bookings_per_day: {
    type: DataTypes.SMALLINT,
    allowNull: true,
    validate: {
      min: 1
    }
  }
}, {
  tableName: 'availability_rules',
  timestamps: false
});

// Define relationships
User.hasMany(AvailabilityRule, { foreignKey: 'userId', onDelete: 'CASCADE' });
AvailabilityRule.belongsTo(User, { foreignKey: 'userId' });

module.exports = AvailabilityRule;
