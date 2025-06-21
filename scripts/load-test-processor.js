/**
 * Artillery Load Test Processor
 * Provides custom functions for the load test scenarios
 */

const crypto = require('crypto');

module.exports = {
  /**
   * Generate a random string for unique values
   */
  $randomString: function(context, events, done) {
    context.vars.randomString = crypto.randomBytes(8).toString('hex');
    return done();
  },
  
  /**
   * Generate a random number between min and max
   */
  $randomNumber: function(context, events, done) {
    const min = 1;
    const max = 10000;
    context.vars.randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    return done();
  },
  
  /**
   * Generate a date offset from now
   */
  $dateOffset: function(context, events, done) {
    const days = context.vars.offsetDays || 1;
    const hours = context.vars.offsetHours || 0;
    
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(date.getHours() + hours);
    
    context.vars.dateOffset = date.toISOString();
    return done();
  },
  
  /**
   * Before request hook - can modify request data
   */
  beforeRequest: function(requestParams, context, ee, next) {
    // Add correlation ID to all requests
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['X-Correlation-ID'] = `load-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Log request for debugging (in verbose mode)
    if (process.env.DEBUG) {
      console.log(`Request: ${requestParams.method} ${requestParams.url}`);
    }
    
    return next();
  },
  
  /**
   * After response hook - can process response data
   */
  afterResponse: function(requestParams, response, context, ee, next) {
    // Track custom metrics
    if (response.statusCode >= 400) {
      ee.emit('counter', 'http.errors.' + response.statusCode, 1);
    }
    
    // Log errors for debugging
    if (response.statusCode >= 500) {
      console.error(`Server Error: ${requestParams.method} ${requestParams.url} - Status: ${response.statusCode}`);
      if (response.body && process.env.DEBUG) {
        console.error('Response:', response.body);
      }
    }
    
    return next();
  },
  
  /**
   * Custom function to generate realistic booking data
   */
  generateBookingData: function(context, events, done) {
    const titles = [
      'Strategy Meeting',
      'Project Review',
      'Client Consultation',
      'Team Sync',
      'Performance Review',
      'Planning Session',
      'Technical Discussion',
      'Product Demo',
      'Training Session',
      'Quarterly Review'
    ];
    
    const descriptions = [
      'Discuss project progress and next steps',
      'Review current status and plan ahead',
      'Align on objectives and deliverables',
      'Sync up on current tasks and blockers',
      'Evaluate performance and set goals',
      'Plan upcoming sprint activities',
      'Technical architecture discussion',
      'Demonstrate new features to stakeholders',
      'Knowledge sharing and skill development',
      'Review quarterly goals and achievements'
    ];
    
    context.vars.bookingTitle = titles[Math.floor(Math.random() * titles.length)];
    context.vars.bookingDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
    
    // Generate future date/time for booking
    const startDate = new Date();
    const daysAhead = Math.floor(Math.random() * 30) + 1; // 1-30 days in future
    const startHour = Math.floor(Math.random() * 8) + 9; // 9 AM - 5 PM
    
    startDate.setDate(startDate.getDate() + daysAhead);
    startDate.setHours(startHour, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1); // 1 hour meeting
    
    context.vars.bookingStartTime = startDate.toISOString();
    context.vars.bookingEndTime = endDate.toISOString();
    
    return done();
  },
  
  /**
   * Setup function - runs once before the test
   */
  setupTestData: function(context, events, done) {
    console.log('Load test starting...');
    console.log(`Target: ${context.vars.target}`);
    console.log(`Scenarios: ${context.scenarios.length}`);
    
    // Initialize any global test data
    context.vars.testStartTime = Date.now();
    
    return done();
  },
  
  /**
   * Cleanup function - runs once after the test
   */
  cleanupTestData: function(context, events, done) {
    const duration = Date.now() - context.vars.testStartTime;
    console.log(`Load test completed in ${duration}ms`);
    
    return done();
  }
};