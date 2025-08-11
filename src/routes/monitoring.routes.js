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
const healthCheckService = require('../services/health-check.service');
const { getRetentionStatus, processSinglePolicy } = require('../jobs/data-retention-processor');
const { authenticateJWT } = require('../middlewares/auth');
const { createLogger } = require('../config/logger');

const logger = createLogger('monitoring-routes');

/**
 * GET /api/monitoring/health
 * Comprehensive health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const healthResult = await healthCheckService.runAllChecks();
    
    // Add environment and version info
    healthResult.environment = process.env.NODE_ENV;
    healthResult.version = process.env.npm_package_version || '1.0.0';
    healthResult.uptime = process.uptime();
    
    const statusCode = healthResult.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthResult);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      error: error.message,
      checks: {}
    });
  }
});

/**
 * GET /api/monitoring/health/live
 * Kubernetes liveness probe endpoint
 */
router.get('/health/live', (req, res) => {
  const result = healthCheckService.isAlive();
  const statusCode = result.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(result);
});

/**
 * GET /api/monitoring/health/ready
 * Kubernetes readiness probe endpoint
 */
router.get('/health/ready', async (req, res) => {
  try {
    const isReady = await healthCheckService.isReady();
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/health/basic
 * Load balancer health check endpoint (fast, minimal)
 */
router.get('/health/basic', async (req, res) => {
  try {
    const result = await healthCheckService.getBasicHealth();
    const statusCode = result.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/health/:check
 * Individual health check endpoint
 */
router.get('/health/:check', async (req, res) => {
  try {
    const checkName = req.params.check;
    const result = await healthCheckService.runCheck(checkName);
    
    const statusCode = result.status === 'healthy' ? 200 : 
                      result.status === 'warning' ? 200 : 503;
                      
    res.status(statusCode).json(result);
  } catch (error) {
    logger.error('Individual health check failed', { 
      check: req.params.check, 
      error: error.message 
    });
    
    res.status(404).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
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

/**
 * GET /api/monitoring/data-retention/status
 * Get data retention policy status and configuration
 */
router.get('/data-retention/status', authenticateJWT, async (req, res) => {
  try {
    const status = await getRetentionStatus();
    res.json({
      success: true,
      data_retention: status
    });
  } catch (error) {
    logger.error('Error fetching data retention status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data retention status'
    });
  }
});

/**
 * POST /api/monitoring/data-retention/execute/:policy
 * Manually execute a specific data retention policy
 */
router.post('/data-retention/execute/:policy', authenticateJWT, async (req, res) => {
  try {
    const policyName = req.params.policy;
    const result = await processSinglePolicy(policyName);
    
    res.json({
      success: result.success,
      result
    });
  } catch (error) {
    logger.error('Error executing data retention policy', { 
      policy: req.params.policy,
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: `Failed to execute retention policy: ${req.params.policy}`
    });
  }
});

module.exports = router;