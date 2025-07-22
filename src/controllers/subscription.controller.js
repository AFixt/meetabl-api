/**
 * Subscription controller
 * 
 * Handles subscription management endpoints
 * 
 * @author meetabl Team
 */

const { createLogger } = require('../config/logger');
const subscriptionService = require('../services/subscription.service');
const stripeService = require('../services/stripe.service');
const stripeSubscriptionService = require('../services/stripe-subscription.service');
const stripeProducts = require('../config/stripe-products');
const { asyncHandler, successResponse } = require('../utils/error-response');

const logger = createLogger('subscription-controller');

/**
 * Get current subscription details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const subscription = await subscriptionService.getSubscriptionDetails(userId);
  
  successResponse(res, {
    subscription
  });
});

/**
 * Get available subscription plans
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPlans = asyncHandler(async (req, res) => {
  const plans = subscriptionService.getAvailablePlans();
  
  successResponse(res, {
    plans
  });
});

/**
 * Check feature access
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkFeature = asyncHandler(async (req, res) => {
  const { feature } = req.params;
  const userId = req.user.id;
  
  const hasAccess = await subscriptionService.checkFeatureAccess(userId, feature);
  
  successResponse(res, {
    feature,
    hasAccess,
    currentPlan: req.user.subscription_plan || 'Basic'
  });
});

/**
 * Check usage limits
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkLimit = asyncHandler(async (req, res) => {
  const { limitType } = req.params;
  const userId = req.user.id;
  
  // Get current usage based on limit type
  let currentUsage = 0;
  
  switch (limitType) {
    case 'bookings_per_month':
      // Count bookings for current month
      const { Booking } = require('../models');
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      currentUsage = await Booking.count({
        where: {
          hostId: userId,
          startTime: {
            $gte: startOfMonth
          }
        }
      });
      break;
      
    case 'team_members':
      // Count team members
      const { TeamMember } = require('../models');
      const teams = await TeamMember.findAll({
        where: { userId },
        include: [{
          model: require('../models').Team,
          as: 'team',
          where: { ownerId: userId }
        }]
      });
      
      if (teams.length > 0) {
        currentUsage = await TeamMember.count({
          where: { teamId: teams[0].teamId }
        });
      }
      break;
      
    case 'calendar_integrations':
      // Count active calendar integrations
      const { CalendarToken } = require('../models');
      currentUsage = await CalendarToken.count({
        where: { 
          userId,
          status: 'active'
        }
      });
      break;
  }
  
  const limitCheck = await subscriptionService.checkUsageLimit(userId, limitType, currentUsage);
  
  successResponse(res, limitCheck);
});

/**
 * Upgrade subscription - creates Stripe checkout session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const upgrade = asyncHandler(async (req, res) => {
  const { planId, billingPeriod = 'monthly' } = req.body;
  const userId = req.user.id;
  
  // Determine the correct Stripe price ID based on billing period
  let priceId;
  if (billingPeriod === 'annual') {
    priceId = stripeProducts.PRICES.ANNUAL.id;
  } else {
    priceId = stripeProducts.PRICES.MONTHLY.id;
  }
  
  logger.info('Subscription upgrade requested', { 
    userId, 
    planId,
    billingPeriod,
    priceId,
    productId: stripeProducts.SUBSCRIPTION_PRODUCT_ID
  });
  
  // Create Stripe checkout session for upgrade
  const session = await stripeSubscriptionService.createCheckoutSession(req.user, priceId, {
    successUrl: `${process.env.APP_URL || process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${process.env.APP_URL || process.env.FRONTEND_URL}/subscription/plans`,
    // Enable discount codes
    allow_promotion_codes: stripeProducts.DISCOUNT_CODES.ENABLED
  });
  
  // Update user plan limits when upgrading
  await req.user.update({
    plan_type: 'paid',
    max_calendars: stripeProducts.PLAN_LIMITS.PAID.maxCalendars,
    max_event_types: stripeProducts.PLAN_LIMITS.PAID.maxEventTypes,
    integrations_enabled: stripeProducts.PLAN_LIMITS.PAID.integrationsEnabled,
    billing_period: billingPeriod
  });
  
  successResponse(res, {
    message: 'Stripe checkout session created',
    checkoutUrl: session.url,
    sessionId: session.id,
    productId: stripeProducts.SUBSCRIPTION_PRODUCT_ID
  });
});

/**
 * Cancel subscription - cancels via Stripe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const cancel = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const userId = req.user.id;
  
  logger.info('Subscription cancellation requested', { 
    userId,
    reason 
  });
  
  if (!req.user.stripe_customer_id) {
    return res.status(400).json({
      error: 'No active subscription found'
    });
  }
  
  // Cancel subscription via Stripe
  const subscription = await stripeService.cancelSubscription(req.user.stripe_customer_id, {
    reason,
    userId
  });
  
  successResponse(res, {
    message: 'Subscription cancelled successfully',
    subscription: {
      status: subscription.status,
      canceledAt: subscription.canceled_at,
      currentPeriodEnd: subscription.current_period_end
    }
  });
});

/**
 * Get subscription usage statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUsageStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // Get subscription details
  const subscription = await subscriptionService.getSubscriptionDetails(userId);
  
  // Calculate usage for each limit type
  const usageStats = {};
  
  for (const [limitType, limit] of Object.entries(subscription.limits)) {
    let currentUsage = 0;
    
    // Similar logic as checkLimit but for all limit types
    switch (limitType) {
      case 'bookings_per_month':
        const { Booking } = require('../models');
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        currentUsage = await Booking.count({
          where: {
            hostId: userId,
            startTime: {
              $gte: startOfMonth
            }
          }
        });
        break;
        
      case 'team_members':
        const { TeamMember, Team } = require('../models');
        const userTeam = await Team.findOne({ where: { ownerId: userId } });
        
        if (userTeam) {
          currentUsage = await TeamMember.count({
            where: { teamId: userTeam.id }
          });
        }
        break;
        
      case 'calendar_integrations':
        const { CalendarToken } = require('../models');
        currentUsage = await CalendarToken.count({
          where: { 
            userId,
            status: 'active'
          }
        });
        break;
        
      case 'custom_fields':
        // Would need to implement custom fields feature
        currentUsage = 0;
        break;
    }
    
    usageStats[limitType] = {
      used: currentUsage,
      limit: limit,
      percentage: limit === -1 ? 0 : Math.round((currentUsage / limit) * 100)
    };
  }
  
  successResponse(res, {
    plan: subscription.plan,
    status: subscription.status,
    usage: usageStats
  });
});

module.exports = {
  getSubscription,
  getPlans,
  checkFeature,
  checkLimit,
  upgrade,
  cancel,
  getUsageStats
};