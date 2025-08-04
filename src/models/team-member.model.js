/**
 * TeamMember model
 *
 * Defines the TeamMember model for Sequelize ORM
 * Represents a user's membership in a team with their role
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const TeamMember = sequelize.define('TeamMember', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  team_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: 'Teams',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'member'),
    allowNull: false,
    defaultValue: 'member'
  },
  joined_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
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
  tableName: 'team_members',
  timestamps: true,
  createdAt: 'created',
  updatedAt: 'updated',
  indexes: [
    {
      unique: true,
      fields: ['team_id', 'user_id']
    }
  ]
});

// Relationships are defined in associations.js to avoid circular dependencies

module.exports = TeamMember;
