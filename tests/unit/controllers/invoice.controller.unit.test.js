/**
 * Invoice controller unit tests
 *
 * Tests for invoice management functionality
 *
 * @author meetabl Team
 */

// Mock dependencies before imports
jest.mock('../../../src/config/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../src/models', () => ({
  Invoice: {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  Payment: {
    findOne: jest.fn()
  },
  Booking: {
    findOne: jest.fn()
  },
  User: {
    findOne: jest.fn()
  },
  AuditLog: {
    create: jest.fn()
  }
}));

jest.mock('../../../src/config/database', () => ({
  Op: {
    gt: Symbol('gt'),
    gte: Symbol('gte'),
    lt: Symbol('lt'),
    lte: Symbol('lte'),
    eq: Symbol('eq'),
    ne: Symbol('ne'),
    in: Symbol('in'),
    notIn: Symbol('notIn'),
    between: Symbol('between'),
    notBetween: Symbol('notBetween'),
    or: Symbol('or'),
    and: Symbol('and')
  }
}));

jest.mock('../../../src/services/storage.service', () => ({
  uploadFile: jest.fn(),
  getPresignedUrl: jest.fn(),
  deleteFile: jest.fn()
}));

// Import controller after mocks are set up
const {
  getInvoices,
  getInvoice,
  downloadInvoice,
  generateInvoicePDF
} = require('../../../src/controllers/invoice.controller');

const { Invoice, Payment, Booking, User, AuditLog } = require('../../../src/models');
const { Op } = require('../../../src/config/database');
const storageService = require('../../../src/services/storage.service');

// Ensure test utilities are available
if (typeof global.createMockRequest !== 'function'
    || typeof global.createMockResponse !== 'function') {
  global.createMockRequest = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: 'test-user-id' },
    ...overrides
  });

  global.createMockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res;
  };
}

describe('Invoice Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInvoices', () => {
    test('should get invoices successfully', async () => {
      // Mock invoices data
      const mockInvoices = {
        count: 2,
        rows: [
          {
            id: 'invoice-1',
            invoice_number: 'INV-001',
            status: 'paid',
            amount: 10000,
            Payment: {
              id: 'payment-1',
              amount: 10000,
              currency: 'USD',
              Booking: {
                id: 'booking-1',
                customer_name: 'John Doe',
                User: { id: 'test-user-id', name: 'Test User' }
              }
            }
          },
          {
            id: 'invoice-2',
            invoice_number: 'INV-002',
            status: 'pending',
            amount: 5000,
            Payment: {
              id: 'payment-2',
              amount: 5000,
              currency: 'USD',
              Booking: {
                id: 'booking-2',
                customer_name: 'Jane Smith',
                User: { id: 'test-user-id', name: 'Test User' }
              }
            }
          }
        ]
      };
      Invoice.findAndCountAll.mockResolvedValueOnce(mockInvoices);

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        query: { limit: '20', offset: '0' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await getInvoices(req, res);

      // Verify model was called with correct parameters
      expect(Invoice.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        include: [{
          model: Payment,
          required: true,
          where: { user_id: 'test-user-id' },
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
        limit: 20,
        offset: 0
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invoices retrieved successfully',
        data: {
          total: 2,
          invoices: mockInvoices.rows,
          limit: 20,
          offset: 0
        }
      });
    });

    test('should filter invoices by status', async () => {
      // Mock filtered invoices
      const mockInvoices = {
        count: 1,
        rows: [
          {
            id: 'invoice-1',
            status: 'paid',
            Payment: { Booking: { User: { id: 'test-user-id' } } }
          }
        ]
      };
      Invoice.findAndCountAll.mockResolvedValueOnce(mockInvoices);

      // Create request with status filter
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        query: { status: 'paid', limit: '20', offset: '0' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await getInvoices(req, res);

      // Verify filter was applied
      expect(Invoice.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'paid' }
        })
      );

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should use default pagination values', async () => {
      // Mock invoices
      const mockInvoices = { count: 0, rows: [] };
      Invoice.findAndCountAll.mockResolvedValueOnce(mockInvoices);

      // Create request without pagination params
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        query: {}
      });
      const res = global.createMockResponse();

      // Execute controller
      await getInvoices(req, res);

      // Verify default values were used
      expect(Invoice.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 0
        })
      );
    });

    test('should handle database errors', async () => {
      // Mock database error
      Invoice.findAndCountAll.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await getInvoices(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve invoices',
        message: 'Database error'
      });
    });
  });

  describe('getInvoice', () => {
    test('should get invoice by ID successfully', async () => {
      // Mock invoice data
      const mockInvoice = {
        id: 'invoice-id',
        invoice_number: 'INV-001',
        status: 'paid',
        amount: 10000,
        Payment: {
          id: 'payment-id',
          user_id: 'test-user-id',
          Booking: {
            id: 'booking-id',
            customer_name: 'John Doe',
            User: { id: 'test-user-id', name: 'Test User' }
          }
        }
      };
      Invoice.findOne.mockResolvedValueOnce(mockInvoice);

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await getInvoice(req, res);

      // Verify model was called
      expect(Invoice.findOne).toHaveBeenCalledWith({
        where: { id: 'invoice-id' },
        include: [{
          model: Payment,
          required: true,
          where: { user_id: 'test-user-id' },
          include: [{
            model: Booking,
            include: [{
              model: User,
              attributes: ['id', 'name', 'email']
            }]
          }]
        }]
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invoice retrieved successfully',
        data: mockInvoice
      });
    });

    test('should return 404 for non-existent invoice', async () => {
      // Mock invoice not found
      Invoice.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await getInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invoice not found'
      });
    });

    test('should handle database errors', async () => {
      // Mock database error
      Invoice.findOne.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await getInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve invoice',
        message: 'Database error'
      });
    });
  });

  describe('downloadInvoice', () => {
    test('should download invoice successfully', async () => {
      // Mock invoice lookup
      const mockInvoice = {
        id: 'invoice-id',
        invoice_number: 'INV-001',
        pdf_url: 'invoices/INV-001.pdf',
        Payment: {
          user_id: 'test-user-id'
        }
      };
      Invoice.findOne.mockResolvedValueOnce(mockInvoice);

      // Mock presigned URL generation
      const downloadUrl = 'https://s3.amazonaws.com/bucket/invoices/INV-001.pdf?signature=xyz';
      storageService.getPresignedUrl.mockResolvedValueOnce(downloadUrl);

      // Mock audit log creation
      AuditLog.create.mockResolvedValueOnce({ id: 'audit-id' });

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await downloadInvoice(req, res);

      // Verify invoice lookup
      expect(Invoice.findOne).toHaveBeenCalledWith({
        where: { id: 'invoice-id' },
        include: [{
          model: Payment,
          required: true,
          where: { user_id: 'test-user-id' }
        }]
      });

      // Verify presigned URL generation
      expect(storageService.getPresignedUrl).toHaveBeenCalledWith('invoices/INV-001.pdf', {
        expiresIn: 300,
        responseContentDisposition: 'attachment; filename="invoice-INV-001.pdf"'
      });

      // Verify audit log creation
      expect(AuditLog.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        action: 'invoice_downloaded',
        entity_type: 'invoice',
        entity_id: 'invoice-id',
        metadata: JSON.stringify({
          invoice_number: 'INV-001'
        })
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invoice download URL generated successfully',
        data: {
          download_url: downloadUrl,
          expires_in: 300
        }
      });
    });

    test('should return 404 for non-existent invoice', async () => {
      // Mock invoice not found
      Invoice.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await downloadInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invoice not found'
      });
    });

    test('should return 404 when PDF URL is not available', async () => {
      // Mock invoice without PDF URL
      const mockInvoice = {
        id: 'invoice-id',
        invoice_number: 'INV-001',
        pdf_url: null,
        Payment: { user_id: 'test-user-id' }
      };
      Invoice.findOne.mockResolvedValueOnce(mockInvoice);

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await downloadInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invoice PDF not available'
      });
    });

    test('should handle storage service errors', async () => {
      // Mock invoice lookup
      const mockInvoice = {
        id: 'invoice-id',
        invoice_number: 'INV-001',
        pdf_url: 'invoices/INV-001.pdf',
        Payment: { user_id: 'test-user-id' }
      };
      Invoice.findOne.mockResolvedValueOnce(mockInvoice);

      // Mock storage service error
      storageService.getPresignedUrl.mockRejectedValueOnce(new Error('Storage error'));

      // Create request
      const req = global.createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = global.createMockResponse();

      // Execute controller
      await downloadInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to generate invoice download URL',
        message: 'Storage error'
      });
    });
  });

  describe('generateInvoicePDF', () => {
    test('should handle PDF generation (placeholder)', async () => {
      // Mock invoice data
      const invoiceData = {
        invoice_number: 'INV-001',
        amount: 10000,
        currency: 'USD'
      };

      // Execute function
      const result = await generateInvoicePDF(invoiceData);

      // Verify placeholder behavior
      expect(result).toBeNull();
    });

    test('should handle PDF generation errors', async () => {
      // Mock invoice data that would cause an error
      const invoiceData = null;

      try {
        await generateInvoicePDF(invoiceData);
      } catch (error) {
        // Current implementation does throw with null data
        expect(error).toBeDefined();
        expect(error).toBeInstanceOf(TypeError);
      }
    });
  });
});