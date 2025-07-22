'use strict';

/**
 * Migration: Add subscription plan limit fields
 * 
 * This migration adds fields necessary for enforcing subscription plan limits:
 * - Plan type (free/paid)
 * - Calendar limits
 * - Event type limits
 * - Integration permissions
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add plan type field
      await queryInterface.addColumn('users', 'plan_type', {
        type: Sequelize.ENUM('free', 'paid'),
        allowNull: false,
        defaultValue: 'free',
        comment: 'User subscription plan type'
      }, { transaction });

      // Add limit fields
      await queryInterface.addColumn('users', 'max_calendars', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Maximum number of calendars allowed'
      }, { transaction });

      await queryInterface.addColumn('users', 'max_event_types', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Maximum number of event types allowed'
      }, { transaction });

      await queryInterface.addColumn('users', 'integrations_enabled', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether calendar integrations are enabled'
      }, { transaction });

      // Add billing period type for annual vs monthly
      await queryInterface.addColumn('users', 'billing_period', {
        type: Sequelize.ENUM('monthly', 'annual'),
        allowNull: true,
        comment: 'Billing period for paid subscriptions'
      }, { transaction });

      // Add discount code tracking
      await queryInterface.addColumn('users', 'applied_discount_code', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Discount code applied to subscription'
      }, { transaction });

      // Add index for plan type
      await queryInterface.addIndex('users', ['plan_type'], {
        name: 'idx_users_plan_type',
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
      await queryInterface.removeIndex('users', 'idx_users_plan_type', { transaction });

      // Remove columns
      await queryInterface.removeColumn('users', 'plan_type', { transaction });
      await queryInterface.removeColumn('users', 'max_calendars', { transaction });
      await queryInterface.removeColumn('users', 'max_event_types', { transaction });
      await queryInterface.removeColumn('users', 'integrations_enabled', { transaction });
      await queryInterface.removeColumn('users', 'billing_period', { transaction });
      await queryInterface.removeColumn('users', 'applied_discount_code', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};