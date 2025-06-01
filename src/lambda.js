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

/**
 * Lambda handler function
 * Initializes the Express app on cold start and handles requests
 */
const handler = async (event, context) => {
  // Initialize app on cold start
  if (!app) {
    app = await initializeApp();
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