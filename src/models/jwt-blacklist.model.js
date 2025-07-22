/**
 * JWT Blacklist Model
 *
 * This model stores information about revoked JWTs
 * for handling user logout and token invalidation
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');

const JwtBlacklist = sequelize.define('JwtBlacklist', {
    id: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      defaultValue: () => uuidv4()
    },
    jwtId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true,
      field: 'jwtId'  // Explicitly map to camelCase column
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    userId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      field: 'userId'  // Explicitly map to camelCase column
    },
    reason: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expiresAt'  // Explicitly map to camelCase column
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
    tableName: 'jwtBlacklist',
    timestamps: true,
    createdAt: 'created',
    updatedAt: 'updated',
    indexes: [
      {
        fields: ['jwtId']
      },
      {
        fields: ['userId']
      },
      {
        fields: ['expiresAt']
      }
    ]
  });

module.exports = JwtBlacklist;
