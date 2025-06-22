/**
 * Application entry point
 *
 * Initializes and starts the Express server
 *
 * @author meetabl Team
 */

// Load environment variables
require('dotenv').config();

const logger = require('./config/logger');
const { initializeApp } = require('./app');
const { startMonitoringJob } = require('./jobs/db-monitor-job');

// Define port
const PORT = process.env.PORT || 3000;

// Start the server
(async () => {
  try {
    // Initialize application
    const app = await initializeApp();

    // Start the server
    app.listen(PORT, () => {
      logger.info(`meetabl API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start database monitoring job
      const monitoringInterval = parseInt(process.env.DB_MONITOR_INTERVAL) || 5;
      startMonitoringJob(monitoringInterval);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      // Graceful shutdown
      process.exit(1);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Graceful shutdown
      process.exit(1);
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
})();
