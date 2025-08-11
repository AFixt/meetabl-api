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
  
  // Validate planId
  if (!planId || !['basic', 'professional'].includes(planId)) {
    return res.status(400).json({
      error: 'Invalid plan ID. Must be "basic" or "professional"'
    });
  }
  
  // Determine the correct Stripe price ID based on plan and billing period
  let priceId;
  const plan = planId.toUpperCase();
  const period = billingPeriod === 'annual' ? 'ANNUAL' : 'MONTHLY';
  
  if (stripeProducts.PRICES[plan] && stripeProducts.PRICES[plan][period]) {
    priceId = stripeProducts.PRICES[plan][period].id;
  } else {
    return res.status(400).json({
      error: 'Invalid plan or billing period combination'
    });
  }
  
  logger.info('Subscription upgrade requested', { 
    userId, 
    planId,
    billingPeriod,
    priceId
  });
  
  // Create Stripe checkout session for upgrade
  const session = await stripeSubscriptionService.createCheckoutSession(req.user, priceId, {
    successUrl: `${process.env.APP_URL || process.env.FRONTEND_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${process.env.APP_URL || process.env.FRONTEND_URL}/settings/billing?canceled=true`,
    // Enable discount codes
    allow_promotion_codes: stripeProducts.DISCOUNT_CODES.ENABLED
  });
  
  successResponse(res, {
    message: 'Stripe checkout session created',
    checkoutUrl: session.url,
    sessionId: session.id,
    planId,
    billingPeriod
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
 * Create checkout session with price ID - new endpoint for multi-tier plans
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createCheckoutSession = asyncHandler(async (req, res) => {
  const { price_id } = req.body;
  const userId = req.user.id;
  
  if (!price_id) {
    return res.status(400).json({
      error: 'price_id is required'
    });
  }
  
  // Validate price_id and get plan details
  const planDetails = stripeProducts.getPlanFromPriceId(price_id);
  if (!planDetails) {
    return res.status(400).json({
      error: 'Invalid price_id provided'
    });
  }
  
  logger.info('Checkout session creation requested', { 
    userId, 
    price_id,
    planDetails
  });
  
  // Create Stripe checkout session
  const session = await stripeSubscriptionService.createCheckoutSession(req.user, price_id, {
    successUrl: `${process.env.APP_URL || process.env.FRONTEND_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${process.env.APP_URL || process.env.FRONTEND_URL}/settings/billing?canceled=true`,
    // Enable discount codes
    allow_promotion_codes: stripeProducts.DISCOUNT_CODES.ENABLED
  });
  
  successResponse(res, {
    message: 'Stripe checkout session created',
    checkout_url: session.url,
    session_id: session.id,
    plan: planDetails.plan,
    interval: planDetails.interval
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

/**
 * Sync subscription status with Stripe
 * This is useful when webhooks fail or for local development
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const syncSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  logger.info(`Syncing subscription for user ${userId}`);
  
  // Get the user with their Stripe details
  const { User } = require('../models');
  const user = await User.findByPk(userId);
  
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'user_not_found',
        message: 'User not found'
      }
    });
  }
  
  // If user has a Stripe customer ID, fetch latest subscription from Stripe
  if (user.stripe_customer_id) {
    try {
      const stripe = stripeService.getStripe();
      
      // Get all subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'all',
        limit: 1
      });
      
      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        const priceId = subscription.items.data[0]?.price.id;
        
        // Determine plan type from price ID
        const planDetails = stripeProducts.getPlanFromPriceId(priceId);
        const planType = planDetails ? planDetails.plan : 'free';
        
        // Update user with latest subscription details
        await user.update({
          stripe_subscription_id: subscription.id,
          stripe_subscription_status: subscription.status,
          stripe_price_id: priceId,
          stripe_current_period_end: new Date(subscription.current_period_end * 1000),
          plan_type: planType,
          billing_period: planDetails?.interval === 'year' ? 'annual' : 'monthly'
        });
        
        // Apply plan limits based on new plan type
        await user.applyPlanLimits();
        await user.save();
        
        logger.info(`Subscription synced for user ${userId}: ${planType} (${subscription.status})`);
        
        successResponse(res, {
          message: 'Subscription synced successfully',
          subscription: {
            plan_type: planType,
            status: subscription.status,
            billing_period: user.billing_period,
            current_period_end: user.stripe_current_period_end
          }
        });
      } else {
        // No active subscription found
        await user.update({
          stripe_subscription_id: null,
          stripe_subscription_status: null,
          stripe_price_id: null,
          stripe_current_period_end: null,
          plan_type: 'free',
          billing_period: null
        });
        
        await user.applyPlanLimits();
        await user.save();
        
        logger.info(`No active subscription found for user ${userId}, reset to free plan`);
        
        successResponse(res, {
          message: 'No active subscription found',
          subscription: {
            plan_type: 'free',
            status: 'inactive'
          }
        });
      }
    } catch (error) {
      logger.error(`Error syncing subscription for user ${userId}:`, error);
      throw error;
    }
  } else {
    // No Stripe customer ID
    successResponse(res, {
      message: 'No Stripe customer associated with this account',
      subscription: {
        plan_type: user.plan_type || 'free',
        status: 'inactive'
      }
    });
  }
});

module.exports = {
  getSubscription,
  getPlans,
  checkFeature,
  checkLimit,
  upgrade,
  cancel,
  createCheckoutSession,
  getUsageStats,
  syncSubscription
};