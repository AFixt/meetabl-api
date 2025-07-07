'use strict';

/**
 * Migration: Create gdpr_requests table
 * 
 * This migration creates the gdpr_requests table for tracking
 * GDPR compliance requests such as data export, deletion, and consent changes
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      await queryInterface.createTable('gdpr_requests', {
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
          comment: 'Reference to the user making the request'
        },
        request_type: {
          type: Sequelize.ENUM(
            'data_export',
            'data_deletion',
            'consent_withdrawal',
            'data_rectification',
            'data_portability',
            'processing_restriction',
            'automated_decision_objection'
          ),
          allowNull: false,
          comment: 'Type of GDPR request'
        },
        status: {
          type: Sequelize.ENUM(
            'pending',
            'processing',
            'completed',
            'failed',
            'cancelled',
            'expired'
          ),
          allowNull: false,
          defaultValue: 'pending',
          comment: 'Current status of the request'
        },
        verification_token: {
          type: Sequelize.STRING(255),
          allowNull: true,
          unique: true,
          comment: 'Token for email verification of the request'
        },
        verified_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the request was verified via email'
        },
        processed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the request was processed'
        },
        completed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the request was completed'
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the request or data export link expires'
        },
        export_url: {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: 'URL to download exported data (for data_export requests)'
        },
        export_format: {
          type: Sequelize.ENUM('json', 'csv', 'pdf'),
          allowNull: true,
          defaultValue: 'json',
          comment: 'Format of the data export'
        },
        deletion_scheduled_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When account deletion is scheduled (grace period)'
        },
        cancellation_reason: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Reason for cancellation if cancelled'
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: true,
          comment: 'IP address from which request was made'
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'User agent string of the request'
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Internal notes about the request'
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Additional metadata about the request'
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
      await queryInterface.addIndex('gdpr_requests', ['user_id'], {
        name: 'idx_gdpr_requests_user_id',
        transaction
      });

      await queryInterface.addIndex('gdpr_requests', ['request_type'], {
        name: 'idx_gdpr_requests_request_type',
        transaction
      });

      await queryInterface.addIndex('gdpr_requests', ['status'], {
        name: 'idx_gdpr_requests_status',
        transaction
      });

      await queryInterface.addIndex('gdpr_requests', ['verification_token'], {
        name: 'idx_gdpr_requests_verification_token',
        transaction
      });

      await queryInterface.addIndex('gdpr_requests', ['created'], {
        name: 'idx_gdpr_requests_created',
        transaction
      });

      await queryInterface.addIndex('gdpr_requests', ['expires_at'], {
        name: 'idx_gdpr_requests_expires_at',
        transaction
      });

      await queryInterface.addIndex('gdpr_requests', ['deletion_scheduled_at'], {
        name: 'idx_gdpr_requests_deletion_scheduled_at',
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
      await queryInterface.dropTable('gdpr_requests', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};