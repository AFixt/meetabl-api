/**
 * Subscription middleware
 *
 * Middleware for enforcing subscription limits and access control
 *
 * @author meetabl Team
 */

const User = require('../models/user.model');
const CalendarToken = require('../models/calendar-token.model');
const logger = require('../config/logger');

/**
 * Check if user has a paid subscription
 */
const requirePaidSubscription = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.hasPaidSubscription() && user.plan_type === 'free') {
      logger.warn('Access denied: Paid subscription required', {
        userId: req.user.id,
        endpoint: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        message: 'This feature requires a paid subscription',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking subscription status', {
      error: error?.message || error,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking subscription status'
    });
  }
};

/**
 * Check if user can add more calendars
 */
const checkCalendarLimit = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    const calendarCount = await CalendarToken.count({
      where: { user_id: req.user.id }
    });
    
    if (!user.canAddCalendars(calendarCount)) {
      logger.warn('Calendar limit reached', {
        userId: req.user.id,
        currentCount: calendarCount,
        limit: user.max_calendars
      });
      
      return res.status(403).json({
        success: false,
        message: `You have reached your limit of ${user.max_calendars} calendar${user.max_calendars === 1 ? '' : 's'}. Please upgrade to add more.`,
        code: 'CALENDAR_LIMIT_REACHED',
        limit: user.max_calendars,
        current: calendarCount
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking calendar limit', {
      error: error?.message || error,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking calendar limit'
    });
  }
};

/**
 * Check if user can add more event types
 */
const checkEventTypeLimit = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    const EventType = require('../models/event-type.model');
    
    // Count actual event types
    const eventTypeCount = await EventType.count({
      where: { user_id: req.user.id }
    });
    
    if (!user.canAddEventTypes(eventTypeCount)) {
      logger.warn('Event type limit reached', {
        userId: req.user.id,
        currentCount: eventTypeCount,
        limit: user.max_event_types
      });
      
      return res.status(403).json({
        success: false,
        message: `You have reached your limit of ${user.max_event_types} event type${user.max_event_types === 1 ? '' : 's'}. Please upgrade to add more.`,
        code: 'EVENT_TYPE_LIMIT_REACHED',
        limit: user.max_event_types,
        current: eventTypeCount
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking event type limit', {
      error: error?.message || error,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking event type limit'
    });
  }
};

/**
 * Check if user can use integrations
 */
const requireIntegrations = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.canUseIntegrations()) {
      logger.warn('Access denied: Integrations not enabled', {
        userId: req.user.id,
        endpoint: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        message: 'Calendar integrations require a paid subscription',
        code: 'INTEGRATIONS_NOT_ENABLED'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking integration access', {
      error: error?.message || error,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking integration access'
    });
  }
};

/**
 * Get user subscription info (can be used in routes to display limits)
 */
const getSubscriptionInfo = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        'plan_type',
        'max_calendars',
        'max_event_types',
        'integrations_enabled',
        'can_remove_branding',
        'can_customize_avatar',
        'can_customize_booking_page',
        'can_use_meeting_polls',
        'stripe_subscription_status',
        'stripe_current_period_end',
        'billing_period'
      ]
    });
    
    const planLimits = user.getPlanLimits();
    
    // Add subscription info to request for use in route handlers
    req.subscriptionInfo = {
      planType: user.plan_type,
      isPaid: user.hasPaidSubscription(),
      limits: {
        calendars: user.max_calendars,
        eventTypes: user.max_event_types,
        integrationsEnabled: user.integrations_enabled
      },
      features: {
        canRemoveBranding: user.can_remove_branding,
        canCustomizeAvatar: user.can_customize_avatar,
        canCustomizeBookingPage: user.can_customize_booking_page,
        canUseMeetingPolls: user.can_use_meeting_polls
      },
      planDetails: planLimits,
      billing: {
        status: user.stripe_subscription_status,
        currentPeriodEnd: user.stripe_current_period_end,
        billingPeriod: user.billing_period
      }
    };
    
    next();
  } catch (error) {
    logger.error('Error getting subscription info', {
      error: error?.message || error,
      userId: req.user?.id
    });
    
    // Don't fail the request, just log the error
    req.subscriptionInfo = null;
    next();
  }
};

/**
 * Check if user can remove branding
 */
const requireBrandingRemoval = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.can_remove_branding) {
      logger.warn('Access denied: Branding removal requires Basic or Professional plan', {
        userId: req.user.id,
        endpoint: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        message: 'Removing branding requires a Basic or Professional subscription',
        code: 'BRANDING_REMOVAL_NOT_ALLOWED'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking branding removal permission', {
      error: error?.message || error,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking branding removal permission'
    });
  }
};

/**
 * Check if user can customize booking page
 */
const requireBookingPageCustomization = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.can_customize_booking_page) {
      logger.warn('Access denied: Booking page customization requires Basic or Professional plan', {
        userId: req.user.id,
        endpoint: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        message: 'Customizing booking page requires a Basic or Professional subscription',
        code: 'BOOKING_PAGE_CUSTOMIZATION_NOT_ALLOWED'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking booking page customization permission', {
      error: error?.message || error,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking booking page customization permission'
    });
  }
};

/**
 * Check if user can use meeting polls
 */
const requireMeetingPolls = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.can_use_meeting_polls) {
      logger.warn('Access denied: Meeting polls require Professional plan', {
        userId: req.user.id,
        endpoint: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        message: 'Meeting polls require a Professional subscription',
        code: 'MEETING_POLLS_NOT_ALLOWED'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking meeting polls permission', {
      error: error?.message || error,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error checking meeting polls permission'
    });
  }
};

module.exports = {
  requirePaidSubscription,
  checkCalendarLimit,
  checkEventTypeLimit,
  requireIntegrations,
  getSubscriptionInfo,
  requireBrandingRemoval,
  requireBookingPageCustomization,
  requireMeetingPolls
};