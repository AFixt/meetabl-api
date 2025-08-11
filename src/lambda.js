/**
 * AWS Lambda handler for the meetabl API
 * 
 * Adapts the Express application to run in AWS Lambda environment
 * using the serverless-http library
 * 
 * @author meetabl Team
 */

const serverless = require('serverless-http');
const { initializeApp } = require('./app');

let app;
let initTime = 0;

/**
 * Lambda handler function
 * Initializes the Express app on cold start and handles requests
 */
const handler = async (event, context) => {
  // Force re-initialization after 5 minutes to pick up env changes
  const now = Date.now();
  if (!app || (now - initTime > 300000)) {
    console.log('Initializing Express app with ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);
    app = await initializeApp();
    initTime = now;
  }
  
  // Create serverless handler
  const serverlessHandler = serverless(app, {
    binary: ['image/*', 'application/pdf', 'application/octet-stream'],
    request: (request, event, context) => {
      // Add AWS context to request for potential use in controllers
      request.aws = {
        event,
        context
      };
    }
  });
  
  return serverlessHandler(event, context);
};

module.exports = { handler };