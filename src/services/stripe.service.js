/**
 * Stripe Service
 * 
 * Main service for Stripe integration
 * Handles initialization and common Stripe operations
 */

const Stripe = require('stripe');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');
const stripeConfig = require('../config/stripe-products');

class StripeService {
  constructor() {
    this.stripe = null;
    this.initialized = false;
  }

  /**
   * Initialize Stripe with API key
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    const apiKey = process.env.STRIPE_API_KEY;
    if (!apiKey) {
      throw new AppError('Stripe API key not configured', 500);
    }

    try {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2023-10-16',
        maxNetworkRetries: 2,
        timeout: 30000, // 30 seconds
        telemetry: false
      });

      this.initialized = true;
      logger.info('Stripe service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Stripe:', error);
      throw new AppError('Failed to initialize payment service', 500);
    }
  }

  /**
   * Get Stripe instance
   * @returns {Stripe} Stripe instance
   */
  getStripe() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.stripe;
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Raw request body
   * @param {string} signature - Stripe signature header
   * @returns {Object} Parsed event object
   */
  verifyWebhookSignature(payload, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new AppError('Stripe webhook secret not configured', 500);
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
      return event;
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      throw new AppError('Invalid webhook signature', 400);
    }
  }

  /**
   * Handle Stripe errors with consistent error messages
   * @param {Error} error - Stripe error
   * @returns {AppError} Formatted application error
   */
  handleStripeError(error) {
    logger.error('Stripe error:', error);

    // Map Stripe error types to user-friendly messages
    const errorMap = {
      'StripeCardError': {
        'card_declined': 'Your card was declined. Please try a different payment method.',
        'insufficient_funds': 'Your card has insufficient funds.',
        'expired_card': 'Your card has expired.',
        'incorrect_cvc': 'Your card\'s security code is incorrect.',
        'processing_error': 'An error occurred while processing your card. Please try again.',
        'incorrect_number': 'Your card number is incorrect.'
      },
      'StripeRateLimitError': 'Too many requests. Please try again later.',
      'StripeInvalidRequestError': 'Invalid request. Please check your information and try again.',
      'StripeAPIError': 'A payment service error occurred. Please try again later.',
      'StripeConnectionError': 'Network error. Please check your connection and try again.',
      'StripeAuthenticationError': 'Authentication failed. Please contact support.'
    };

    let message = 'An error occurred processing your request.';
    let statusCode = 500;

    if (error.type === 'StripeCardError') {
      message = errorMap.StripeCardError[error.code] || errorMap.StripeCardError.processing_error;
      statusCode = 400;
    } else if (errorMap[error.type]) {
      message = errorMap[error.type];
      statusCode = error.type === 'StripeRateLimitError' ? 429 : 400;
    }

    return new AppError(message, statusCode, {
      stripeError: error.type,
      stripeCode: error.code,
      stripeMessage: error.message
    });
  }

  /**
   * Format amount for Stripe (convert to cents)
   * @param {number} amount - Amount in dollars
   * @param {string} currency - Currency code (default: usd)
   * @returns {number} Amount in cents
   */
  formatAmount(amount, currency = 'usd') {
    // Stripe expects amounts in the smallest currency unit
    // For most currencies, this is cents (multiply by 100)
    // Some currencies don't have decimal places (e.g., JPY)
    const zeroDecimalCurrencies = ['jpy', 'krw', 'vnd', 'clp', 'pyg', 'xaf', 'xof', 'xpf'];
    
    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
      return Math.round(amount);
    }
    
    return Math.round(amount * 100);
  }

  /**
   * Format amount from Stripe (convert from cents)
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code (default: usd)
   * @returns {number} Amount in dollars
   */
  parseAmount(amount, currency = 'usd') {
    const zeroDecimalCurrencies = ['jpy', 'krw', 'vnd', 'clp', 'pyg', 'xaf', 'xof', 'xpf'];
    
    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
      return amount;
    }
    
    return amount / 100;
  }

  /**
   * Create idempotency key for safe retries
   * @param {string} prefix - Key prefix
   * @param {...any} parts - Additional parts to include in key
   * @returns {string} Idempotency key
   */
  createIdempotencyKey(prefix, ...parts) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const keyParts = [prefix, ...parts, timestamp, random];
    return keyParts.join('-');
  }

  /**
   * Check if super admin (bypass subscription requirements)
   * @param {Object} user - User object
   * @returns {boolean} Whether user is super admin
   */
  isSuperAdmin(user) {
    return user && user.is_super_admin === true;
  }

  /**
   * Check if user has active subscription
   * @param {Object} user - User object
   * @returns {boolean} Whether user has active subscription
   */
  hasActiveSubscription(user) {
    if (this.isSuperAdmin(user)) {
      return true;
    }

    if (!user.stripe_subscription_status) {
      return false;
    }

    const activeStatuses = ['active', 'trialing'];
    return activeStatuses.includes(user.stripe_subscription_status);
  }

  /**
   * Check if user is in trial period
   * @param {Object} user - User object
   * @returns {boolean} Whether user is in trial
   */
  isInTrial(user) {
    return user.stripe_subscription_status === 'trialing';
  }

  /**
   * Calculate trial end date
   * @returns {Date} Trial end date
   */
  calculateTrialEnd() {
    const trialDays = stripeConfig.TRIAL.DAYS;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);
    return trialEnd;
  }
}

// Export singleton instance
module.exports = new StripeService();