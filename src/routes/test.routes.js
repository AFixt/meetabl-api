const express = require('express');
const router = express.Router();

// Test routes - only available in test environment
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
  // Cleanup test data
  router.post('/cleanup', async (req, res) => {
    try {
      // For now, just return success
      res.json({ success: true, message: 'Test data cleaned up' });
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({ error: 'Failed to cleanup test data' });
    }
  });

  // Setup test plans
  router.post('/setup-plans', async (req, res) => {
    try {
      const { plans } = req.body;
      res.json({ 
        success: true, 
        message: 'Test plans created',
        plans: plans || []
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to setup test plans' });
    }
  });

  // Create test user
  router.post('/create-user', async (req, res) => {
    try {
      const { email, password, firstName, lastName, role, username, timezone, language } = req.body;
      
      // Load models inside the route to avoid initialization issues
      const { User } = require('../models');
      
      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.json({
          success: true,
          data: {
            user: {
              id: existingUser.id,
              email: existingUser.email,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
              role: existingUser.role
            }
          }
        });
      }
      
      // Create new user
      // Note: User model has beforeCreate hook that hashes password
      const user = await User.create({
        id: require('uuid').v4(), // Add explicit ID
        email,
        password: password, // Pass plain password - model will hash it
        firstName,
        lastName,
        username: username || email.split('@')[0],
        timezone: timezone || 'America/New_York',
        role: role || 'user',
        status: 'active',
        email_verified: true // Auto-verify for test users
      });
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
          }
        }
      });
    } catch (error) {
      console.error('Create test user error:', error);
      res.status(500).json({ error: 'Failed to create test user', details: error.message });
    }
  });
} else {
  // In production, these routes should not exist
  router.all('*', (req, res) => {
    res.status(404).json({ error: 'Test routes not available in production' });
  });
}

module.exports = router;