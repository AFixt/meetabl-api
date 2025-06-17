/**
 * Invoice controller unit tests
 *
 * Tests for invoice management functionality
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup controller mocks
setupControllerMocks();

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

// Mock models
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

// Mock storage service
jest.mock('../../../src/services/storage.service', () => ({
  uploadFile: jest.fn(),
  getSignedUrl: jest.fn(),
  deleteFile: jest.fn()
}));

// Import controller after mocks are set up
const {
  getInvoices,
  getInvoice,
  generateInvoice,
  downloadInvoice
} = require('../../../src/controllers/invoice.controller');

const { Invoice, Payment, Booking, User, AuditLog } = require('../../../src/models');
const storageService = require('../../../src/services/storage.service');

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
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        query: { limit: 20, offset: 0 }
      });
      const res = createMockResponse();

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
          invoices: mockInvoices.rows,
          pagination: {
            total: 2,
            limit: 20,
            offset: 0,
            pages: 1
          }
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
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        query: { status: 'paid' }
      });
      const res = createMockResponse();

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

    test('should handle database errors', async () => {
      // Mock database error
      Invoice.findAndCountAll.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await getInvoices(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'internal_server_error',
          message: 'Failed to get invoices'
        }
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
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = createMockResponse();

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
        invoice: mockInvoice
      });
    });

    test('should return 404 for non-existent invoice', async () => {
      // Mock invoice not found
      Invoice.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await getInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'not_found',
          message: 'Invoice not found'
        }
      });
    });

    test('should handle database errors', async () => {
      // Mock database error
      Invoice.findOne.mockRejectedValueOnce(new Error('Database error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await getInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'internal_server_error',
          message: 'Failed to get invoice'
        }
      });
    });
  });

  describe('generateInvoice', () => {
    test('should generate invoice successfully', async () => {
      // Mock payment lookup
      const mockPayment = {
        id: 'payment-id',
        user_id: 'test-user-id',
        amount: 10000,
        currency: 'USD',
        status: 'completed',
        Booking: {
          id: 'booking-id',
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          start_time: new Date('2024-01-15T10:00:00Z'),
          end_time: new Date('2024-01-15T11:00:00Z'),
          User: {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      };
      Payment.findOne.mockResolvedValueOnce(mockPayment);

      // Mock invoice creation
      const mockInvoice = {
        id: 'invoice-id',
        invoice_number: 'INV-001',
        payment_id: 'payment-id',
        amount: 10000,
        currency: 'USD',
        status: 'generated'
      };
      Invoice.create.mockResolvedValueOnce(mockInvoice);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: { payment_id: 'payment-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await generateInvoice(req, res);

      // Verify payment lookup
      expect(Payment.findOne).toHaveBeenCalledWith({
        where: { 
          id: 'payment-id',
          user_id: 'test-user-id',
          status: 'completed'
        },
        include: [{
          model: Booking,
          include: [{
            model: User,
            attributes: ['id', 'name', 'email']
          }]
        }]
      });

      // Verify invoice creation
      expect(Invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_id: 'payment-id',
          amount: 10000,
          currency: 'USD',
          status: 'generated'
        })
      );

      // Verify audit log creation
      expect(AuditLog.create).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        action: 'invoice.generated',
        entity_type: 'invoice',
        entity_id: mockInvoice.id,
        metadata: JSON.stringify({
          payment_id: 'payment-id',
          invoice_number: 'INV-001'
        })
      });

      // Verify response
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invoice generated successfully',
        invoice: mockInvoice
      });
    });

    test('should return 404 for non-existent payment', async () => {
      // Mock payment not found
      Payment.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: { payment_id: 'non-existent-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await generateInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'not_found',
          message: 'Payment not found or not eligible for invoice'
        }
      });
    });

    test('should handle invoice generation errors', async () => {
      // Mock payment lookup
      Payment.findOne.mockResolvedValueOnce({
        id: 'payment-id',
        user_id: 'test-user-id',
        status: 'completed',
        Booking: { User: { id: 'test-user-id' } }
      });

      // Mock invoice creation error
      Invoice.create.mockRejectedValueOnce(new Error('Invoice generation failed'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        body: { payment_id: 'payment-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await generateInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'internal_server_error',
          message: 'Failed to generate invoice'
        }
      });
    });
  });

  describe('downloadInvoice', () => {
    test('should download invoice successfully', async () => {
      // Mock invoice lookup
      const mockInvoice = {
        id: 'invoice-id',
        invoice_number: 'INV-001',
        file_url: 's3://bucket/invoices/INV-001.pdf',
        Payment: {
          user_id: 'test-user-id'
        }
      };
      Invoice.findOne.mockResolvedValueOnce(mockInvoice);

      // Mock signed URL generation
      const signedUrl = 'https://s3.amazonaws.com/bucket/invoices/INV-001.pdf?signature=xyz';
      storageService.getSignedUrl.mockResolvedValueOnce(signedUrl);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await downloadInvoice(req, res);

      // Verify invoice lookup
      expect(Invoice.findOne).toHaveBeenCalledWith({
        where: { id: 'invoice-id' },
        include: [{
          model: Payment,
          required: true,
          where: { user_id: 'test-user-id' },
          attributes: ['user_id']
        }]
      });

      // Verify signed URL generation
      expect(storageService.getSignedUrl).toHaveBeenCalledWith('invoices/INV-001.pdf', 3600);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Download URL generated successfully',
        download_url: signedUrl,
        expires_in: 3600
      });
    });

    test('should return 404 for non-existent invoice', async () => {
      // Mock invoice not found
      Invoice.findOne.mockResolvedValueOnce(null);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await downloadInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'not_found',
          message: 'Invoice not found'
        }
      });
    });

    test('should handle file not found', async () => {
      // Mock invoice without file
      const mockInvoice = {
        id: 'invoice-id',
        file_url: null,
        Payment: { user_id: 'test-user-id' }
      };
      Invoice.findOne.mockResolvedValueOnce(mockInvoice);

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await downloadInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'not_found',
          message: 'Invoice file not found'
        }
      });
    });

    test('should handle storage service errors', async () => {
      // Mock invoice lookup
      const mockInvoice = {
        id: 'invoice-id',
        invoice_number: 'INV-001',
        file_url: 's3://bucket/invoices/INV-001.pdf',
        Payment: { user_id: 'test-user-id' }
      };
      Invoice.findOne.mockResolvedValueOnce(mockInvoice);

      // Mock storage service error
      storageService.getSignedUrl.mockRejectedValueOnce(new Error('Storage error'));

      // Create request
      const req = createMockRequest({
        user: { id: 'test-user-id' },
        params: { id: 'invoice-id' }
      });
      const res = createMockResponse();

      // Execute controller
      await downloadInvoice(req, res);

      // Verify response
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'internal_server_error',
          message: 'Failed to generate download URL'
        }
      });
    });
  });
});