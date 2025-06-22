const axios = require('axios');
const { createLogger } = require('../config/logger');

const logger = createLogger('outseta-service');

class OutsetaService {
  constructor() {
    this.baseURL = process.env.OUTSETA_API_URL || 'https://api.outseta.com/v1';
    this.apiKey = process.env.OUTSETA_API_KEY;
    this.apiSecret = process.env.OUTSETA_API_SECRET;
    
    if (!this.apiKey || !this.apiSecret) {
      logger.warn('Outseta API credentials not configured');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: this.apiKey,
        password: this.apiSecret
      }
    });
  }

  /**
   * Validate an Outseta access token
   * @param {string} token - The Outseta access token
   * @returns {Promise<Object>} User data if valid
   */
  async validateToken(token) {
    try {
      const response = await this.client.get('/auth/validate', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      logger.info('Token validated successfully', { userId: response.data.uid });
      return response.data;
    } catch (error) {
      logger.error('Token validation failed', { error: error.message });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user details from Outseta
   * @param {string} uid - The Outseta user ID
   * @returns {Promise<Object>} User details
   */
  async getUser(uid) {
    try {
      const response = await this.client.get(`/people/${uid}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch user from Outseta', { uid, error: error.message });
      throw new Error('User not found');
    }
  }

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User details
   */
  async getUserByEmail(email) {
    try {
      const response = await this.client.get('/people', {
        params: {
          email: email
        }
      });

      if (response.data && response.data.items && response.data.items.length > 0) {
        return response.data.items[0];
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to fetch user by email', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Get user's subscription details
   * @param {string} uid - The Outseta user ID
   * @returns {Promise<Object>} Subscription details
   */
  async getUserSubscription(uid) {
    try {
      const response = await this.client.get(`/people/${uid}/subscriptions`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch subscription', { uid, error: error.message });
      throw new Error('Subscription not found');
    }
  }

  /**
   * Check if user has access to a specific feature
   * @param {string} uid - The Outseta user ID
   * @param {string} feature - Feature identifier
   * @returns {Promise<boolean>} Access permission
   */
  async checkFeatureAccess(uid, feature) {
    try {
      const subscription = await this.getUserSubscription(uid);
      
      // Map subscription plans to features
      const featureMap = {
        'basic': ['booking', 'calendar'],
        'professional': ['booking', 'calendar', 'teams', 'analytics'],
        'enterprise': ['booking', 'calendar', 'teams', 'analytics', 'api', 'custom-branding']
      };

      const plan = subscription.plan?.name?.toLowerCase() || 'basic';
      const allowedFeatures = featureMap[plan] || featureMap.basic;

      return allowedFeatures.includes(feature);
    } catch (error) {
      logger.error('Failed to check feature access', { uid, feature, error: error.message });
      return false;
    }
  }

  /**
   * Handle Outseta webhook events
   * @param {Object} event - Webhook event data
   * @returns {Promise<void>}
   */
  async handleWebhook(event) {
    try {
      logger.info('Processing Outseta webhook', { eventType: event.type });

      switch (event.type) {
        case 'person.created':
          await this.handlePersonCreated(event.data);
          break;
        case 'person.updated':
          await this.handlePersonUpdated(event.data);
          break;
        case 'subscription.created':
        case 'subscription.updated':
          await this.handleSubscriptionChange(event.data);
          break;
        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(event.data);
          break;
        default:
          logger.warn('Unhandled webhook event type', { type: event.type });
      }
    } catch (error) {
      logger.error('Webhook processing failed', { event, error: error.message });
      throw error;
    }
  }

  /**
   * Handle new user creation from Outseta
   * @param {Object} personData - Outseta person data
   * @returns {Promise<void>}
   */
  async handlePersonCreated(personData) {
    const User = require('../models/user.model');
    
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ where: { email: personData.email } });
      
      if (!existingUser) {
        // Create new user in local database
        await User.create({
          outseta_uid: personData.uid,
          email: personData.email,
          firstName: personData.firstName,
          lastName: personData.lastName,
          timezone: personData.timezone || 'UTC',
          role: 'user',
          status: 'active',
          emailVerified: true, // Outseta handles email verification
          emailVerifiedAt: new Date()
        });
        
        logger.info('Created new user from Outseta', { email: personData.email });
      } else {
        // Update existing user with Outseta ID
        await existingUser.update({
          outseta_uid: personData.uid,
          emailVerified: true,
          emailVerifiedAt: new Date()
        });
        
        logger.info('Updated existing user with Outseta ID', { email: personData.email });
      }
    } catch (error) {
      logger.error('Failed to handle person created', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle user updates from Outseta
   * @param {Object} personData - Updated person data
   * @returns {Promise<void>}
   */
  async handlePersonUpdated(personData) {
    const User = require('../models/user.model');
    
    try {
      const user = await User.findOne({ where: { outseta_uid: personData.uid } });
      
      if (user) {
        await user.update({
          email: personData.email,
          firstName: personData.firstName,
          lastName: personData.lastName,
          timezone: personData.timezone || user.timezone
        });
        
        logger.info('Updated user from Outseta', { email: personData.email });
      }
    } catch (error) {
      logger.error('Failed to handle person updated', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle subscription changes
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<void>}
   */
  async handleSubscriptionChange(subscriptionData) {
    const User = require('../models/user.model');
    
    try {
      const user = await User.findOne({ 
        where: { outseta_uid: subscriptionData.person.uid } 
      });
      
      if (user) {
        // Update user's subscription plan in local cache
        await user.update({
          subscriptionPlan: subscriptionData.plan.name,
          subscriptionStatus: subscriptionData.status
        });
        
        logger.info('Updated user subscription', { 
          email: user.email, 
          plan: subscriptionData.plan.name 
        });
      }
    } catch (error) {
      logger.error('Failed to handle subscription change', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle subscription cancellation
   * @param {Object} subscriptionData - Cancelled subscription data
   * @returns {Promise<void>}
   */
  async handleSubscriptionCancelled(subscriptionData) {
    const User = require('../models/user.model');
    
    try {
      const user = await User.findOne({ 
        where: { outseta_uid: subscriptionData.person.uid } 
      });
      
      if (user) {
        await user.update({
          subscriptionStatus: 'cancelled',
          subscriptionEndDate: subscriptionData.endDate
        });
        
        logger.info('Cancelled user subscription', { email: user.email });
      }
    } catch (error) {
      logger.error('Failed to handle subscription cancellation', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate Outseta login URL
   * @param {string} redirectUrl - URL to redirect after login
   * @returns {string} Outseta login URL
   */
  getLoginUrl(redirectUrl) {
    const baseUrl = process.env.OUTSETA_DOMAIN || 'https://app.outseta.com';
    const encodedRedirect = encodeURIComponent(redirectUrl);
    return `${baseUrl}/auth/login?redirect_uri=${encodedRedirect}`;
  }

  /**
   * Generate Outseta signup URL
   * @param {string} redirectUrl - URL to redirect after signup
   * @param {string} planId - Optional plan ID for signup
   * @returns {string} Outseta signup URL
   */
  getSignupUrl(redirectUrl, planId = null) {
    const baseUrl = process.env.OUTSETA_DOMAIN || 'https://app.outseta.com';
    const encodedRedirect = encodeURIComponent(redirectUrl);
    let url = `${baseUrl}/auth/signup?redirect_uri=${encodedRedirect}`;
    
    if (planId) {
      url += `&plan_id=${planId}`;
    }
    
    return url;
  }
}

module.exports = new OutsetaService();