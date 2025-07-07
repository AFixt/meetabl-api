'use strict';

/**
 * Migration: Create usage_records table
 * 
 * This migration creates the usage_records table for tracking
 * metered usage that can be reported to Stripe for usage-based billing
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      await queryInterface.createTable('usage_records', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Reference to the user'
        },
        metric_name: {
          type: Sequelize.STRING(255),
          allowNull: false,
          comment: 'Name of the metric being tracked (e.g., bookings, api_calls, storage_gb)'
        },
        quantity: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
          comment: 'Quantity of usage'
        },
        unit: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'Unit of measurement (e.g., count, gb, minutes)'
        },
        timestamp: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          comment: 'When the usage occurred'
        },
        period_start: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Start of the usage period'
        },
        period_end: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'End of the usage period'
        },
        stripe_usage_record_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
          unique: true,
          comment: 'Stripe usage record ID if reported'
        },
        stripe_subscription_item_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'Stripe subscription item this usage is associated with'
        },
        reported_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When this usage was reported to Stripe'
        },
        idempotency_key: {
          type: Sequelize.STRING(255),
          allowNull: true,
          unique: true,
          comment: 'Idempotency key to prevent duplicate reporting'
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Additional metadata about the usage'
        },
        created: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      }, { transaction });

      // Add indexes for performance
      await queryInterface.addIndex('usage_records', ['user_id'], {
        name: 'idx_usage_records_user_id',
        transaction
      });

      await queryInterface.addIndex('usage_records', ['metric_name'], {
        name: 'idx_usage_records_metric_name',
        transaction
      });

      await queryInterface.addIndex('usage_records', ['timestamp'], {
        name: 'idx_usage_records_timestamp',
        transaction
      });

      await queryInterface.addIndex('usage_records', ['reported_at'], {
        name: 'idx_usage_records_reported_at',
        transaction
      });

      await queryInterface.addIndex('usage_records', ['stripe_usage_record_id'], {
        name: 'idx_usage_records_stripe_usage_record_id',
        transaction
      });

      // Composite index for querying unreported usage
      await queryInterface.addIndex('usage_records', ['user_id', 'metric_name', 'reported_at'], {
        name: 'idx_usage_records_user_metric_reported',
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
      await queryInterface.dropTable('usage_records', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};