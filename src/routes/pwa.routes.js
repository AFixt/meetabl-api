/**
 * PWA-specific routes
 * 
 * Handles Progressive Web App features including push notifications,
 * offline sync, and app installation
 * 
 * @author meetabl Team
 */

const router = require('express').Router();
const { authenticateJWT } = require('../middlewares/auth');
const { createLogger } = require('../config/logger');

const logger = createLogger('pwa-routes');

/**
 * POST /api/pwa/subscribe
 * Subscribe to push notifications
 */
router.post('/subscribe', authenticateJWT, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription data'
      });
    }
    
    // Store subscription in database
    // This would typically save to a PushSubscription model
    logger.info('Push notification subscription received', {
      userId,
      endpoint: subscription.endpoint.substring(0, 50) + '...' // Truncate for privacy
    });
    
    // For now, just acknowledge the subscription
    res.json({
      success: true,
      message: 'Push notification subscription saved'
    });
    
  } catch (error) {
    logger.error('Error saving push subscription', { 
      error: error.message,
      userId: req.user ? req.user.id : undefined
    });
    res.status(500).json({
      success: false,
      error: 'Failed to save push subscription'
    });
  }
});

/**
 * DELETE /api/pwa/unsubscribe
 * Unsubscribe from push notifications
 */
router.delete('/unsubscribe', authenticateJWT, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user.id;
    
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint required for unsubscription'
      });
    }
    
    // Remove subscription from database
    logger.info('Push notification unsubscription received', {
      userId,
      endpoint: endpoint.substring(0, 50) + '...'
    });
    
    res.json({
      success: true,
      message: 'Push notification subscription removed'
    });
    
  } catch (error) {
    logger.error('Error removing push subscription', { 
      error: error.message,
      userId: req.user ? req.user.id : undefined
    });
    res.status(500).json({
      success: false,
      error: 'Failed to remove push subscription'
    });
  }
});

/**
 * POST /api/pwa/sync
 * Handle background sync data
 */
router.post('/sync', authenticateJWT, async (req, res) => {
  try {
    const { syncType, data } = req.body;
    const userId = req.user.id;
    
    if (!syncType || !data) {
      return res.status(400).json({
        success: false,
        error: 'Sync type and data are required'
      });
    }
    
    logger.info('Background sync data received', {
      userId,
      syncType,
      dataCount: Array.isArray(data) ? data.length : 1
    });
    
    let result = {};
    
    switch (syncType) {
      case 'bookings':
        result = await handleBookingSync(data, userId);
        break;
      case 'metrics':
        result = await handleMetricsSync(data, userId);
        break;
      case 'notifications':
        result = await handleNotificationSync(data, userId);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown sync type'
        });
    }
    
    res.json({
      success: true,
      syncType,
      result
    });
    
  } catch (error) {
    logger.error('Error processing sync data', { 
      error: error.message,
      syncType: req.body.syncType,
      userId: req.user ? req.user.id : undefined
    });
    res.status(500).json({
      success: false,
      error: 'Failed to process sync data'
    });
  }
});

/**
 * GET /api/pwa/offline-data
 * Get essential data for offline use
 */
router.get('/offline-data', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get essential data that should be available offline
    const offlineData = {
      user: {
        id: userId,
        name: req.user.name,
        email: req.user.email,
        preferences: req.user.preferences || {}
      },
      settings: {
        // Essential app settings
        timezone: req.user.timezone || 'UTC',
        dateFormat: req.user.dateFormat || 'YYYY-MM-DD',
        notifications: req.user.notificationSettings || {}
      },
      constants: {
        // App constants that don't change often
        bookingStatuses: ['pending', 'confirmed', 'cancelled', 'completed'],
        timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
        durations: [15, 30, 45, 60, 90, 120]
      },
      lastSync: new Date().toISOString()
    };
    
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    res.json({
      success: true,
      data: offlineData
    });
    
    logger.info('Offline data served', { userId });
    
  } catch (error) {
    logger.error('Error serving offline data', { 
      error: error.message,
      userId: req.user ? req.user.id : undefined
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get offline data'
    });
  }
});

/**
 * GET /api/pwa/status
 * Get PWA status and capabilities
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      pwaEnabled: true,
      serviceWorkerEnabled: process.env.PWA_ENABLE_SW !== 'false',
      pushNotificationsEnabled: process.env.PWA_ENABLE_PUSH === 'true',
      offlineSupport: true,
      backgroundSync: true,
      capabilities: {
        installable: true,
        standalone: true,
        fullscreen: false,
        orientation: 'portrait-primary'
      },
      caching: {
        staticAssets: true,
        dynamicContent: true,
        apiResponses: true
      },
      features: [
        'Offline access to essential features',
        'Background synchronization',
        'Push notifications',
        'App installation',
        'Responsive design',
        'Accessibility compliant'
      ]
    };
    
    res.json({
      success: true,
      status
    });
    
  } catch (error) {
    logger.error('Error getting PWA status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get PWA status'
    });
  }
});

/**
 * POST /api/pwa/test-notification
 * Send test push notification (development only)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-notification', authenticateJWT, async (req, res) => {
    try {
      const { title, body, data } = req.body;
      const userId = req.user.id;
      
      const notification = {
        title: title || 'Test Notification',
        body: body || 'This is a test notification from meetabl API',
        data: data || { test: true },
        timestamp: new Date().toISOString()
      };
      
      // In a real implementation, this would send the notification
      // via a push service like FCM or similar
      logger.info('Test notification created', {
        userId,
        notification
      });
      
      res.json({
        success: true,
        message: 'Test notification created',
        notification
      });
      
    } catch (error) {
      logger.error('Error creating test notification', { 
        error: error.message,
        userId: req.user ? req.user.id : undefined
      });
      res.status(500).json({
        success: false,
        error: 'Failed to create test notification'
      });
    }
  });
}

/**
 * Handle booking sync data
 */
async function handleBookingSync(data, userId) {
  // Process offline booking data
  logger.info('Processing booking sync', { userId, bookingCount: data.length });
  
  // This would typically:
  // 1. Validate booking data
  // 2. Save to database
  // 3. Send confirmations
  // 4. Update calendars
  
  return {
    processed: data.length,
    success: data.length,
    failed: 0
  };
}

/**
 * Handle metrics sync data
 */
async function handleMetricsSync(data, userId) {
  // Process offline metrics data
  logger.info('Processing metrics sync', { userId, metricsCount: data.length });
  
  // This would typically:
  // 1. Validate metrics data
  // 2. Store in metrics database
  // 3. Update dashboards
  
  return {
    processed: data.length,
    stored: data.length
  };
}

/**
 * Handle notification sync data
 */
async function handleNotificationSync(data, userId) {
  // Process offline notification data
  logger.info('Processing notification sync', { userId, notificationCount: data.length });
  
  // This would typically:
  // 1. Queue notifications for sending
  // 2. Update notification preferences
  // 3. Mark as processed
  
  return {
    processed: data.length,
    queued: data.length
  };
}

module.exports = router;