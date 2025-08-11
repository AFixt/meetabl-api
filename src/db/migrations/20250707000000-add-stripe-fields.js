'use strict';

/**
 * Migration: Add Stripe integration fields
 * 
 * This migration adds fields necessary for Stripe integration:
 * - Customer management fields
 * - Subscription tracking fields
 * - GDPR compliance fields
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add Stripe fields to users table
      await queryInterface.addColumn('users', 'stripe_customer_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
        comment: 'Stripe customer ID for billing'
      }, { transaction });

      await queryInterface.addColumn('users', 'stripe_subscription_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Current Stripe subscription ID'
      }, { transaction });

      await queryInterface.addColumn('users', 'stripe_price_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Current Stripe price ID for subscription'
      }, { transaction });

      await queryInterface.addColumn('users', 'stripe_subscription_status', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Stripe subscription status (active, past_due, canceled, etc.)'
      }, { transaction });

      await queryInterface.addColumn('users', 'stripe_current_period_end', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'End date of current billing period'
      }, { transaction });

      // Add GDPR consent tracking fields
      await queryInterface.addColumn('users', 'marketing_consent', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'User consent for marketing communications'
      }, { transaction });

      await queryInterface.addColumn('users', 'data_processing_consent', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'User consent for data processing'
      }, { transaction });

      await queryInterface.addColumn('users', 'consent_timestamp', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when consent was given'
      }, { transaction });

      // Add indexes for performance
      await queryInterface.addIndex('users', ['stripe_customer_id'], {
        name: 'idx_users_stripe_customer_id',
        transaction
      });

      await queryInterface.addIndex('users', ['stripe_subscription_status'], {
        name: 'idx_users_stripe_subscription_status',
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
      // Remove indexes
      await queryInterface.removeIndex('users', 'idx_users_stripe_customer_id', { transaction });
      await queryInterface.removeIndex('users', 'idx_users_stripe_subscription_status', { transaction });

      // Remove columns
      await queryInterface.removeColumn('users', 'stripe_customer_id', { transaction });
      await queryInterface.removeColumn('users', 'stripe_subscription_id', { transaction });
      await queryInterface.removeColumn('users', 'stripe_price_id', { transaction });
      await queryInterface.removeColumn('users', 'stripe_subscription_status', { transaction });
      await queryInterface.removeColumn('users', 'stripe_current_period_end', { transaction });
      await queryInterface.removeColumn('users', 'marketing_consent', { transaction });
      await queryInterface.removeColumn('users', 'data_processing_consent', { transaction });
      await queryInterface.removeColumn('users', 'consent_timestamp', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};