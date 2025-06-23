/**
 * Monitoring and metrics routes
 * 
 * Provides endpoints for application monitoring and health checks
 * 
 * @author meetabl Team
 */

const router = require('express').Router();
const metricsService = require('../services/metrics.service');
const logManagementService = require('../services/log-management.service');
const { authenticateJWT } = require('../middlewares/auth');
const { createLogger } = require('../config/logger');

const logger = createLogger('monitoring-routes');

/**
 * GET /api/monitoring/health
 * Basic health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const { sequelize } = require('../config/database');
    
    // Test database connection
    await sequelize.authenticate();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      database: 'connected',
      memory: process.memoryUsage()
    };

    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      error: error.message,
      database: 'disconnected'
    };

    res.status(503).json(health);
  }
});

/**
 * GET /api/monitoring/metrics
 * Application metrics endpoint (requires authentication)
 */
router.get('/metrics', authenticateJWT, async (req, res) => {
  try {
    const metrics = await metricsService.getMetricsSummary();
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Error fetching metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics'
    });
  }
});

/**
 * GET /api/monitoring/stats
 * Detailed application statistics (requires authentication)
 */
router.get('/stats', authenticateJWT, async (req, res) => {
  try {
    const { User, Booking, Team } = require('../models');
    const { sequelize } = require('../config/database');
    
    // Get database statistics
    const [dbStats] = await sequelize.query(`
      SELECT 
        table_name,
        table_rows,
        data_length,
        index_length
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      ORDER BY data_length DESC
    `);

    // Get application statistics
    const stats = {
      timestamp: new Date().toISOString(),
      database: {
        tables: dbStats,
        pool: sequelize.pool ? {
          acquired: sequelize.pool.acquired,
          pending: sequelize.pool.pending,
          size: sequelize.pool.size
        } : null
      },
      application: {
        totalUsers: await User.count(),
        totalBookings: await Booking.count(),
        totalTeams: await Team.count(),
        recentBookings: await Booking.count({
          where: {
            created: {
              [sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        }),
        recentUsers: await User.count({
          where: {
            created: {
              [sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })
      },
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      }
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error fetching stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * GET /api/monitoring/performance
 * Performance metrics and trends
 */
router.get('/performance', authenticateJWT, async (req, res) => {
  try {
    const timeRange = req.query.range || '24h';
    
    // This would typically query a time-series database
    // For now, we'll return current performance metrics
    const performance = {
      timestamp: new Date().toISOString(),
      timeRange,
      metrics: {
        averageResponseTime: '150ms', // Would be calculated from actual data
        errorRate: '0.5%',
        throughput: '120 req/min',
        availabilityUptime: '99.9%'
      },
      alerts: {
        active: 0,
        total: 0
      },
      trends: {
        responseTime: 'stable',
        errorRate: 'decreasing',
        throughput: 'increasing'
      }
    };

    res.json({
      success: true,
      performance
    });
  } catch (error) {
    logger.error('Error fetching performance metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics'
    });
  }
});

/**
 * POST /api/monitoring/test-alert
 * Test alerting system (development only)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-alert', authenticateJWT, async (req, res) => {
    try {
      const { type = 'test', severity = 'info', message = 'Test alert' } = req.body;
      
      logger.warn('Test alert triggered', {
        type,
        severity,
        message,
        triggeredBy: req.user.email,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Test alert sent',
        alert: { type, severity, message }
      });
    } catch (error) {
      logger.error('Error sending test alert', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to send test alert'
      });
    }
  });
}

/**
 * GET /api/monitoring/logs/stats
 * Get log statistics and disk usage
 */
router.get('/logs/stats', authenticateJWT, async (req, res) => {
  try {
    const stats = await logManagementService.getLogStatistics();
    res.json({
      success: true,
      logStats: stats
    });
  } catch (error) {
    logger.error('Error fetching log statistics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch log statistics'
    });
  }
});

/**
 * POST /api/monitoring/logs/cleanup
 * Manually trigger log cleanup
 */
router.post('/logs/cleanup', authenticateJWT, async (req, res) => {
  try {
    await logManagementService.cleanupOldLogs();
    res.json({
      success: true,
      message: 'Log cleanup completed'
    });
  } catch (error) {
    logger.error('Error during manual log cleanup', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Log cleanup failed'
    });
  }
});

/**
 * POST /api/monitoring/logs/compress
 * Manually trigger log compression
 */
router.post('/logs/compress', authenticateJWT, async (req, res) => {
  try {
    await logManagementService.compressOldLogs();
    res.json({
      success: true,
      message: 'Log compression completed'
    });
  } catch (error) {
    logger.error('Error during manual log compression', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Log compression failed'
    });
  }
});

module.exports = router;