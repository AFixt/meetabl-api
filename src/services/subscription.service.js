/**
 * Subscription management service
 * 
 * Handles subscription-based feature access and plan management
 * 
 * @author meetabl Team
 */

const { createLogger } = require('../config/logger');
const outsetaService = require('./outseta.service');
const { User } = require('../models');

const logger = createLogger('subscription-service');

// Feature mapping by subscription tier
const FEATURE_TIERS = {
  basic: {
    name: 'Basic',
    features: [
      'booking',
      'calendar',
      'email_notifications',
      'basic_availability'
    ],
    limits: {
      bookings_per_month: 50,
      calendar_integrations: 1,
      team_members: 0,
      custom_fields: 0
    }
  },
  professional: {
    name: 'Professional',
    features: [
      'booking',
      'calendar',
      'email_notifications',
      'sms_notifications',
      'basic_availability',
      'advanced_availability',
      'teams',
      'analytics',
      'custom_fields',
      'payment_integration'
    ],
    limits: {
      bookings_per_month: 500,
      calendar_integrations: 3,
      team_members: 5,
      custom_fields: 10
    }
  },
  enterprise: {
    name: 'Enterprise',
    features: [
      'booking',
      'calendar',
      'email_notifications',
      'sms_notifications',
      'basic_availability',
      'advanced_availability',
      'teams',
      'analytics',
      'custom_fields',
      'payment_integration',
      'api_access',
      'custom_branding',
      'white_label',
      'priority_support',
      'sso',
      'audit_logs'
    ],
    limits: {
      bookings_per_month: -1, // Unlimited
      calendar_integrations: -1, // Unlimited
      team_members: -1, // Unlimited
      custom_fields: -1 // Unlimited
    }
  }
};

class SubscriptionService {
  /**
   * Check if user has access to a specific feature
   * @param {number} userId - User ID
   * @param {string} feature - Feature identifier
   * @returns {Promise<boolean>} Access permission
   */
  async checkFeatureAccess(userId, feature) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        logger.warn('User not found', { userId });
        return false;
      }

      // If user has Outseta ID, check with Outseta
      if (user.outseta_uid) {
        return await outsetaService.checkFeatureAccess(user.outseta_uid, feature);
      }

      // Fallback to local subscription data
      const tier = user.subscription_plan?.toLowerCase() || 'basic';
      const tierConfig = FEATURE_TIERS[tier] || FEATURE_TIERS.basic;
      
      return tierConfig.features.includes(feature);
    } catch (error) {
      logger.error('Error checking feature access', { userId, feature, error: error.message });
      return false;
    }
  }

  /**
   * Check if user is within usage limits
   * @param {number} userId - User ID
   * @param {string} limitType - Type of limit to check
   * @param {number} currentUsage - Current usage count
   * @returns {Promise<Object>} Limit check result
   */
  async checkUsageLimit(userId, limitType, currentUsage = 0) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        return { allowed: false, limit: 0, remaining: 0 };
      }

      const tier = user.subscription_plan?.toLowerCase() || 'basic';
      const tierConfig = FEATURE_TIERS[tier] || FEATURE_TIERS.basic;
      const limit = tierConfig.limits[limitType];

      // -1 means unlimited
      if (limit === -1) {
        return { allowed: true, limit: 'unlimited', remaining: 'unlimited' };
      }

      const remaining = Math.max(0, limit - currentUsage);
      
      return {
        allowed: currentUsage < limit,
        limit,
        remaining,
        usage: currentUsage
      };
    } catch (error) {
      logger.error('Error checking usage limit', { userId, limitType, error: error.message });
      return { allowed: false, limit: 0, remaining: 0 };
    }
  }

  /**
   * Get subscription details for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Subscription details
   */
  async getSubscriptionDetails(userId) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Get fresh data from Outseta if available
      if (user.outseta_uid) {
        try {
          const subscription = await outsetaService.getUserSubscription(user.outseta_uid);
          
          // Update local cache
          await user.update({
            subscription_plan: subscription.plan?.name,
            subscription_status: subscription.status,
            subscription_end_date: subscription.endDate
          });

          return {
            plan: subscription.plan?.name || 'Basic',
            status: subscription.status,
            endDate: subscription.endDate,
            features: FEATURE_TIERS[subscription.plan?.name?.toLowerCase()]?.features || FEATURE_TIERS.basic.features,
            limits: FEATURE_TIERS[subscription.plan?.name?.toLowerCase()]?.limits || FEATURE_TIERS.basic.limits,
            billing: {
              amount: subscription.amount,
              currency: subscription.currency,
              interval: subscription.interval
            }
          };
        } catch (error) {
          logger.warn('Failed to fetch subscription from Outseta', { error: error.message });
        }
      }

      // Fallback to local data
      const tier = user.subscription_plan?.toLowerCase() || 'basic';
      const tierConfig = FEATURE_TIERS[tier] || FEATURE_TIERS.basic;

      return {
        plan: tierConfig.name,
        status: user.subscription_status || 'active',
        endDate: user.subscription_end_date,
        features: tierConfig.features,
        limits: tierConfig.limits
      };
    } catch (error) {
      logger.error('Error getting subscription details', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get available subscription plans
   * @returns {Object} Available plans
   */
  getAvailablePlans() {
    return Object.entries(FEATURE_TIERS).map(([key, tier]) => ({
      id: key,
      name: tier.name,
      features: tier.features,
      limits: tier.limits
    }));
  }

  /**
   * Middleware to check feature access
   * @param {string} feature - Required feature
   * @returns {Function} Express middleware
   */
  requireFeature(feature) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const hasAccess = await this.checkFeatureAccess(req.user.id, feature);
        
        if (!hasAccess) {
          return res.status(403).json({
            error: 'Feature not available',
            message: `Your subscription plan does not include access to ${feature}`,
            requiredFeature: feature,
            currentPlan: req.user.subscription_plan || 'Basic'
          });
        }

        next();
      } catch (error) {
        logger.error('Feature check middleware error', { error: error.message });
        res.status(500).json({ error: 'Failed to verify feature access' });
      }
    };
  }

  /**
   * Middleware to check usage limits
   * @param {string} limitType - Type of limit
   * @param {Function} getUsage - Function to get current usage
   * @returns {Function} Express middleware
   */
  requireWithinLimit(limitType, getUsage) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const currentUsage = await getUsage(req);
        const limitCheck = await this.checkUsageLimit(req.user.id, limitType, currentUsage);
        
        if (!limitCheck.allowed) {
          return res.status(403).json({
            error: 'Usage limit exceeded',
            message: `You have reached your ${limitType.replace('_', ' ')} limit`,
            limit: limitCheck.limit,
            usage: limitCheck.usage,
            currentPlan: req.user.subscription_plan || 'Basic'
          });
        }

        // Attach limit info to request for informational purposes
        req.usageLimit = limitCheck;
        
        next();
      } catch (error) {
        logger.error('Usage limit middleware error', { error: error.message });
        res.status(500).json({ error: 'Failed to verify usage limits' });
      }
    };
  }
}

module.exports = new SubscriptionService();