/**
 * Poll model
 *
 * Defines the Poll model for meeting polls feature
 * 
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { sequelize } = require('../config/database');

const Poll = sequelize.define('Poll', {
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
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  durationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
    field: 'duration_minutes',
    validate: {
      min: 15,
      max: 1440 // 24 hours max
    }
  },
  timezone: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'UTC'
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: true,
      isAfterToday(value) {
        if (value && value <= new Date()) {
          throw new Error('Deadline must be in the future');
        }
      }
    }
  },
  maxVotesPerParticipant: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    field: 'max_votes_per_participant',
    validate: {
      min: 1,
      max: 10
    }
  },
  allowAnonymousVotes: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'allow_anonymous_votes'
  },
  requireParticipantDetails: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'require_participant_details'
  },
  status: {
    type: DataTypes.ENUM('active', 'closed', 'finalized'),
    allowNull: false,
    defaultValue: 'active'
  },
  selectedTimeSlotId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'selected_time_slot_id'
  },
  pollUrlToken: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'poll_url_token'
  },
  notificationSettings: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'notification_settings',
    defaultValue: {
      notify_on_vote: true,
      notify_on_deadline: true,
      notify_participants_on_finalization: true
    }
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
  tableName: 'polls',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

/**
 * Generate unique poll URL token
 */
Poll.prototype.generateUrlToken = function() {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Check if poll is active and accepting votes
 */
Poll.prototype.isActive = function() {
  return this.status === 'active' && (!this.deadline || new Date() < this.deadline);
};

/**
 * Check if poll can be finalized
 */
Poll.prototype.canBeFinalized = function() {
  return this.status === 'active' || this.status === 'closed';
};

/**
 * Check if poll has expired
 */
Poll.prototype.hasExpired = function() {
  return this.deadline && new Date() > this.deadline;
};

/**
 * Get poll public URL
 */
Poll.prototype.getPublicUrl = function() {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${baseUrl}/poll/${this.pollUrlToken}`;
};

/**
 * Before create hook to generate URL token
 */
Poll.beforeCreate(async (poll) => {
  if (!poll.pollUrlToken) {
    // Generate unique token
    let token;
    let exists = true;
    while (exists) {
      token = poll.generateUrlToken();
      const existing = await Poll.findOne({ where: { poll_url_token: token } });
      exists = !!existing;
    }
    poll.pollUrlToken = token;
  }
});

/**
 * Before update hook to handle status changes
 */
Poll.beforeUpdate(async (poll) => {
  // Auto-close expired polls
  if (poll.hasExpired() && poll.status === 'active') {
    poll.status = 'closed';
  }
});

module.exports = Poll;