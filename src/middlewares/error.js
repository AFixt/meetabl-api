/**
 * Error handling middleware
 * Re-exports error handling functionality from utils/error-response
 */

const { errorHandler } = require('../utils/error-response');

module.exports = errorHandler;