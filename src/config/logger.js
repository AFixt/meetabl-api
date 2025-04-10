/**
 * Logger configuration using Bunyan
 *
 * Provides a centralized logging mechanism for the application
 *
 * @author meetabl Team
 */

const bunyan = require('bunyan');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Create a stream for output based on environment
let formatOut;
if (isProduction || isTest) {
  formatOut = { type: 'stream', stream: process.stdout };
} else {
  formatOut = {
    type: 'rotating-file',
    path: path.join(__dirname, '../../logs/meetabl.log'),
    period: '1d',
    count: 7
  };
}

// Create the logger
const logger = bunyan.createLogger({
  name: 'meetabl-api',
  level: isProduction ? 'info' : 'debug',
  serializers: bunyan.stdSerializers,
  streams: [
    formatOut,
    ...(isTest ? [] : [{
      level: 'error',
      type: 'rotating-file',
      path: path.join(__dirname, '../../logs/error.log'),
      period: '1d',
      count: 7
    }])
  ]
});

module.exports = logger;
