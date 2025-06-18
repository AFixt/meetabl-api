/**
 * Payment and Booking Workflow Integration Test
 *
 * Tests the complete payment processing flow for paid bookings
 *
 * @author meetabl Team
 */

const { request, utils, models } = require('../setup');
const app = require('../../../src/app');

// Mock Stripe
const mockStripeInstance = {
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'pi_test123',
      client_secret: 'pi_test123_secret',
      amount: 5000,
      currency: 'usd',
      status: 'requires_payment_method'
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'pi_test123',
      status: 'succeeded',
      amount: 5000,
      currency: 'usd',
      charges: {
        data: [{
          id: 'ch_test123',
          receipt_url: 'https://receipt.stripe.com/test123'
        }]
      }
    }),
    confirm: jest.fn().mockResolvedValue({
      id: 'pi_test123',
      status: 'succeeded'
    })
  },
  refunds: {
    create: jest.fn().mockResolvedValue({
      id: 'refund_test123',
      amount: 5000,
      status: 'succeeded'
    })
  },
  webhookEndpoints: {
    create: jest.fn().mockResolvedValue({
      id: 'we_test123',
      url: 'https://api.meetabl.com/webhooks/stripe',
      enabled_events: ['payment_intent.succeeded']
    })
  }
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

describe('Payment and Booking Workflow', () => {
  let consultant, client;
  let consultantTokens, clientTokens;
  let pricingRule;

  beforeAll(async () => {
    await utils.resetDatabase();

    // Create consultant user
    consultant = await utils.createTestUser({
      firstName: 'Expert',
      lastName: 'Consultant',
      email: 'consultant@example.com',
      username: 'expertconsultant',
      stripeAccountId: 'acct_test123'
    });

    // Create client user
    client = await utils.createTestUser({
      firstName: 'Business',
      lastName: 'Client',
      email: 'client@business.com',
      username: 'businessclient'
    });

    consultantTokens = utils.generateAuthTokens(consultant);
    clientTokens = utils.generateAuthTokens(client);
  });

  afterAll(async () => {
    await utils.cleanup();
  });

  describe('Paid consultation workflow', () => {
    test('Step 1: Consultant sets up pricing rules', async () => {
      const pricingData = {
        name: 'Standard Consultation',
        description: '1-hour business consultation',
        price: 150.00,
        currency: 'USD',
        duration: 60,
        isActive: true
      };

      const response = await request(app)
        .post('/api/pricing-rules')
        .set('Authorization', `Bearer ${consultantTokens.accessToken}`)
        .send(pricingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.price).toBe(150.00);
      expect(response.body.data.userId).toBe(consultant.id);
      pricingRule = response.body.data;
    });

    test('Step 2: Client views consultant pricing', async () => {
      const response = await request(app)
        .get(`/api/pricing-rules/public/${consultant.username}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pricingRules).toHaveLength(1);
      expect(response.body.data.pricingRules[0].id).toBe(pricingRule.id);
      expect(response.body.data.pricingRules[0].price).toBe(150.00);
    });

    test('Step 3: Client initiates paid booking', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);

      const bookingData = {
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
        title: 'Business Strategy Consultation',
        description: 'Discuss Q4 business strategy',
        attendeeName: `${client.firstName} ${client.lastName}`,
        attendeeEmail: client.email,
        attendeePhoneNumber: client.phoneNumber,
        location: 'Video Call',
        pricingRuleId: pricingRule.id,
        paymentRequired: true
      };

      const response = await request(app)
        .post(`/api/bookings/public/${consultant.username}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending_payment');
      expect(response.body.data.totalAmount).toBe(150.00);
      expect(response.body.data.paymentIntentId).toBe('pi_test123');
      expect(response.body.data.paymentClientSecret).toBe('pi_test123_secret');
    });

    test('Step 4: Process payment', async () => {
      // Get the pending booking
      const pendingBooking = await models.Booking.findOne({
        where: {
          userId: consultant.id,
          attendeeEmail: client.email,
          status: 'pending_payment'
        }
      });

      const response = await request(app)
        .post('/api/payments/process')
        .send({
          paymentIntentId: 'pi_test123',
          bookingId: pendingBooking.id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('succeeded');
      expect(response.body.data.bookingStatus).toBe('confirmed');

      // Verify booking is confirmed
      const confirmedBooking = await models.Booking.findByPk(pendingBooking.id);
      expect(confirmedBooking.status).toBe('confirmed');
      expect(confirmedBooking.isPaid).toBe(true);
    });

    test('Step 5: Consultant views revenue analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/revenue')
        .set('Authorization', `Bearer ${consultantTokens.accessToken}`)
        .query({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBe(150.00);
      expect(response.body.data.bookingCount).toBe(1);
      expect(response.body.data.averageBookingValue).toBe(150.00);
    });

    test('Step 6: Generate invoice', async () => {
      const booking = await models.Booking.findOne({
        where: {
          userId: consultant.id,
          attendeeEmail: client.email,
          isPaid: true
        }
      });

      const response = await request(app)
        .get(`/api/invoices/${booking.id}`)
        .set('Authorization', `Bearer ${consultantTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.id).toBe(booking.id);
      expect(response.body.data.amount).toBe(150.00);
      expect(response.body.data.consultant.email).toBe(consultant.email);
      expect(response.body.data.client.email).toBe(client.email);
    });

    test('Step 7: Handle booking cancellation with refund', async () => {
      const booking = await models.Booking.findOne({
        where: {
          userId: consultant.id,
          attendeeEmail: client.email,
          isPaid: true,
          status: 'confirmed'
        }
      });

      const response = await request(app)
        .delete(`/api/bookings/my/${booking.id}`)
        .set('Authorization', `Bearer ${consultantTokens.accessToken}`)
        .send({
          reason: 'Schedule conflict',
          issueRefund: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled');
      expect(response.body.data.refundStatus).toBe('succeeded');
      expect(response.body.data.refundAmount).toBe(150.00);

      // Verify booking is cancelled
      const cancelledBooking = await models.Booking.findByPk(booking.id);
      expect(cancelledBooking.status).toBe('cancelled');
      expect(cancelledBooking.refundId).toBe('refund_test123');
    });
  });

  describe('Multiple pricing tiers', () => {
    test('Create different pricing tiers', async () => {
      // Quick consultation
      const quickConsult = await request(app)
        .post('/api/pricing-rules')
        .set('Authorization', `Bearer ${consultantTokens.accessToken}`)
        .send({
          name: 'Quick Check-in',
          description: '30-minute consultation',
          price: 75.00,
          currency: 'USD',
          duration: 30,
          isActive: true
        })
        .expect(201);

      // Premium consultation
      const premiumConsult = await request(app)
        .post('/api/pricing-rules')
        .set('Authorization', `Bearer ${consultantTokens.accessToken}`)
        .send({
          name: 'Premium Strategy Session',
          description: '2-hour deep dive consultation',
          price: 350.00,
          currency: 'USD',
          duration: 120,
          isActive: true
        })
        .expect(201);

      expect(quickConsult.body.data.price).toBe(75.00);
      expect(premiumConsult.body.data.price).toBe(350.00);
    });

    test('Client selects appropriate pricing tier', async () => {
      const response = await request(app)
        .get(`/api/pricing-rules/public/${consultant.username}`)
        .expect(200);

      expect(response.body.data.pricingRules).toHaveLength(3);
      
      const prices = response.body.data.pricingRules.map(r => r.price);
      expect(prices).toContain(75.00);
      expect(prices).toContain(150.00);
      expect(prices).toContain(350.00);
    });
  });

  describe('Webhook handling', () => {
    test('Handle Stripe webhook for successful payment', async () => {
      // Create a pending payment booking
      const pendingBooking = await utils.createTestBooking(consultant.id, {
        status: 'pending_payment',
        paymentIntentId: 'pi_webhook_test',
        attendeeEmail: 'webhook@test.com',
        totalAmount: 150.00
      });

      // Simulate Stripe webhook
      const webhookPayload = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_webhook_test',
            amount: 15000, // Stripe uses cents
            currency: 'usd',
            status: 'succeeded'
          }
        }
      };

      // Mock Stripe webhook signature verification
      const stripe = require('stripe')();
      stripe.webhooks = {
        constructEvent: jest.fn().mockReturnValue(webhookPayload)
      };

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'mock-signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.received).toBe(true);

      // Verify booking was confirmed
      const confirmedBooking = await models.Booking.findByPk(pendingBooking.id);
      expect(confirmedBooking.status).toBe('confirmed');
      expect(confirmedBooking.isPaid).toBe(true);
    });

    test('Handle failed payment webhook', async () => {
      const pendingBooking = await utils.createTestBooking(consultant.id, {
        status: 'pending_payment',
        paymentIntentId: 'pi_failed_test',
        attendeeEmail: 'failed@test.com',
        totalAmount: 150.00
      });

      const webhookPayload = {
        id: 'evt_test456',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_failed_test',
            amount: 15000,
            currency: 'usd',
            status: 'failed',
            last_payment_error: {
              message: 'Your card was declined'
            }
          }
        }
      };

      const stripe = require('stripe')();
      stripe.webhooks = {
        constructEvent: jest.fn().mockReturnValue(webhookPayload)
      };

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'mock-signature')
        .send(webhookPayload)
        .expect(200);

      // Verify booking was marked as failed
      const failedBooking = await models.Booking.findByPk(pendingBooking.id);
      expect(failedBooking.status).toBe('payment_failed');
      expect(failedBooking.paymentError).toContain('declined');
    });
  });
});