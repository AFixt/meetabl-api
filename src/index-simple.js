/**
 * Simplified meetabl API Server for Local Development
 * Provides basic endpoints for testing the development environment
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'meetabl API Server - Development Mode',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Mock authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Mock login validation
  if (email === 'demo@meetabl.com' && password === 'demo123') {
    res.json({
      success: true,
      user: {
        id: 1,
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@meetabl.com',
        username: 'demo'
      },
      token: 'mock_jwt_token_for_development'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

app.post('/api/auth/signup', (req, res) => {
  const { firstName, lastName, email, username, password } = req.body;
  
  // Mock signup
  res.status(201).json({
    success: true,
    user: {
      id: Date.now(), // Mock ID
      firstName,
      lastName,
      email,
      username
    },
    token: 'mock_jwt_token_for_development'
  });
});

// Mock bookings endpoints
app.get('/api/bookings', (req, res) => {
  res.json({
    bookings: [
      {
        id: 1,
        title: 'Demo Meeting',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
        status: 'confirmed',
        attendeeName: 'Test Attendee',
        attendeeEmail: 'attendee@example.com'
      }
    ],
    total: 1
  });
});

// Mock availability endpoints
app.get('/api/availability/:username', (req, res) => {
  const { username } = req.params;
  const date = req.query.date || new Date().toISOString().split('T')[0];
  
  // Generate mock time slots
  const slots = [];
  for (let hour = 9; hour < 17; hour++) {
    slots.push({
      startTime: `${date}T${hour.toString().padStart(2, '0')}:00:00Z`,
      endTime: `${date}T${(hour + 1).toString().padStart(2, '0')}:00:00Z`,
      available: Math.random() > 0.3 // Randomly available
    });
  }
  
  res.json(slots);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 meetabl API Server started successfully!');
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log('💡 This is a simplified server for development testing');
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /                    - Server status');
  console.log('  GET  /api/status          - API health check');
  console.log('  POST /api/auth/login      - Mock login');
  console.log('  POST /api/auth/signup     - Mock signup');
  console.log('  GET  /api/bookings        - Mock bookings');
  console.log('  GET  /api/availability/:username - Mock availability');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});