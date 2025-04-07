/**
 * Audit Log model
 *
 * Defines the AuditLog model for Sequelize ORM
 * Tracks user actions for security and compliance
 *
 * @author AccessMeet Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');
const User = require('./user.model');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  created: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  createdAt: 'created',
  updatedAt: false
});

// Define relationships
User.hasMany(AuditLog, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

module.exports = AuditLog;
