/**
 * Minimal Lambda function for running database migrations
 * This avoids loading the full application and troublesome dependencies
 */

const { runMigrations } = require('./migrate');

exports.handler = async (event, context) => {
  try {
    console.log('Migration Lambda started');
    
    // Check for authorization
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader || !authHeader.includes('temp-token-123')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const result = await runMigrations();
    console.log('Migration completed:', result);
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        stack: error.stack
      })
    };
  }
};