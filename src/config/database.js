/**
 * Database configuration
 * Exports the appropriate database configuration based on environment
 */

if (process.env.NODE_ENV === 'test') {
  module.exports = require('./database-test');
} else {
  module.exports = require('./database-mysql');
}