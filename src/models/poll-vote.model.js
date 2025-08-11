/**
 * PollVote model
 *
 * Defines the PollVote model for participant votes on poll time slots
 * 
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { sequelize } = require('../config/database');

const PollVote = sequelize.define('PollVote', {
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
  pollTimeSlotId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'poll_time_slot_id'
  },
  participantName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'participant_name',
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  participantEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'participant_email',
    validate: {
      isEmail: true
    }
  },
  participantIdentifier: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'participant_identifier',
    validate: {
      notEmpty: true
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
  tableName: 'poll_votes',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

/**
 * Generate participant identifier for anonymous voting
 */
PollVote.generateParticipantIdentifier = function(email, pollId, isAnonymous = false) {
  if (isAnonymous) {
    // Create a hash that's unique per poll but doesn't expose the email
    return crypto
      .createHash('sha256')
      .update(`${email}:${pollId}`)
      .digest('hex')
      .substring(0, 20);
  }
  
  return email; // Use email directly for non-anonymous polls
};

/**
 * Check if this vote is from the same participant (based on identifier)
 */
PollVote.prototype.isSameParticipant = function(otherVote) {
  return this.participantIdentifier === otherVote.participantIdentifier;
};

/**
 * Get participant display name (for anonymous polls, show limited info)
 */
PollVote.prototype.getParticipantDisplayName = function(isAnonymous = false) {
  if (isAnonymous) {
    // Show first name and first letter of last name
    const nameParts = this.participantName.trim().split(' ');
    if (nameParts.length > 1) {
      return `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`;
    }
    return nameParts[0];
  }
  
  return this.participantName;
};

/**
 * Get participant display email (for anonymous polls, show masked email)
 */
PollVote.prototype.getParticipantDisplayEmail = function(isAnonymous = false) {
  if (isAnonymous) {
    const [localPart, domain] = this.participantEmail.split('@');
    const maskedLocal = localPart.length > 2 
      ? `${localPart.substring(0, 2)}***`
      : `${localPart.charAt(0)}***`;
    return `${maskedLocal}@${domain}`;
  }
  
  return this.participantEmail;
};

/**
 * Before create hook to set participant identifier
 */
PollVote.beforeCreate(async (vote) => {
  // Get poll to check if it's anonymous
  const Poll = require('./poll.model');
  const poll = await Poll.findByPk(vote.pollId);
  
  if (poll) {
    vote.participantIdentifier = PollVote.generateParticipantIdentifier(
      vote.participantEmail,
      vote.pollId,
      poll.allowAnonymousVotes
    );
  }
});

/**
 * After create hook to increment vote count on time slot
 */
PollVote.afterCreate(async (vote) => {
  const PollTimeSlot = require('./poll-time-slot.model');
  const timeSlot = await PollTimeSlot.findByPk(vote.pollTimeSlotId);
  if (timeSlot) {
    await timeSlot.incrementVotes();
  }
});

/**
 * After destroy hook to decrement vote count on time slot
 */
PollVote.afterDestroy(async (vote) => {
  const PollTimeSlot = require('./poll-time-slot.model');
  const timeSlot = await PollTimeSlot.findByPk(vote.pollTimeSlotId);
  if (timeSlot) {
    await timeSlot.decrementVotes();
  }
});

module.exports = PollVote;