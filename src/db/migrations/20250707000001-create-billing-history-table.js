'use strict';

/**
 * Migration: Create billing_history table
 * 
 * This migration creates the billing_history table for tracking
 * all invoice and payment records from Stripe
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      await queryInterface.createTable('billing_history', {
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
        stripe_invoice_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
          unique: true,
          comment: 'Stripe invoice ID'
        },
        stripe_payment_intent_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'Stripe payment intent ID'
        },
        stripe_charge_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'Stripe charge ID'
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          comment: 'Amount in the currency\'s smallest unit (cents for USD)'
        },
        currency: {
          type: Sequelize.STRING(3),
          allowNull: false,
          defaultValue: 'usd',
          comment: 'Three-letter ISO currency code'
        },
        status: {
          type: Sequelize.ENUM('draft', 'open', 'paid', 'uncollectible', 'void', 'failed', 'refunded', 'partial_refund'),
          allowNull: false,
          defaultValue: 'open',
          comment: 'Invoice/payment status'
        },
        payment_method_type: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'Type of payment method used (card, bank_transfer, etc.)'
        },
        payment_method_last4: {
          type: Sequelize.STRING(4),
          allowNull: true,
          comment: 'Last 4 digits of payment method'
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Description of the invoice/payment'
        },
        invoice_pdf_url: {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: 'URL to the invoice PDF'
        },
        hosted_invoice_url: {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: 'URL to the hosted invoice page'
        },
        billing_reason: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'Reason for the invoice (subscription_create, subscription_update, etc.)'
        },
        period_start: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Start of the billing period'
        },
        period_end: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'End of the billing period'
        },
        paid_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Timestamp when payment was received'
        },
        failed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Timestamp when payment failed'
        },
        refunded_amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: 0,
          comment: 'Amount refunded if any'
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Additional metadata from Stripe'
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
      await queryInterface.addIndex('billing_history', ['user_id'], {
        name: 'idx_billing_history_user_id',
        transaction
      });

      await queryInterface.addIndex('billing_history', ['stripe_invoice_id'], {
        name: 'idx_billing_history_stripe_invoice_id',
        transaction
      });

      await queryInterface.addIndex('billing_history', ['status'], {
        name: 'idx_billing_history_status',
        transaction
      });

      await queryInterface.addIndex('billing_history', ['created'], {
        name: 'idx_billing_history_created',
        transaction
      });

      await queryInterface.addIndex('billing_history', ['paid_at'], {
        name: 'idx_billing_history_paid_at',
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
      await queryInterface.dropTable('billing_history', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};