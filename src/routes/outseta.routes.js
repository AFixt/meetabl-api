/**
 * Outseta webhook routes
 * 
 * Handles webhook events from Outseta for user and subscription management
 * 
 * @author meetabl Team
 */

const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const outsetaService = require('../services/outseta.service');
const { createLogger } = require('../config/logger');

const logger = createLogger('outseta-routes');

/**
 * Verify Outseta webhook signature
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-outseta-signature'];
  const webhookSecret = process.env.OUTSETA_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn('Outseta webhook secret not configured');
    return res.status(500).json({ error: 'Webhook configuration error' });
  }

  // Verify signature (implement based on Outseta's webhook signature method)
  // For now, we'll do a simple secret check
  if (signature !== webhookSecret) {
    logger.warn('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

/**
 * POST /api/outseta/webhook
 * Handle Outseta webhook events
 */
router.post('/webhook',
  verifyWebhookSignature,
  [
    body('type').notEmpty().withMessage('Event type is required'),
    body('data').notEmpty().withMessage('Event data is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { type, data } = req.body;

      logger.info('Received Outseta webhook', { type });

      await outsetaService.handleWebhook({ type, data });

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Webhook processing error', { error: error.message });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

/**
 * GET /api/outseta/login
 * Redirect to Outseta login
 */
router.get('/login', (req, res) => {
  const redirectUrl = req.query.redirect || process.env.APP_URL || 'http://localhost:3000';
  const loginUrl = outsetaService.getLoginUrl(redirectUrl);
  res.redirect(loginUrl);
});

/**
 * GET /api/outseta/signup
 * Redirect to Outseta signup
 */
router.get('/signup', (req, res) => {
  const redirectUrl = req.query.redirect || process.env.APP_URL || 'http://localhost:3000';
  const planId = req.query.plan;
  const signupUrl = outsetaService.getSignupUrl(redirectUrl, planId);
  res.redirect(signupUrl);
});

/**
 * POST /api/outseta/callback
 * Handle Outseta authentication callback
 */
router.post('/callback',
  [
    body('access_token').notEmpty().withMessage('Access token is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { access_token } = req.body;

      // Validate token with Outseta
      const userData = await outsetaService.validateToken(access_token);

      // Find or create user in local database
      const User = require('../models/user.model');
      let user = await User.findOne({ where: { outseta_uid: userData.uid } });

      if (!user) {
        // Create new user
        user = await User.create({
          outseta_uid: userData.uid,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          timezone: userData.timezone || 'UTC',
          role: 'user',
          status: 'active',
          emailVerified: true,
          emailVerifiedAt: new Date()
        });

        logger.info('Created new user from Outseta callback', { email: userData.email });
      }

      // Create JWT token for local session
      const jwt = require('jsonwebtoken');
      const jti = require('uuid').v4();
      
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          jti: jti
        },
        process.env.JWT_SECRET,
        { 
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          algorithm: 'HS256'
        }
      );

      // Set secure cookie
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        message: 'Authentication successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Callback processing error', { error: error.message });
      res.status(401).json({ error: 'Authentication failed' });
    }
  }
);

module.exports = router;