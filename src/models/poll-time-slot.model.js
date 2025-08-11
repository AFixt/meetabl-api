/**
 * PollTimeSlot model
 *
 * Defines the PollTimeSlot model for poll time options
 * 
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const PollTimeSlot = sequelize.define('PollTimeSlot', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  pollId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'poll_id'
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_time',
    validate: {
      isDate: true,
      isAfterToday(value) {
        if (value && value <= new Date()) {
          throw new Error('Start time must be in the future');
        }
      }
    }
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_time',
    validate: {
      isDate: true,
      isAfterStartTime(value) {
        if (this.startTime && value && value <= this.startTime) {
          throw new Error('End time must be after start time');
        }
      }
    }
  },
  voteCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'vote_count',
    validate: {
      min: 0
    }
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_available'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated'
  }
}, {
  tableName: 'poll_time_slots',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

/**
 * Check if time slot overlaps with another
 */
PollTimeSlot.prototype.overlapsWidth = function(otherSlot) {
  return (this.startTime < otherSlot.endTime) && (this.endTime > otherSlot.startTime);
};

/**
 * Get duration in minutes
 */
PollTimeSlot.prototype.getDurationMinutes = function() {
  return Math.floor((this.endTime - this.startTime) / (1000 * 60));
};

/**
 * Check if time slot is in the past
 */
PollTimeSlot.prototype.isPast = function() {
  return this.startTime <= new Date();
};

/**
 * Increment vote count
 */
PollTimeSlot.prototype.incrementVotes = async function() {
  this.voteCount = (this.voteCount || 0) + 1;
  await this.save();
  return this.voteCount;
};

/**
 * Decrement vote count
 */
PollTimeSlot.prototype.decrementVotes = async function() {
  this.voteCount = Math.max((this.voteCount || 1) - 1, 0);
  await this.save();
  return this.voteCount;
};

/**
 * Format time slot for display
 */
PollTimeSlot.prototype.getDisplayTime = function(timezone = 'UTC') {
  const { format } = require('date-fns');
  const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');
  
  const startInTimezone = utcToZonedTime(this.startTime, timezone);
  const endInTimezone = utcToZonedTime(this.endTime, timezone);
  
  const startFormatted = format(startInTimezone, 'yyyy-MM-dd HH:mm');
  const endFormatted = format(endInTimezone, 'HH:mm');
  
  return `${startFormatted} - ${endFormatted}`;
};

/**
 * Before update hook to auto-disable past time slots
 */
PollTimeSlot.beforeUpdate(async (timeSlot) => {
  if (timeSlot.isPast() && timeSlot.isAvailable) {
    timeSlot.isAvailable = false;
  }
});

module.exports = PollTimeSlot;