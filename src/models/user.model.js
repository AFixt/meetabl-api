/**
 * User model
 *
 * Defines the User model for Sequelize ORM
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  firstName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'first_name',
    validate: {
      notEmpty: true
    }
  },
  lastName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'last_name',
    validate: {
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    validate: {
      is: /^[a-z0-9-]+$/i // Allow only alphanumeric and hyphens
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  subscription_plan: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  subscription_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  subscription_end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'user'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active'
  },
  timezone: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'UTC'
  },
  language: {
    type: DataTypes.STRING(10),
    allowNull: true,
    defaultValue: 'en'
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'phone_number'
  },
  calendar_provider: {
    type: DataTypes.ENUM('none', 'google', 'microsoft'),
    defaultValue: 'none'
  },
  password_reset_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  password_reset_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  email_verification_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  email_verification_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Stripe subscription fields
  stripe_customer_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
  },
  stripe_subscription_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  stripe_price_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  stripe_subscription_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  stripe_current_period_end: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Plan limit fields
  plan_type: {
    type: DataTypes.ENUM('free', 'paid'),
    allowNull: false,
    defaultValue: 'free'
  },
  max_calendars: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  max_event_types: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  integrations_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  billing_period: {
    type: DataTypes.ENUM('monthly', 'annual'),
    allowNull: true
  },
  applied_discount_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  // GDPR consent fields
  marketing_consent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  data_processing_consent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  consent_timestamp: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Users',
  timestamps: true,
  createdAt: 'created',
  updatedAt: 'updated'
});

/**
 * Validates user password
 * @param {string} password - Plain text password to validate
 * @returns {Promise<boolean>} Whether password is valid
 */
User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

/**
 * Checks if user has a paid subscription
 * @returns {boolean} Whether user has paid subscription
 */
User.prototype.hasPaidSubscription = function () {
  return this.plan_type === 'paid' && 
         this.stripe_subscription_status === 'active';
};

/**
 * Checks if user can add more calendars
 * @param {number} currentCount - Current number of calendars
 * @returns {boolean} Whether user can add more calendars
 */
User.prototype.canAddCalendars = function (currentCount) {
  return currentCount < this.max_calendars;
};

/**
 * Checks if user can add more event types
 * @param {number} currentCount - Current number of event types
 * @returns {boolean} Whether user can add more event types
 */
User.prototype.canAddEventTypes = function (currentCount) {
  return currentCount < this.max_event_types;
};

/**
 * Checks if user can use integrations
 * @returns {boolean} Whether user can use integrations
 */
User.prototype.canUseIntegrations = function () {
  return this.integrations_enabled;
};

/**
 * Set up hooks for password hashing
 */
const hashPassword = async (user) => {
  // Only hash password if it's provided and changed
  if (user.password && user.changed && user.changed('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
};

// Add hooks directly to the model
User.beforeCreate(hashPassword);
User.beforeUpdate(hashPassword);

module.exports = User;
