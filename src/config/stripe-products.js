/**
 * Stripe Product Configuration
 * 
 * Centralized configuration for Stripe products and prices
 * 
 * @author meetabl Team
 */

module.exports = {
  // Stripe Product IDs
  PRODUCTS: {
    BASIC: 'prod_SiOdmA3bpv4djZ',
    PROFESSIONAL: 'prod_SoC8R4aeSQurVU'
  },
  
  // Price IDs for different plans and billing periods
  PRICES: {
    BASIC: {
      MONTHLY: {
        id: 'price_1RsrNZLl8tYYnlU0ICssN9lA',
        amount: 1100, // $11.00 in cents
        interval: 'month'
      },
      ANNUAL: {
        id: 'price_1RsrNZLl8tYYnlU0SnSTSuE5',
        amount: 10800, // $108.00 per year ($9/month)
        interval: 'year'
      }
    },
    PROFESSIONAL: {
      MONTHLY: {
        id: 'price_1RsrNaLl8tYYnlU0rRYcs7O0',
        amount: 2100, // $21.00 in cents
        interval: 'month'
      },
      ANNUAL: {
        id: 'price_1RsrNaLl8tYYnlU02cuy888I',
        amount: 20400, // $204.00 per year ($17/month)
        interval: 'year'
      }
    }
  },
  
  // Plan limits configuration
  PLAN_LIMITS: {
    FREE: {
      name: 'Free',
      maxCalendars: 1,
      maxEventTypes: 1,
      integrationsEnabled: true,
      features: [
        '1 calendar connection',
        '1 event type',
        'Basic booking features',
        'Email notifications'
      ]
    },
    BASIC: {
      name: 'Basic',
      maxCalendars: 5,
      maxEventTypes: 999, // unlimited
      integrationsEnabled: true,
      canRemoveBranding: true,
      canCustomizeAvatar: true,
      canCustomizeBookingPage: true,
      canUseMeetingPolls: false,
      features: [
        'Unlimited event types',
        '5 calendar integrations',
        'Remove Meetabl branding',
        'Custom avatar',
        'Customize booking page appearance',
        'Priority support'
      ]
    },
    PROFESSIONAL: {
      name: 'Professional',
      maxCalendars: 999, // unlimited
      maxEventTypes: 999, // unlimited
      integrationsEnabled: true,
      canRemoveBranding: true,
      canCustomizeAvatar: true,
      canCustomizeBookingPage: true,
      canUseMeetingPolls: true,
      apiAccess: true,
      features: [
        'Everything in Basic',
        'Unlimited calendar integrations',
        'Meeting polls',
        'Advanced analytics',
        'API access',
        'Priority support'
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
  },

  // Price ID to Plan mapping helper
  PRICE_TO_PLAN_MAP: {
    'price_1RsrNZLl8tYYnlU0ICssN9lA': { plan: 'basic', interval: 'month', amount: 1100 },
    'price_1RsrNZLl8tYYnlU0SnSTSuE5': { plan: 'basic', interval: 'year', amount: 10800 },
    'price_1RsrNaLl8tYYnlU0rRYcs7O0': { plan: 'professional', interval: 'month', amount: 2100 },
    'price_1RsrNaLl8tYYnlU02cuy888I': { plan: 'professional', interval: 'year', amount: 20400 }
  },

  // Helper function to get plan details from price ID
  getPlanFromPriceId: function(priceId) {
    return this.PRICE_TO_PLAN_MAP[priceId] || null;
  }
};