/**
 * User model
 *
 * Defines the User model for Sequelize ORM
 *
 * @author AccessMeet Team
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
  name: {
    type: DataTypes.STRING(100),
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
  password_hash: {
    type: DataTypes.TEXT,
    allowNull: false
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
  created: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'users',
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
  return bcrypt.compare(password, this.password_hash);
};

/**
 * Hash password before saving user
 */
User.beforeCreate(async (user) => {
  if (user.changed('password_hash')) {
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(user.password_hash, salt);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password_hash')) {
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(user.password_hash, salt);
  }
});

module.exports = User;
