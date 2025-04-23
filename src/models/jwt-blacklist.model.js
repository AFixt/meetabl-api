/**
 * JWT Blacklist Model
 *
 * This model stores information about revoked JWTs
 * for handling user logout and token invalidation
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const JwtBlacklist = sequelize.define('JwtBlacklist', {
    inc: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    jwtId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    userId: {
      type: DataTypes.STRING(36),
      allowNull: false
    },
    reason: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
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

  return JwtBlacklist;
};
