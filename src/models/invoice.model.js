/**
 * Invoice model
 *
 * Defines the Invoice model for Sequelize ORM
 * Represents invoices generated for payments
 *
 * @author meetabl Team
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/database');
const Payment = require('./payment.model');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  payment_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    unique: true,
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  invoice_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  pdf_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'paid'),
    allowNull: false,
    defaultValue: 'draft'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'invoices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define relationships
Invoice.belongsTo(Payment, { foreignKey: 'payment_id' });
Payment.hasOne(Invoice, { foreignKey: 'payment_id' });

module.exports = Invoice;