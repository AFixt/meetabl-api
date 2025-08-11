'use strict';

/**
 * Migration: Create or fix JWT Blacklist table
 * 
 * This migration ensures the jwtBlacklist table exists with the correct
 * structure and naming convention to match the model definition.
 * 
 * @author meetabl Team
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if table exists with either name
      const tables = await queryInterface.showAllTables();
      const hasSnakeCase = tables.includes('jwt_blacklist');
      const hasCamelCase = tables.includes('jwtBlacklist');
      
      if (hasSnakeCase && !hasCamelCase) {
        // Rename from snake_case to camelCase to match model
        await queryInterface.renameTable('jwt_blacklist', 'jwtBlacklist', { transaction });
        
        // Update column names to match model
        const columns = await queryInterface.describeTable('jwtBlacklist');
        
        if (columns.expires_at && !columns.expiresAt) {
          await queryInterface.renameColumn('jwtBlacklist', 'expires_at', 'expiresAt', { transaction });
        }
        
        // Add missing columns from model
        if (!columns.jwtId) {
          await queryInterface.addColumn('jwtBlacklist', 'jwtId', {
            type: Sequelize.STRING(36),
            allowNull: false,
            unique: true
          }, { transaction });
        }
        
        if (!columns.userId) {
          await queryInterface.addColumn('jwtBlacklist', 'userId', {
            type: Sequelize.STRING(36),
            allowNull: false
          }, { transaction });
        }
        
        if (!columns.reason) {
          await queryInterface.addColumn('jwtBlacklist', 'reason', {
            type: Sequelize.STRING(50),
            allowNull: true
          }, { transaction });
        }
        
        if (!columns.created) {
          await queryInterface.addColumn('jwtBlacklist', 'created', {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
          }, { transaction });
        }
        
        if (!columns.updated) {
          await queryInterface.addColumn('jwtBlacklist', 'updated', {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
          }, { transaction });
        }
      } else if (!hasSnakeCase && !hasCamelCase) {
        // Create table from scratch
        await queryInterface.createTable('jwtBlacklist', {
          id: {
            type: Sequelize.STRING(36),
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4
          },
          jwtId: {
            type: Sequelize.STRING(36),
            allowNull: false,
            unique: true
          },
          token: {
            type: Sequelize.TEXT,
            allowNull: false
          },
          userId: {
            type: Sequelize.STRING(36),
            allowNull: false
          },
          reason: {
            type: Sequelize.STRING(50),
            allowNull: true
          },
          expiresAt: {
            type: Sequelize.DATE,
            allowNull: false
          },
          created: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
          },
          updated: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
          }
        }, { transaction });
      }
      
      // Create indexes
      await queryInterface.addIndex('jwtBlacklist', ['jwtId'], { 
        transaction,
        name: 'idx_jwtBlacklist_jwtId'
      });
      
      await queryInterface.addIndex('jwtBlacklist', ['userId'], { 
        transaction,
        name: 'idx_jwtBlacklist_userId'
      });
      
      await queryInterface.addIndex('jwtBlacklist', ['expiresAt'], { 
        transaction,
        name: 'idx_jwtBlacklist_expiresAt'
      });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove indexes
      await queryInterface.removeIndex('jwtBlacklist', 'idx_jwtBlacklist_jwtId', { transaction });
      await queryInterface.removeIndex('jwtBlacklist', 'idx_jwtBlacklist_userId', { transaction });
      await queryInterface.removeIndex('jwtBlacklist', 'idx_jwtBlacklist_expiresAt', { transaction });
      
      // Drop table
      await queryInterface.dropTable('jwtBlacklist', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};