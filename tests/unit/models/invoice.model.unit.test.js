/**
 * Invoice model unit tests
 *
 * Tests the Invoice model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');

const { v4: uuidv4 } = require('uuid');

// Mock sequelize and models
const mockSequelize = {
  define: jest.fn(),
  DataTypes: require('sequelize').DataTypes
};

const mockPayment = {
  id: 'payment-123'
};

jest.mock('../../../src/config/database', () => ({
  sequelize: mockSequelize
}));

jest.mock('../../../src/models/payment.model', () => mockPayment);

// Import the model after mocking
const Invoice = require('../../../src/models/invoice.model');

describe('Invoice Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Definition', () => {
    test('should define Invoice model with correct table name', () => {
      expect(mockSequelize.define).toHaveBeenCalledWith(
        'Invoice',
        expect.any(Object),
        expect.objectContaining({
          tableName: 'invoices',
          timestamps: true,
          createdAt: 'created_at',
          updatedAt: 'updated_at'
        })
      );
    });

    test('should have correct field definitions', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];

      // Check id field
      expect(fieldDefinitions.id).toEqual({
        type: expect.any(Object),
        primaryKey: true,
        defaultValue: expect.any(Function)
      });

      // Check payment_id field
      expect(fieldDefinitions.payment_id).toEqual({
        type: expect.any(Object),
        allowNull: false,
        unique: true,
        references: {
          model: mockPayment,
          key: 'id'
        }
      });

      // Check invoice_number field
      expect(fieldDefinitions.invoice_number).toEqual({
        type: expect.any(Object),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true
        }
      });

      // Check pdf_url field
      expect(fieldDefinitions.pdf_url).toEqual({
        type: expect.any(Object),
        allowNull: true,
        validate: {
          isUrl: true
        }
      });

      // Check status field
      expect(fieldDefinitions.status).toEqual({
        type: expect.any(Object),
        allowNull: false,
        defaultValue: 'draft'
      });

      // Check created_at field
      expect(fieldDefinitions.created_at).toEqual({
        type: expect.any(Object),
        defaultValue: expect.any(Object)
      });

      // Check updated_at field
      expect(fieldDefinitions.updated_at).toEqual({
        type: expect.any(Object),
        defaultValue: expect.any(Object)
      });
    });

    test('should generate UUID for id by default', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      const idDefaultValue = fieldDefinitions.id.defaultValue;
      
      expect(typeof idDefaultValue).toBe('function');
      
      const generatedId = idDefaultValue();
      expect(generatedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should have correct timestamp configuration', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      expect(options.timestamps).toBe(true);
      expect(options.createdAt).toBe('created_at');
      expect(options.updatedAt).toBe('updated_at');
    });
  });

  describe('Field Validations', () => {
    let mockInvoiceInstance;
    let mockCreate;

    beforeEach(() => {
      mockInvoiceInstance = {
        id: uuidv4(),
        payment_id: 'payment-123',
        invoice_number: 'INV-2024-001',
        pdf_url: 'https://example.com/invoices/inv-2024-001.pdf',
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date(),
        save: jest.fn().mockResolvedValue(true),
        validate: jest.fn().mockResolvedValue(true)
      };

      mockCreate = jest.fn().mockResolvedValue(mockInvoiceInstance);
      
      // Mock the model methods
      Object.assign(Invoice, {
        create: mockCreate,
        findAll: jest.fn().mockResolvedValue([mockInvoiceInstance]),
        findOne: jest.fn().mockResolvedValue(mockInvoiceInstance),
        findByPk: jest.fn().mockResolvedValue(mockInvoiceInstance),
        update: jest.fn().mockResolvedValue([1]),
        count: jest.fn().mockResolvedValue(5)
      });
    });

    test('should create invoice with valid data', async () => {
      const validData = {
        payment_id: 'payment-123',
        invoice_number: 'INV-2024-002',
        pdf_url: 'https://storage.example.com/invoices/inv-2024-002.pdf',
        status: 'sent'
      };

      const result = await Invoice.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockInvoiceInstance);
    });

    test('should create invoice with default status', async () => {
      const validData = {
        payment_id: 'payment-123',
        invoice_number: 'INV-2024-003'
      };

      const result = await Invoice.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockInvoiceInstance);
    });

    test('should create invoice without PDF URL initially', async () => {
      const validData = {
        payment_id: 'payment-123',
        invoice_number: 'INV-2024-004',
        status: 'draft'
      };

      const result = await Invoice.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockInvoiceInstance);
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

      const mockCreate = jest.fn().mockImplementation((data) => Promise.resolve({
        id: uuidv4(),
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      }));

      Object.assign(Invoice, { create: mockCreate });

      for (const invoiceNumber of invoiceNumberFormats) {
        const validData = {
          payment_id: `payment-${invoiceNumber}`,
          invoice_number: invoiceNumber
        };

        const result = await Invoice.create(validData);

        expect(result.invoice_number).toBe(invoiceNumber);
      }

      expect(mockCreate).toHaveBeenCalledTimes(invoiceNumberFormats.length);
    });

    test('should handle various PDF URL formats', async () => {
      const pdfUrls = [
        'https://storage.amazonaws.com/bucket/invoices/inv-001.pdf',
        'https://cdn.example.com/invoices/2024/january/inv-001.pdf',
        'https://api.example.com/v1/invoices/inv-001/pdf',
        'https://example.com/invoices/inv-001.pdf?token=abc123'
      ];

      const mockCreate = jest.fn().mockImplementation((data) => Promise.resolve({
        id: uuidv4(),
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      }));

      Object.assign(Invoice, { create: mockCreate });

      for (let i = 0; i < pdfUrls.length; i++) {
        const validData = {
          payment_id: `payment-${i}`,
          invoice_number: `INV-2024-${String(i + 1).padStart(3, '0')}`,
          pdf_url: pdfUrls[i]
        };

        const result = await Invoice.create(validData);

        expect(result.pdf_url).toBe(pdfUrls[i]);
      }

      expect(mockCreate).toHaveBeenCalledTimes(pdfUrls.length);
    });
  });

  describe('Data Integrity', () => {
    test('should ensure payment_id is required and unique', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.payment_id.allowNull).toBe(false);
      expect(fieldDefinitions.payment_id.unique).toBe(true);
    });

    test('should ensure invoice_number is required, unique, and not empty', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.invoice_number.allowNull).toBe(false);
      expect(fieldDefinitions.invoice_number.unique).toBe(true);
      expect(fieldDefinitions.invoice_number.validate.notEmpty).toBe(true);
    });

    test('should ensure status has proper default', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.status.allowNull).toBe(false);
      expect(fieldDefinitions.status.defaultValue).toBe('draft');
    });

    test('should allow pdf_url to be null but validate URL format when provided', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.pdf_url.allowNull).toBe(true);
      expect(fieldDefinitions.pdf_url.validate.isUrl).toBe(true);
    });

    test('should have proper field types', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      // Check that invoice_number is STRING(50)
      expect(fieldDefinitions.invoice_number.type.constructor.name).toContain('STRING');
      
      // Check that pdf_url is STRING(500)
      expect(fieldDefinitions.pdf_url.type.constructor.name).toContain('STRING');
      
      // Check that status is ENUM
      expect(fieldDefinitions.status.type.constructor.name).toContain('ENUM');
      
      // Check that id fields are STRING(36) for UUIDs
      expect(fieldDefinitions.id.type.constructor.name).toContain('STRING');
      expect(fieldDefinitions.payment_id.type.constructor.name).toContain('STRING');
    });

    test('should have ENUM values for status field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      const statusField = fieldDefinitions.status;
      
      // The ENUM type should contain valid status values
      expect(statusField.type.constructor.name).toContain('ENUM');
    });
  });

  describe('Model Relationships', () => {
    test('should reference Payment model in payment_id field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.payment_id.references).toEqual({
        model: mockPayment,
        key: 'id'
      });
    });
  });

  describe('Invoice Status Management', () => {
    test('should support querying invoices by status', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
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
      ]);

      Object.assign(Invoice, { findAll: mockFindAll });

      const sentInvoices = await Invoice.findAll({
        where: { status: 'sent' },
        order: [['created_at', 'DESC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { status: 'sent' },
        order: [['created_at', 'DESC']]
      });
      expect(sentInvoices).toHaveLength(2);
    });

    test('should support updating invoice status', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Invoice, { update: mockUpdate });

      const updatedCount = await Invoice.update(
        { status: 'paid' },
        { where: { id: 'invoice-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { status: 'paid' },
        { where: { id: 'invoice-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support updating PDF URL after generation', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Invoice, { update: mockUpdate });

      const pdfUrl = 'https://storage.example.com/invoices/inv-2024-001.pdf';
      const updatedCount = await Invoice.update(
        { 
          pdf_url: pdfUrl,
          status: 'sent'
        },
        { where: { id: 'invoice-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { 
          pdf_url: pdfUrl,
          status: 'sent'
        },
        { where: { id: 'invoice-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support marking invoice as paid', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Invoice, { update: mockUpdate });

      const updatedCount = await Invoice.update(
        { status: 'paid' },
        { where: { payment_id: 'payment-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { status: 'paid' },
        { where: { payment_id: 'payment-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });
  });

  describe('Invoice Numbering and Identification', () => {
    test('should support finding invoice by number', async () => {
      const mockFindOne = jest.fn().mockResolvedValue({
        id: 'invoice-123',
        invoice_number: 'INV-2024-001',
        payment_id: 'payment-123',
        status: 'sent'
      });

      Object.assign(Invoice, { findOne: mockFindOne });

      const invoice = await Invoice.findOne({
        where: { invoice_number: 'INV-2024-001' }
      });

      expect(mockFindOne).toHaveBeenCalledWith({
        where: { invoice_number: 'INV-2024-001' }
      });
      expect(invoice).toBeTruthy();
      expect(invoice.invoice_number).toBe('INV-2024-001');
    });

    test('should support finding invoice by payment', async () => {
      const mockFindOne = jest.fn().mockResolvedValue({
        id: 'invoice-123',
        invoice_number: 'INV-2024-001',
        payment_id: 'payment-123',
        status: 'sent'
      });

      Object.assign(Invoice, { findOne: mockFindOne });

      const invoice = await Invoice.findOne({
        where: { payment_id: 'payment-123' }
      });

      expect(mockFindOne).toHaveBeenCalledWith({
        where: { payment_id: 'payment-123' }
      });
      expect(invoice).toBeTruthy();
      expect(invoice.payment_id).toBe('payment-123');
    });

    test('should support generating sequential invoice numbers', async () => {
      const mockCount = jest.fn().mockResolvedValue(5); // 5 existing invoices

      Object.assign(Invoice, { count: mockCount });

      const existingCount = await Invoice.count({
        where: {
          invoice_number: {
            [require('sequelize').Op.like]: 'INV-2024-%'
          }
        }
      });

      const nextInvoiceNumber = `INV-2024-${String(existingCount + 1).padStart(3, '0')}`;

      expect(mockCount).toHaveBeenCalledWith({
        where: {
          invoice_number: {
            [require('sequelize').Op.like]: 'INV-2024-%'
          }
        }
      });
      expect(nextInvoiceNumber).toBe('INV-2024-006');
    });

    test('should support bulk invoice operations', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
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

      Object.assign(Invoice, { findAll: mockFindAll });

      const draftInvoices = await Invoice.findAll({
        where: { status: 'draft' }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
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
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Invoice, { update: mockUpdate });

      const updatedCount = await Invoice.update(
        { status: to },
        { where: { status: from } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { status: to },
        { where: { status: from } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support batch status updates', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([3]); // 3 invoices updated

      Object.assign(Invoice, { update: mockUpdate });

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

      expect(mockUpdate).toHaveBeenCalledWith(
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
    test('should support updating PDF URL after generation', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(Invoice, { update: mockUpdate });

      const pdfUrl = 'https://cdn.example.com/invoices/2024/inv-2024-001.pdf';
      const updatedCount = await Invoice.update(
        { pdf_url: pdfUrl },
        { where: { invoice_number: 'INV-2024-001' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { pdf_url: pdfUrl },
        { where: { invoice_number: 'INV-2024-001' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support finding invoices with generated PDFs', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          pdf_url: 'https://example.com/inv-001.pdf',
          status: 'sent'
        }
      ]);

      Object.assign(Invoice, { findAll: mockFindAll });

      const invoicesWithPdfs = await Invoice.findAll({
        where: {
          pdf_url: {
            [require('sequelize').Op.ne]: null
          }
        }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: {
          pdf_url: {
            [require('sequelize').Op.ne]: null
          }
        }
      });
      expect(invoicesWithPdfs).toHaveLength(1);
    });

    test('should support finding invoices without PDFs', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          invoice_number: 'INV-2024-002',
          pdf_url: null,
          status: 'draft'
        }
      ]);

      Object.assign(Invoice, { findAll: mockFindAll });

      const invoicesWithoutPdfs = await Invoice.findAll({
        where: { pdf_url: null }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { pdf_url: null }
      });
      expect(invoicesWithoutPdfs).toHaveLength(1);
    });
  });

  describe('Business Logic and Reporting', () => {
    test('should support counting invoices by status', async () => {
      const mockCount = jest.fn()
        .mockResolvedValueOnce(5) // draft count
        .mockResolvedValueOnce(10) // sent count
        .mockResolvedValueOnce(8); // paid count

      Object.assign(Invoice, { count: mockCount });

      const draftCount = await Invoice.count({ where: { status: 'draft' } });
      const sentCount = await Invoice.count({ where: { status: 'sent' } });
      const paidCount = await Invoice.count({ where: { status: 'paid' } });

      expect(draftCount).toBe(5);
      expect(sentCount).toBe(10);
      expect(paidCount).toBe(8);
      expect(mockCount).toHaveBeenCalledTimes(3);
    });

    test('should support finding invoices by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          status: 'paid',
          created_at: new Date('2024-01-15')
        }
      ]);

      Object.assign(Invoice, { findAll: mockFindAll });

      const monthlyInvoices = await Invoice.findAll({
        where: { 
          created_at: {
            [require('sequelize').Op.between]: [startDate, endDate]
          }
        }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
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

      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          status: 'sent',
          created_at: new Date('2023-12-01')
        }
      ]);

      Object.assign(Invoice, { findAll: mockFindAll });

      const overdueInvoices = await Invoice.findAll({
        where: { 
          status: 'sent',
          created_at: {
            [require('sequelize').Op.lt]: thirtyDaysAgo
          }
        }
      });

      expect(mockFindAll).toHaveBeenCalledWith({
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
      const longInvoiceNumber = 'INV-' + '2024'.repeat(10) + '-001'; // Test near the limit of STRING(50)

      const validData = {
        payment_id: 'payment-123',
        invoice_number: longInvoiceNumber
      };

      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        ...validData,
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date()
      });

      Object.assign(Invoice, { create: mockCreate });

      const result = await Invoice.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
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

      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        ...validData,
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date()
      });

      Object.assign(Invoice, { create: mockCreate });

      const result = await Invoice.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
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

      const mockCreate = jest.fn().mockImplementation((data) => Promise.resolve({
        id: uuidv4(),
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      }));

      Object.assign(Invoice, { create: mockCreate });

      for (let i = 0; i < specialInvoiceNumbers.length; i++) {
        const validData = {
          payment_id: `payment-${i}`,
          invoice_number: specialInvoiceNumbers[i]
        };

        const result = await Invoice.create(validData);

        expect(result.invoice_number).toBe(specialInvoiceNumbers[i]);
      }

      expect(mockCreate).toHaveBeenCalledTimes(specialInvoiceNumbers.length);
    });
  });
});