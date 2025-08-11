/**
 * Migration routes
 * 
 * Temporary routes for running database migrations in AWS environment
 * Should be removed or secured in production
 */

const express = require('express');
const router = express.Router();
const { runMigrations } = require('../migrate');

/**
 * Run database migrations
 * @route POST /api/migrations/run
 * @access Private - should be secured with authentication in production
 */
router.post('/run', async (req, res) => {
  try {
    // In production, add authentication check here
    // For now, check for a secret token
    const { token } = req.body;
    
    if (token !== 'temporary-migration-token-2024') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    const result = await runMigrations();
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Check migration status
 * @route GET /api/migrations/status
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Migration endpoint is available',
      environment: process.env.NODE_ENV,
      database: {
        host: process.env.DB_HOST,
        name: process.env.DB_NAME,
        connected: false // Will be updated when we add connection check
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;