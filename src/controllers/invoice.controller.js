/**
 * Invoice controller
 *
 * Handles invoice management and downloads
 *
 * @author meetabl Team
 */

const logger = require('../config/logger');
const { Invoice, Payment, Booking, User, AuditLog } = require('../models');
const { Op } = require('../config/database');
const storageService = require('../services/storage.service');

/**
 * Get all invoices for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getInvoices = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, status } = req.query;

    // Build query conditions
    const where = {};
    if (status) {
      where.status = status;
    }

    // Optimized query with flattened includes to reduce deep nesting
    const invoices = await Invoice.findAndCountAll({
      where,
      include: [{
        model: Payment,
        required: true,
        where: { user_id: userId },
        attributes: ['id', 'booking_id', 'amount', 'currency', 'status', 'payment_method'],
        include: [{
          model: Booking,
          attributes: ['id', 'customer_name', 'customer_email', 'start_time', 'end_time', 'user_id'],
          include: [{
            model: User,
            attributes: ['id', 'name', 'email']
          }]
        }]
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    return res.status(200).json({
      message: 'Invoices retrieved successfully',
      data: {
        total: invoices.count,
        invoices: invoices.rows,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      }
    });
  } catch (error) {
    logger.error('Error getting invoices:', error);
    return res.status(500).json({
      error: 'Failed to retrieve invoices',
      message: error.message
    });
  }
};

/**
 * Get a specific invoice
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const invoice = await Invoice.findOne({
      where: { id },
      include: [{
        model: Payment,
        required: true,
        where: { user_id: userId },
        include: [{
          model: Booking,
          include: [{
            model: User,
            attributes: ['id', 'name', 'email']
          }]
        }]
      }]
    });

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    return res.status(200).json({
      message: 'Invoice retrieved successfully',
      data: invoice
    });
  } catch (error) {
    logger.error('Error getting invoice:', error);
    return res.status(500).json({
      error: 'Failed to retrieve invoice',
      message: error.message
    });
  }
};

/**
 * Download invoice PDF
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const downloadInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find invoice
    const invoice = await Invoice.findOne({
      where: { id },
      include: [{
        model: Payment,
        required: true,
        where: { user_id: userId }
      }]
    });

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    // Check if PDF URL exists
    if (!invoice.pdf_url) {
      return res.status(404).json({
        error: 'Invoice PDF not available'
      });
    }

    // Log the download
    await AuditLog.create({
      user_id: userId,
      action: 'invoice_downloaded',
      entity_type: 'invoice',
      entity_id: invoice.id,
      metadata: JSON.stringify({
        invoice_number: invoice.invoice_number
      })
    });

    // Get presigned URL for download
    const downloadUrl = await storageService.getPresignedUrl(invoice.pdf_url, {
      expiresIn: 300, // 5 minutes
      responseContentDisposition: `attachment; filename="invoice-${invoice.invoice_number}.pdf"`
    });

    logger.info(`Invoice ${id} download requested by user ${userId}`);

    return res.status(200).json({
      message: 'Invoice download URL generated successfully',
      data: {
        download_url: downloadUrl,
        expires_in: 300
      }
    });
  } catch (error) {
    logger.error('Error downloading invoice:', error);
    return res.status(500).json({
      error: 'Failed to generate invoice download URL',
      message: error.message
    });
  }
};

/**
 * Generate invoice PDF (internal use)
 * @param {Object} invoiceData - Invoice data
 * @returns {Promise<string>} PDF URL
 */
const generateInvoicePDF = async (invoiceData) => {
  try {
    // This is a placeholder for PDF generation logic
    // In a real implementation, you would:
    // 1. Use a PDF generation library (e.g., puppeteer, pdfkit)
    // 2. Create PDF from invoice data
    // 3. Upload to S3
    // 4. Return the S3 URL

    logger.info(`Generating PDF for invoice ${invoiceData.invoice_number}`);
    
    // For now, return a placeholder
    return null;
  } catch (error) {
    logger.error('Error generating invoice PDF:', error);
    throw error;
  }
};

module.exports = {
  getInvoices,
  getInvoice,
  downloadInvoice,
  generateInvoicePDF
};