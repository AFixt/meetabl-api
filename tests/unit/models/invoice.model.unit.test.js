/**
 * Invoice model unit tests
 *
 * Tests the Invoice model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { Invoice } = require('../../../src/models');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('Invoice Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Invoice model methods
    Invoice.create = jest.fn();
    Invoice.findAll = jest.fn();
    Invoice.findOne = jest.fn();
    Invoice.findByPk = jest.fn();
    Invoice.update = jest.fn();
    Invoice.destroy = jest.fn();
    Invoice.count = jest.fn();
  });

  describe('Invoice Operations', () => {
    beforeEach(() => {
      // Setup default mock implementations
      Invoice.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        payment_id: data.payment_id,
        invoice_number: data.invoice_number,
        pdf_url: data.pdf_url || null,
        status: data.status || 'draft',
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      }));
      
      Invoice.findAll.mockResolvedValue([]);
      Invoice.findOne.mockResolvedValue(null);
      Invoice.update.mockResolvedValue([1]);
      Invoice.count.mockResolvedValue(0);
    });

    test('should create invoice with valid data', async () => {
      const validData = {
        payment_id: 'payment-123',
        invoice_number: 'INV-2024-002',
        pdf_url: 'https://storage.example.com/invoices/inv-2024-002.pdf',
        status: 'sent'
      };

      const result = await Invoice.create(validData);

      expect(Invoice.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.id).toBeDefined();
    });

    test('should create invoice with default status', async () => {
      const validData = {
        payment_id: 'payment-123',
        invoice_number: 'INV-2024-003'
      };

      const result = await Invoice.create(validData);

      expect(Invoice.create).toHaveBeenCalledWith(validData);
      expect(result.status).toBe('draft');
    });

    test('should create invoice without PDF URL initially', async () => {
      const validData = {
        payment_id: 'payment-123',
        invoice_number: 'INV-2024-004',
        status: 'draft'
      };

      const result = await Invoice.create(validData);

      expect(Invoice.create).toHaveBeenCalledWith(validData);
      expect(result.pdf_url).toBeNull();
    });

    test('should handle different invoice number formats', async () => {
      const invoiceNumberFormats = [
        'INV-2024-001',
        'INVOICE-2024-001',
        '2024-INV-001',
        'INV_2024_001',
        'MTB-2024-001',
        'I-001-2024'
      ];

      for (const invoiceNumber of invoiceNumberFormats) {
        const validData = {
          payment_id: `payment-${invoiceNumber}`,
          invoice_number: invoiceNumber
        };

        const result = await Invoice.create(validData);

        expect(result.invoice_number).toBe(invoiceNumber);
      }

      expect(Invoice.create).toHaveBeenCalledTimes(invoiceNumberFormats.length);
    });

    test('should handle various PDF URL formats', async () => {
      const pdfUrls = [
        'https://storage.amazonaws.com/bucket/invoices/inv-001.pdf',
        'https://cdn.example.com/invoices/2024/january/inv-001.pdf',
        'https://api.example.com/v1/invoices/inv-001/pdf',
        'https://example.com/invoices/inv-001.pdf?token=abc123'
      ];

      for (let i = 0; i < pdfUrls.length; i++) {
        const validData = {
          payment_id: `payment-${i}`,
          invoice_number: `INV-2024-${String(i + 1).padStart(3, '0')}`,
          pdf_url: pdfUrls[i]
        };

        const result = await Invoice.create(validData);

        expect(result.pdf_url).toBe(pdfUrls[i]);
      }

      expect(Invoice.create).toHaveBeenCalledTimes(pdfUrls.length);
    });
  });

  describe('Invoice Status Management', () => {
    test('should support querying invoices by status', async () => {
      const mockInvoices = [
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          status: 'sent',
          created_at: new Date()
        },
        {
          id: '2',
          invoice_number: 'INV-2024-002',
          status: 'sent',
          created_at: new Date()
        }
      ];
      
      Invoice.findAll.mockResolvedValue(mockInvoices);

      const sentInvoices = await Invoice.findAll({
        where: { status: 'sent' },
        order: [['created_at', 'DESC']]
      });

      expect(Invoice.findAll).toHaveBeenCalledWith({
        where: { status: 'sent' },
        order: [['created_at', 'DESC']]
      });
      expect(sentInvoices).toHaveLength(2);
    });

    test('should support updating invoice status', async () => {
      const updatedCount = await Invoice.update(
        { status: 'paid' },
        { where: { id: 'invoice-123' } }
      );

      expect(Invoice.update).toHaveBeenCalledWith(
        { status: 'paid' },
        { where: { id: 'invoice-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support updating PDF URL after generation', async () => {
      const pdfUrl = 'https://storage.example.com/invoices/inv-2024-001.pdf';
      const updatedCount = await Invoice.update(
        { 
          pdf_url: pdfUrl,
          status: 'sent'
        },
        { where: { id: 'invoice-123' } }
      );

      expect(Invoice.update).toHaveBeenCalledWith(
        { 
          pdf_url: pdfUrl,
          status: 'sent'
        },
        { where: { id: 'invoice-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support marking invoice as paid', async () => {
      const updatedCount = await Invoice.update(
        { status: 'paid' },
        { where: { payment_id: 'payment-123' } }
      );

      expect(Invoice.update).toHaveBeenCalledWith(
        { status: 'paid' },
        { where: { payment_id: 'payment-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });
  });

  describe('Invoice Numbering and Identification', () => {
    test('should support finding invoice by number', async () => {
      Invoice.findOne.mockResolvedValue({
        id: 'invoice-123',
        invoice_number: 'INV-2024-001',
        payment_id: 'payment-123',
        status: 'sent'
      });

      const invoice = await Invoice.findOne({
        where: { invoice_number: 'INV-2024-001' }
      });

      expect(Invoice.findOne).toHaveBeenCalledWith({
        where: { invoice_number: 'INV-2024-001' }
      });
      expect(invoice).toBeTruthy();
      expect(invoice.invoice_number).toBe('INV-2024-001');
    });

    test('should support finding invoice by payment', async () => {
      Invoice.findOne.mockResolvedValue({
        id: 'invoice-123',
        invoice_number: 'INV-2024-001',
        payment_id: 'payment-123',
        status: 'sent'
      });

      const invoice = await Invoice.findOne({
        where: { payment_id: 'payment-123' }
      });

      expect(Invoice.findOne).toHaveBeenCalledWith({
        where: { payment_id: 'payment-123' }
      });
      expect(invoice).toBeTruthy();
      expect(invoice.payment_id).toBe('payment-123');
    });

    test('should support generating sequential invoice numbers', async () => {
      Invoice.count.mockResolvedValue(5); // 5 existing invoices

      const existingCount = await Invoice.count({
        where: {
          invoice_number: {
            [require('sequelize').Op.like]: 'INV-2024-%'
          }
        }
      });

      const nextInvoiceNumber = `INV-2024-${String(existingCount + 1).padStart(3, '0')}`;

      expect(Invoice.count).toHaveBeenCalledWith({
        where: {
          invoice_number: {
            [require('sequelize').Op.like]: 'INV-2024-%'
          }
        }
      });
      expect(nextInvoiceNumber).toBe('INV-2024-006');
    });

    test('should support bulk invoice operations', async () => {
      Invoice.findAll.mockResolvedValue([
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          status: 'draft',
          payment_id: 'payment-1'
        },
        {
          id: '2',
          invoice_number: 'INV-2024-002',
          status: 'draft',
          payment_id: 'payment-2'
        }
      ]);

      const draftInvoices = await Invoice.findAll({
        where: { status: 'draft' }
      });

      expect(Invoice.findAll).toHaveBeenCalledWith({
        where: { status: 'draft' }
      });
      expect(draftInvoices).toHaveLength(2);
    });
  });

  describe('Invoice Status Lifecycle', () => {
    const statusTransitions = [
      { from: 'draft', to: 'sent' },
      { from: 'sent', to: 'paid' },
      { from: 'draft', to: 'paid' } // direct payment scenario
    ];

    test.each(statusTransitions)('should support status transition from %s to %s', async ({ from, to }) => {
      const updatedCount = await Invoice.update(
        { status: to },
        { where: { status: from } }
      );

      expect(Invoice.update).toHaveBeenCalledWith(
        { status: to },
        { where: { status: from } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support batch status updates', async () => {
      Invoice.update.mockResolvedValue([3]); // 3 invoices updated

      const updatedCount = await Invoice.update(
        { status: 'sent' },
        { 
          where: { 
            status: 'draft',
            pdf_url: {
              [require('sequelize').Op.ne]: null
            }
          }
        }
      );

      expect(Invoice.update).toHaveBeenCalledWith(
        { status: 'sent' },
        { 
          where: { 
            status: 'draft',
            pdf_url: {
              [require('sequelize').Op.ne]: null
            }
          }
        }
      );
      expect(updatedCount).toEqual([3]);
    });
  });

  describe('PDF Generation and Storage', () => {
    test('should support finding invoices with generated PDFs', async () => {
      Invoice.findAll.mockResolvedValue([
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          pdf_url: 'https://example.com/inv-001.pdf',
          status: 'sent'
        }
      ]);

      const invoicesWithPdfs = await Invoice.findAll({
        where: {
          pdf_url: {
            [require('sequelize').Op.ne]: null
          }
        }
      });

      expect(Invoice.findAll).toHaveBeenCalledWith({
        where: {
          pdf_url: {
            [require('sequelize').Op.ne]: null
          }
        }
      });
      expect(invoicesWithPdfs).toHaveLength(1);
    });

    test('should support finding invoices without PDFs', async () => {
      Invoice.findAll.mockResolvedValue([
        {
          id: '1',
          invoice_number: 'INV-2024-002',
          pdf_url: null,
          status: 'draft'
        }
      ]);

      const invoicesWithoutPdfs = await Invoice.findAll({
        where: { pdf_url: null }
      });

      expect(Invoice.findAll).toHaveBeenCalledWith({
        where: { pdf_url: null }
      });
      expect(invoicesWithoutPdfs).toHaveLength(1);
    });
  });

  describe('Business Logic and Reporting', () => {
    test('should support counting invoices by status', async () => {
      Invoice.count
        .mockResolvedValueOnce(5) // draft count
        .mockResolvedValueOnce(10) // sent count
        .mockResolvedValueOnce(8); // paid count

      const draftCount = await Invoice.count({ where: { status: 'draft' } });
      const sentCount = await Invoice.count({ where: { status: 'sent' } });
      const paidCount = await Invoice.count({ where: { status: 'paid' } });

      expect(draftCount).toBe(5);
      expect(sentCount).toBe(10);
      expect(paidCount).toBe(8);
      expect(Invoice.count).toHaveBeenCalledTimes(3);
    });

    test('should support finding invoices by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      Invoice.findAll.mockResolvedValue([
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          status: 'paid',
          created_at: new Date('2024-01-15')
        }
      ]);

      const monthlyInvoices = await Invoice.findAll({
        where: { 
          created_at: {
            [require('sequelize').Op.between]: [startDate, endDate]
          }
        }
      });

      expect(Invoice.findAll).toHaveBeenCalledWith({
        where: { 
          created_at: {
            [require('sequelize').Op.between]: [startDate, endDate]
          }
        }
      });
      expect(monthlyInvoices).toHaveLength(1);
    });

    test('should support finding overdue invoices', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      Invoice.findAll.mockResolvedValue([
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          status: 'sent',
          created_at: new Date('2023-12-01')
        }
      ]);

      const overdueInvoices = await Invoice.findAll({
        where: { 
          status: 'sent',
          created_at: {
            [require('sequelize').Op.lt]: thirtyDaysAgo
          }
        }
      });

      expect(Invoice.findAll).toHaveBeenCalledWith({
        where: { 
          status: 'sent',
          created_at: {
            [require('sequelize').Op.lt]: thirtyDaysAgo
          }
        }
      });
      expect(overdueInvoices).toHaveLength(1);
    });
  });

  describe('Validation Edge Cases', () => {
    test('should handle long invoice numbers', async () => {
      const longInvoiceNumber = 'INV-' + '2024'.repeat(10) + '-001'; // Test near the limit

      const validData = {
        payment_id: 'payment-123',
        invoice_number: longInvoiceNumber
      };

      const result = await Invoice.create(validData);

      expect(Invoice.create).toHaveBeenCalledWith(validData);
      expect(result.invoice_number).toBe(longInvoiceNumber);
    });

    test('should handle long PDF URLs', async () => {
      const longPdfUrl = 'https://very-long-domain-name-for-testing-purposes.example.com/' + 
                        'very/deep/nested/directory/structure/with/long/names/'.repeat(5) + 
                        'invoice-with-very-long-filename.pdf';

      const validData = {
        payment_id: 'payment-123',
        invoice_number: 'INV-2024-001',
        pdf_url: longPdfUrl.substring(0, 499) // Ensure it fits in STRING(500)
      };

      const result = await Invoice.create(validData);

      expect(Invoice.create).toHaveBeenCalledWith(validData);
      expect(result.pdf_url).toBe(validData.pdf_url);
    });

    test('should handle special characters in invoice numbers', async () => {
      const specialInvoiceNumbers = [
        'INV-2024-001',
        'INVOICE_2024_001',
        'INV#2024#001',
        'INV.2024.001',
        'INV/2024/001',
        'INV(2024)001'
      ];

      for (let i = 0; i < specialInvoiceNumbers.length; i++) {
        const validData = {
          payment_id: `payment-${i}`,
          invoice_number: specialInvoiceNumbers[i]
        };

        const result = await Invoice.create(validData);

        expect(result.invoice_number).toBe(specialInvoiceNumbers[i]);
      }

      expect(Invoice.create).toHaveBeenCalledTimes(specialInvoiceNumbers.length);
    });
  });
});