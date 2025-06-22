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
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  lastName: {
    type: DataTypes.STRING(50),
    allowNull: false,
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
  password: {
    type: DataTypes.STRING(255),
    allowNull: true // Made optional for Outseta integration
  },
  outseta_uid: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
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
  // For Outseta users, password validation is handled externally
  if (this.outseta_uid && !this.password) {
    return false;
  }
  return bcrypt.compare(password, this.password);
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
