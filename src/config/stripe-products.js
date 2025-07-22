/**
 * Stripe Product Configuration
 * 
 * Centralized configuration for Stripe products and prices
 * 
 * @author meetabl Team
 */

module.exports = {
  // Main subscription product
  SUBSCRIPTION_PRODUCT_ID: 'prod_SiOdmA3bpv4djZ',
  
  // Price IDs for different billing periods
  PRICES: {
    MONTHLY: {
      id: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_11',
      amount: 1100, // $11.00 in cents
      interval: 'month'
    },
    ANNUAL: {
      id: process.env.STRIPE_PRICE_ANNUAL || 'price_annual_9',
      amount: 900, // $9.00 per month in cents
      interval: 'year',
      intervalCount: 1
    }
  },
  
  // Plan limits configuration
  PLAN_LIMITS: {
    FREE: {
      name: 'Free',
      maxCalendars: 1,
      maxEventTypes: 1,
      integrationsEnabled: false,
      features: [
        '1 calendar connection',
        '1 event type',
        'Basic booking features',
        'Email notifications'
      ]
    },
    PAID: {
      name: 'Professional',
      maxCalendars: 10,
      maxEventTypes: 10,
      integrationsEnabled: true,
      features: [
        'Unlimited calendar connections',
        'Unlimited event types',
        'Calendar integrations (Google, Microsoft)',
        'Advanced booking features',
        'Email & SMS notifications',
        'Priority support',
        'Custom branding',
        'Analytics & insights'
      ]
    }
  },
  
  // Trial configuration
  TRIAL: {
    DAYS: 14,
    FEATURES: ['paid'] // Features available during trial
  },
  
  // Discount code configuration
  DISCOUNT_CODES: {
    // Discount codes can be managed in Stripe Dashboard
    // This is just for reference
    ENABLED: true,
    ALLOWED_CODES: [] // Empty array means all valid Stripe codes are accepted
  }
};