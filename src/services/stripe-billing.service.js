/**
 * Stripe Billing Service
 * 
 * Handles invoicing, payment methods, and billing history
 */

const stripeService = require('./stripe.service');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

class StripeBillingService {
  /**
   * List invoices for a customer
   * @param {string} customerId - Stripe customer ID
   * @param {Object} options - List options
   * @returns {Promise<Array>} Array of invoices
   */
  async listInvoices(customerId, options = {}) {
    try {
      const stripe = stripeService.getStripe();
      const params = {
        customer: customerId,
        limit: options.limit || 100,
        ...options
      };

      const invoices = await stripe.invoices.list(params);
      return invoices.data;
    } catch (error) {
      logger.error(`Failed to list invoices for customer ${customerId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Get a specific invoice
   * @param {string} invoiceId - Stripe invoice ID
   * @returns {Promise<Object>} Invoice object
   */
  async getInvoice(invoiceId) {
    try {
      const stripe = stripeService.getStripe();
      const invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ['payment_intent', 'subscription']
      });
      return invoice;
    } catch (error) {
      logger.error(`Failed to retrieve invoice ${invoiceId}:`, error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Save invoice to billing history
   * @param {Object} invoice - Stripe invoice object
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Saved billing history record
   */
  async saveInvoiceToBillingHistory(invoice, userId) {
    try {
      const query = `
        INSERT INTO billing_history (
          user_id, stripe_invoice_id, stripe_payment_intent_id, stripe_charge_id,
          amount, currency, status, payment_method_type, payment_method_last4,
          description, invoice_pdf_url, hosted_invoice_url, billing_reason,
          period_start, period_end, paid_at, metadata, created, updated
        ) VALUES (
          :userId, :stripeInvoiceId, :stripePaymentIntentId, :stripeChargeId,
          :amount, :currency, :status, :paymentMethodType, :paymentMethodLast4,
          :description, :invoicePdfUrl, :hostedInvoiceUrl, :billingReason,
          :periodStart, :periodEnd, :paidAt, :metadata, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          paid_at = VALUES(paid_at),
          updated = NOW()
      `;

      const charge = invoice.charge ? await this.getCharge(invoice.charge) : null;
      const paymentMethod = charge?.payment_method_details;

      const result = await sequelize.query(query, {
        replacements: {
          userId,
          stripeInvoiceId: invoice.id,
          stripePaymentIntentId: invoice.payment_intent,
          stripeChargeId: invoice.charge,
          amount: invoice.amount_paid || invoice.amount_due,
          currency: invoice.currency,
          status: this.mapInvoiceStatus(invoice.status),
          paymentMethodType: paymentMethod?.type,
          paymentMethodLast4: paymentMethod?.card?.last4,
          description: invoice.description || `Invoice for ${invoice.period_start ? new Date(invoice.period_start * 1000).toLocaleDateString() : 'subscription'}`,
          invoicePdfUrl: invoice.invoice_pdf,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          billingReason: invoice.billing_reason,
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
          paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
          metadata: JSON.stringify(invoice.metadata || {})
        },
        type: QueryTypes.INSERT
      });

      logger.info(`Saved invoice ${invoice.id} to billing history for user ${userId}`);
      return result;
    } catch (error) {
      logger.error('Failed to save invoice to billing history:', error);
      throw new AppError('Failed to save billing record', 500);
    }
  }

  /**
   * Get charge details
   * @param {string} chargeId - Stripe charge ID
   * @returns {Promise<Object>} Charge object
   */
  async getCharge(chargeId) {
    if (!chargeId) return null;
    
    try {
      const stripe = stripeService.getStripe();
      const charge = await stripe.charges.retrieve(chargeId);
      return charge;
    } catch (error) {
      logger.error(`Failed to retrieve charge ${chargeId}:`, error);
      return null;
    }
  }

  /**
   * Map Stripe invoice status to our status enum
   * @param {string} stripeStatus - Stripe status
   * @returns {string} Our status
   */
  mapInvoiceStatus(stripeStatus) {
    const statusMap = {
      'draft': 'draft',
      'open': 'open',
      'paid': 'paid',
      'uncollectible': 'uncollectible',
      'void': 'void'
    };
    return statusMap[stripeStatus] || 'open';
  }

  /**
   * Attach payment method to customer
   * @param {string} paymentMethodId - Stripe payment method ID
   * @param {string} customerId - Stripe customer ID
   * @returns {Promise<Object>} Attached payment method
   */
  async attachPaymentMethod(paymentMethodId, customerId) {
    try {
      const stripe = stripeService.getStripe();
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      logger.info(`Attached payment method ${paymentMethodId} to customer ${customerId}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to attach payment method:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Detach payment method from customer
   * @param {string} paymentMethodId - Stripe payment method ID
   * @returns {Promise<Object>} Detached payment method
   */
  async detachPaymentMethod(paymentMethodId) {
    try {
      const stripe = stripeService.getStripe();
      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);

      logger.info(`Detached payment method ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to detach payment method:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Set default payment method for customer
   * @param {string} customerId - Stripe customer ID
   * @param {string} paymentMethodId - Stripe payment method ID
   * @returns {Promise<Object>} Updated customer
   */
  async setDefaultPaymentMethod(customerId, paymentMethodId) {
    try {
      const stripe = stripeService.getStripe();
      const customer = await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      logger.info(`Set default payment method for customer ${customerId}`);
      return customer;
    } catch (error) {
      logger.error('Failed to set default payment method:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Get billing history from database
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Billing history records
   */
  async getBillingHistory(userId, options = {}) {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const query = `
        SELECT 
          id, stripe_invoice_id, stripe_payment_intent_id, amount, currency,
          status, payment_method_type, payment_method_last4, description,
          invoice_pdf_url, hosted_invoice_url, period_start, period_end,
          paid_at, created
        FROM billing_history
        WHERE user_id = :userId
        ORDER BY created DESC
        LIMIT :limit OFFSET :offset
      `;

      const records = await sequelize.query(query, {
        replacements: { userId, limit, offset },
        type: QueryTypes.SELECT
      });

      // Format amounts
      return records.map(record => ({
        ...record,
        amount: stripeService.parseAmount(record.amount, record.currency)
      }));
    } catch (error) {
      logger.error('Failed to get billing history:', error);
      throw new AppError('Failed to retrieve billing history', 500);
    }
  }

  /**
   * Process refund for an invoice
   * @param {string} invoiceId - Stripe invoice ID
   * @param {Object} options - Refund options
   * @returns {Promise<Object>} Refund object
   */
  async processRefund(invoiceId, options = {}) {
    try {
      const stripe = stripeService.getStripe();
      
      // Get invoice to find the charge
      const invoice = await this.getInvoice(invoiceId);
      
      if (!invoice.charge) {
        throw new AppError('Invoice has no associated charge', 400);
      }

      const refundData = {
        charge: invoice.charge,
        reason: options.reason || 'requested_by_customer',
        metadata: {
          invoice_id: invoiceId,
          ...options.metadata
        }
      };

      if (options.amount) {
        refundData.amount = stripeService.formatAmount(options.amount, invoice.currency);
      }

      const refund = await stripe.refunds.create(refundData);

      // Update billing history
      await this.updateBillingHistoryRefund(invoiceId, refund);

      logger.info(`Processed refund for invoice ${invoiceId}`);
      return refund;
    } catch (error) {
      logger.error('Failed to process refund:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Update billing history with refund information
   * @param {string} invoiceId - Stripe invoice ID
   * @param {Object} refund - Stripe refund object
   * @returns {Promise<void>}
   */
  async updateBillingHistoryRefund(invoiceId, refund) {
    try {
      const query = `
        UPDATE billing_history 
        SET 
          status = CASE 
            WHEN :amount = amount THEN 'refunded'
            ELSE 'partial_refund'
          END,
          refunded_amount = COALESCE(refunded_amount, 0) + :amount,
          updated = NOW()
        WHERE stripe_invoice_id = :invoiceId
      `;

      await sequelize.query(query, {
        replacements: {
          invoiceId,
          amount: refund.amount
        },
        type: QueryTypes.UPDATE
      });
    } catch (error) {
      logger.error('Failed to update billing history with refund:', error);
    }
  }

  /**
   * Retry payment for a failed invoice
   * @param {string} invoiceId - Stripe invoice ID
   * @returns {Promise<Object>} Updated invoice
   */
  async retryInvoicePayment(invoiceId) {
    try {
      const stripe = stripeService.getStripe();
      const invoice = await stripe.invoices.pay(invoiceId);

      logger.info(`Retried payment for invoice ${invoiceId}`);
      return invoice;
    } catch (error) {
      logger.error('Failed to retry invoice payment:', error);
      throw stripeService.handleStripeError(error);
    }
  }

  /**
   * Download invoice as PDF
   * @param {string} invoiceId - Stripe invoice ID
   * @returns {Promise<string>} PDF download URL
   */
  async getInvoicePdfUrl(invoiceId) {
    try {
      const invoice = await this.getInvoice(invoiceId);
      
      if (!invoice.invoice_pdf) {
        throw new AppError('Invoice PDF not available', 404);
      }

      return invoice.invoice_pdf;
    } catch (error) {
      logger.error('Failed to get invoice PDF:', error);
      throw error;
    }
  }

  /**
   * Calculate revenue metrics
   * @param {Object} options - Calculation options
   * @returns {Promise<Object>} Revenue metrics
   */
  async calculateRevenueMetrics(options = {}) {
    try {
      const startDate = options.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
      const endDate = options.endDate || new Date();

      const query = `
        SELECT 
          COUNT(DISTINCT user_id) as unique_customers,
          COUNT(*) as total_invoices,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_revenue,
          SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as failed_amount,
          SUM(refunded_amount) as total_refunded,
          AVG(CASE WHEN status = 'paid' THEN amount ELSE NULL END) as average_invoice_amount
        FROM billing_history
        WHERE created BETWEEN :startDate AND :endDate
      `;

      const [metrics] = await sequelize.query(query, {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT
      });

      return {
        ...metrics,
        total_revenue: stripeService.parseAmount(metrics.total_revenue || 0),
        failed_amount: stripeService.parseAmount(metrics.failed_amount || 0),
        total_refunded: stripeService.parseAmount(metrics.total_refunded || 0),
        average_invoice_amount: stripeService.parseAmount(metrics.average_invoice_amount || 0),
        net_revenue: stripeService.parseAmount((metrics.total_revenue || 0) - (metrics.total_refunded || 0))
      };
    } catch (error) {
      logger.error('Failed to calculate revenue metrics:', error);
      throw new AppError('Failed to calculate revenue metrics', 500);
    }
  }
}

// Export singleton instance
module.exports = new StripeBillingService();