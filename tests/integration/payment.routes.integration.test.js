/**
 * Payment Routes Integration Tests
 * Tests for payment processing endpoints
 */

const request = require('supertest');
const { getTestApp } = require('./test-app');
const { User, Booking, Payment, PricingRule, Invoice, RefreshToken } = require('../../src/models');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const stripe = require('../../src/utils/stripe');

// Mock Stripe
jest.mock('../../src/utils/stripe');

describe('Payment Routes Integration Tests', () => {
  let app;
  let testUser;
  let authToken;
  let testBooking;
  let testPayment;
  let testPricingRule;

  beforeAll(async () => {
    // Initialize app
    app = await getTestApp();
    
    // Create test user
    testUser = await User.create({
      id: uuidv4(),
      firstName: 'Payment',
      lastName: 'Test',
      email: 'payment-test@meetabl.com',
      password: await bcrypt.hash('PaymentTest123!', 10),
      timezone: 'America/New_York',
      isActive: true,
      isEmailVerified: true
    });

    // Generate auth token
    authToken = jwt.sign(
      { 
        id: testUser.id, 
        email: testUser.email,
        type: 'access'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test booking
    testBooking = await Booking.create({
      id: uuidv4(),
      hostId: testUser.id,
      attendeeEmail: 'attendee@example.com',
      attendeeName: 'Test Attendee',
      startTime: new Date(Date.now() + 86400000), // Tomorrow
      endTime: new Date(Date.now() + 90000000), // Tomorrow + 1 hour
      title: 'Test Meeting',
      status: 'confirmed',
      duration: 60,
      location: 'Online'
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testPayment) {
      await Payment.destroy({ where: { id: testPayment.id } });
    }
    if (testPricingRule) {
      await PricingRule.destroy({ where: { id: testPricingRule.id } });
    }
    if (testBooking) {
      await Booking.destroy({ where: { id: testBooking.id } });
    }
    if (testUser) {
      await User.destroy({ where: { id: testUser.id } });
    }
  });

  describe('POST /api/payments/process', () => {
    beforeEach(() => {
      // Reset Stripe mocks
      stripe.paymentIntents.create.mockClear();
      stripe.paymentIntents.confirm.mockClear();
    });

    it('should process payment successfully', async () => {
      // Mock Stripe payment intent creation and confirmation
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation'
      });

      stripe.paymentIntents.confirm.mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        amount: 5000
      });

      const paymentData = {
        bookingId: testBooking.id,
        amount: 50.00,
        currency: 'USD',
        paymentMethodId: 'pm_test123'
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Payment processed successfully',
        data: {
          payment: expect.objectContaining({
            bookingId: testBooking.id,
            amount: 50.00,
            currency: 'USD',
            status: 'completed'
          })
        }
      });

      // Save payment for cleanup
      testPayment = await Payment.findOne({ where: { bookingId: testBooking.id } });
    });

    it('should reject payment without authentication', async () => {
      const paymentData = {
        bookingId: testBooking.id,
        amount: 50.00,
        currency: 'USD',
        paymentMethodId: 'pm_test123'
      };

      await request(app)
        .post('/api/payments/process')
        .send(paymentData)
        .expect(401);
    });

    it('should validate payment data', async () => {
      const invalidPaymentData = {
        // Missing required fields
        amount: -50 // Invalid amount
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPaymentData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Validation failed')
      });
    });
  });

  describe('GET /api/payments/history', () => {
    it('should retrieve payment history', async () => {
      // Create a test payment
      const payment = await Payment.create({
        id: uuidv4(),
        bookingId: testBooking.id,
        userId: testUser.id,
        amount: 25.00,
        currency: 'USD',
        status: 'completed',
        stripePaymentIntentId: 'pi_test_history',
        createdAt: new Date()
      });

      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          payments: expect.arrayContaining([
            expect.objectContaining({
              id: payment.id,
              amount: 25.00,
              currency: 'USD',
              status: 'completed'
            })
          ])
        }
      });

      // Clean up
      await Payment.destroy({ where: { id: payment.id } });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/payments/history?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          payments: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: expect.any(Number)
          })
        }
      });
    });
  });

  describe('POST /api/payments/refund', () => {
    beforeEach(() => {
      stripe.refunds.create.mockClear();
    });

    it('should process refund successfully', async () => {
      // Create a completed payment
      const completedPayment = await Payment.create({
        id: uuidv4(),
        bookingId: testBooking.id,
        userId: testUser.id,
        amount: 100.00,
        currency: 'USD',
        status: 'completed',
        stripePaymentIntentId: 'pi_test_refund'
      });

      // Mock Stripe refund
      stripe.refunds.create.mockResolvedValue({
        id: 're_test123',
        amount: 10000,
        status: 'succeeded'
      });

      const refundData = {
        paymentId: completedPayment.id,
        amount: 100.00,
        reason: 'requested_by_customer'
      };

      const response = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send(refundData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Refund processed successfully',
        data: {
          refund: expect.objectContaining({
            paymentId: completedPayment.id,
            amount: 100.00,
            status: 'completed'
          })
        }
      });

      // Clean up
      await Payment.destroy({ where: { id: completedPayment.id } });
    });
  });

  describe('Pricing Rules endpoints', () => {
    describe('POST /api/payments/pricing-rules', () => {
      it('should create pricing rule successfully', async () => {
        const pricingRuleData = {
          name: 'Early Bird Discount',
          type: 'percentage',
          value: 10,
          conditions: {
            advanceBookingDays: 7
          },
          isActive: true
        };

        const response = await request(app)
          .post('/api/payments/pricing-rules')
          .set('Authorization', `Bearer ${authToken}`)
          .send(pricingRuleData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Pricing rule created successfully',
          data: {
            pricingRule: expect.objectContaining({
              name: 'Early Bird Discount',
              type: 'percentage',
              value: 10,
              userId: testUser.id
            })
          }
        });

        testPricingRule = response.body.data.pricingRule;
      });
    });

    describe('GET /api/payments/pricing-rules', () => {
      it('should retrieve user pricing rules', async () => {
        const response = await request(app)
          .get('/api/payments/pricing-rules')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            pricingRules: expect.arrayContaining([
              expect.objectContaining({
                id: testPricingRule.id,
                name: 'Early Bird Discount'
              })
            ])
          }
        });
      });
    });

    describe('PUT /api/payments/pricing-rules/:id', () => {
      it('should update pricing rule', async () => {
        const updateData = {
          value: 15,
          isActive: false
        };

        const response = await request(app)
          .put(`/api/payments/pricing-rules/${testPricingRule.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Pricing rule updated successfully',
          data: {
            pricingRule: expect.objectContaining({
              id: testPricingRule.id,
              value: 15,
              isActive: false
            })
          }
        });
      });
    });

    describe('DELETE /api/payments/pricing-rules/:id', () => {
      it('should delete pricing rule', async () => {
        const response = await request(app)
          .delete(`/api/payments/pricing-rules/${testPricingRule.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Pricing rule deleted successfully'
        });

        // Verify deletion
        const deletedRule = await PricingRule.findByPk(testPricingRule.id);
        expect(deletedRule).toBeNull();
      });
    });
  });

  describe('Invoice endpoints', () => {
    let testInvoice;

    beforeAll(async () => {
      // Create test invoice
      testInvoice = await Invoice.create({
        id: uuidv4(),
        userId: testUser.id,
        bookingId: testBooking.id,
        invoiceNumber: 'INV-2024-0001',
        amount: 100.00,
        currency: 'USD',
        status: 'paid',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 604800000), // 7 days
        items: [
          {
            description: 'Consultation',
            quantity: 1,
            unitPrice: 100.00,
            total: 100.00
          }
        ]
      });
    });

    describe('GET /api/payments/invoices', () => {
      it('should retrieve user invoices', async () => {
        const response = await request(app)
          .get('/api/payments/invoices')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            invoices: expect.arrayContaining([
              expect.objectContaining({
                id: testInvoice.id,
                invoiceNumber: 'INV-2024-0001',
                amount: 100.00
              })
            ])
          }
        });
      });
    });

    describe('GET /api/payments/invoices/:id', () => {
      it('should retrieve specific invoice', async () => {
        const response = await request(app)
          .get(`/api/payments/invoices/${testInvoice.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            invoice: expect.objectContaining({
              id: testInvoice.id,
              invoiceNumber: 'INV-2024-0001',
              amount: 100.00
            })
          }
        });
      });
    });

    describe('GET /api/payments/invoices/:id/download', () => {
      it('should download invoice PDF', async () => {
        const response = await request(app)
          .get(`/api/payments/invoices/${testInvoice.id}/download`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Check response headers for PDF
        expect(response.headers['content-type']).toBe('application/pdf');
        expect(response.headers['content-disposition']).toContain('INV-2024-0001.pdf');
      });
    });

    afterAll(async () => {
      if (testInvoice) {
        await Invoice.destroy({ where: { id: testInvoice.id } });
      }
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should handle Stripe webhook events', async () => {
      // Mock Stripe webhook signature verification
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_webhook_test',
            amount: 5000,
            status: 'succeeded'
          }
        }
      };

      stripe.webhooks.constructEvent = jest.fn().mockReturnValue(mockEvent);

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(mockEvent))
        .expect(200);

      expect(response.body).toMatchObject({
        received: true
      });
    });

    it('should reject invalid webhook signatures', async () => {
      stripe.webhooks.constructEvent = jest.fn().mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'invalid_signature')
        .send({})
        .expect(400);
    });
  });
});