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
const webhookService = require('../services/webhook.service');
const { createLogger } = require('../config/logger');

const logger = createLogger('outseta-routes');

/**
 * Verify Outseta webhook signature
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-outseta-signature'];
  
  if (!signature) {
    logger.warn('Missing webhook signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Get raw body for signature verification
  const rawBody = req.body;
  
  if (!webhookService.verifyOutsetaSignature(JSON.stringify(rawBody), signature)) {
    logger.warn('Invalid webhook signature', { 
      signature: signature.substring(0, 10) + '...' 
    });
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
        webhookService.logWebhookEvent(req.body, 'outseta', false, 'Validation failed');
        return res.status(400).json({ errors: errors.array() });
      }

      const event = req.body;

      // Validate event structure
      const validation = webhookService.validateEventStructure(event);
      if (!validation.isValid) {
        webhookService.logWebhookEvent(event, 'outseta', false, validation.errors.join(', '));
        return res.status(400).json({ 
          error: 'Invalid event structure',
          details: validation.errors 
        });
      }

      logger.info('Received Outseta webhook', { type: event.type });

      // Process webhook with retry logic
      const success = await webhookService.processEventWithRetry(
        event,
        (evt) => outsetaService.handleWebhook(evt),
        3 // max retries
      );

      if (success) {
        webhookService.logWebhookEvent(event, 'outseta', true);
        res.status(200).json(webhookService.createWebhookResponse(
          true, 
          'Webhook processed successfully'
        ));
      } else {
        webhookService.logWebhookEvent(event, 'outseta', false, 'Processing failed after retries');
        res.status(500).json(webhookService.createWebhookResponse(
          false, 
          'Webhook processing failed'
        ));
      }
    } catch (error) {
      logger.error('Webhook processing error', { error: error.message });
      webhookService.logWebhookEvent(req.body, 'outseta', false, error.message);
      res.status(500).json(webhookService.createWebhookResponse(
        false, 
        'Webhook processing failed',
        { error: error.message }
      ));
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

/**
 * GET /api/outseta/webhook/stats
 * Get webhook processing statistics
 */
router.get('/webhook/stats', async (req, res) => {
  try {
    const timeRange = req.query.range || '24h';
    const stats = await webhookService.getWebhookStats(timeRange);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error fetching webhook stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch webhook statistics' });
  }
});

/**
 * POST /api/outseta/webhook/test
 * Test webhook endpoint (development only)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/webhook/test',
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

        const testEvent = req.body;
        
        logger.info('Processing test webhook event', { type: testEvent.type });

        const success = await webhookService.processEventWithRetry(
          testEvent,
          (evt) => outsetaService.handleWebhook(evt),
          1 // only one attempt for tests
        );

        res.json({
          success,
          message: success ? 'Test webhook processed successfully' : 'Test webhook processing failed',
          event: testEvent
        });
      } catch (error) {
        logger.error('Test webhook error', { error: error.message });
        res.status(500).json({ error: 'Test webhook failed' });
      }
    }
  );
}

module.exports = router;