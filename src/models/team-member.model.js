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
const User = require('./user.model');
const Team = require('./team.model');

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
      model: Team,
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: User,
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

// Define relationships
Team.hasMany(TeamMember, { foreignKey: 'team_id', as: 'members', onDelete: 'CASCADE' });
TeamMember.belongsTo(Team, { foreignKey: 'team_id' });

User.hasMany(TeamMember, { foreignKey: 'user_id', as: 'teamMemberships', onDelete: 'CASCADE' });
TeamMember.belongsTo(User, { foreignKey: 'user_id' });

// Additional association for easy access to teams through users
Team.belongsToMany(User, {
  through: TeamMember,
  foreignKey: 'team_id',
  otherKey: 'user_id',
  as: 'teamMembers'
});
User.belongsToMany(Team, {
  through: TeamMember,
  foreignKey: 'user_id',
  otherKey: 'team_id',
  as: 'teams'
});

module.exports = TeamMember;
