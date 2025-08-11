'use strict';

/**
 * Migration: Add super admin field
 * 
 * This migration adds the is_super_admin field to support users
 * with full permissions without requiring Stripe subscriptions
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add super admin field to users table
      await queryInterface.addColumn('users', 'is_super_admin', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Super admin has all permissions without Stripe subscription requirements'
      }, { transaction });

      // Add index for performance when filtering super admins
      await queryInterface.addIndex('users', ['is_super_admin'], {
        name: 'idx_users_is_super_admin',
        where: {
          is_super_admin: true
        },
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove index
      await queryInterface.removeIndex('users', 'idx_users_is_super_admin', { transaction });

      // Remove column
      await queryInterface.removeColumn('users', 'is_super_admin', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};