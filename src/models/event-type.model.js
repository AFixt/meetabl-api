/**
 * Event Type Model
 * 
 * Represents different types of meetings/events a user can offer
 * Each event type has its own settings and availability
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const EventType = sequelize.define('EventType', {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        is: /^[a-z0-9-]+$/i
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      validate: {
        min: 5,
        max: 480 // 8 hours max
      },
      comment: 'Duration in minutes'
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: '#1976d2',
      validate: {
        is: /^#[0-9A-F]{6}$/i
      }
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Default location for this event type'
    },
    locationType: {
      type: DataTypes.ENUM('in_person', 'phone', 'video', 'custom'),
      allowNull: false,
      defaultValue: 'video'
    },
    requiresConfirmation: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    bufferBefore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 120
      },
      comment: 'Buffer time before event in minutes'
    },
    bufferAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 120
      },
      comment: 'Buffer time after event in minutes'
    },
    minimumNotice: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 120,
      validate: {
        min: 0,
        max: 20160 // 14 days max
      },
      comment: 'Minimum notice required in minutes'
    },
    maximumAdvance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 43200,
      validate: {
        min: 1440, // 1 day min
        max: 525600 // 365 days max
      },
      comment: 'Maximum advance booking time in minutes'
    },
    questions: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Custom questions for attendees'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Display order position'
    }
  }, {
    tableName: 'event_types',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        unique: true,
        fields: ['user_id', 'slug']
      },
      {
        fields: ['is_active']
      }
    ]
  });

  /**
   * Generate a unique slug for the event type
   * @param {string} name - Event type name
   * @param {string} userId - User ID
   * @returns {Promise<string>} Unique slug
   */
  EventType.generateSlug = async function(name, userId) {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    let slug = baseSlug;
    let counter = 1;
    
    while (true) {
      const existing = await this.findOne({
        where: { userId, slug }
      });
      
      if (!existing) {
        return slug;
      }
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  };

  /**
   * Get the booking URL for this event type
   * @param {string} username - User's username
   * @returns {string} Booking URL
   */
  EventType.prototype.getBookingUrl = function(username) {
    return `/book/${username}/${this.slug}`;
  };

  /**
   * Check if this event type can be booked at a given time
   * @param {Date} startTime - Proposed start time
   * @returns {boolean} Whether the event type can be booked
   */
  EventType.prototype.canBeBooked = function(startTime) {
    if (!this.isActive) {
      return false;
    }

    const now = new Date();
    const minutesUntilStart = (startTime - now) / (1000 * 60);

    // Check minimum notice
    if (minutesUntilStart < this.minimumNotice) {
      return false;
    }

    // Check maximum advance
    if (minutesUntilStart > this.maximumAdvance) {
      return false;
    }

    return true;
  };

module.exports = EventType;