/**
 * User Routes Tests
 * 
 * Tests for user route definitions and middleware setup
 * 
 * @author meetabl Team
 */

const express = require('express');
const request = require('supertest');

// Mock the controller functions
jest.mock('../../../src/controllers/user.controller', () => ({
  getUserProfile: jest.fn((req, res) => res.status(200).json({ user: { id: 1, name: 'Test' } })),
  updateUserProfile: jest.fn((req, res) => res.status(200).json({ message: 'Profile updated' })),
  deleteUser: jest.fn((req, res) => res.status(200).json({ message: 'User deleted' })),
  changePassword: jest.fn((req, res) => res.status(200).json({ message: 'Password changed' })),
  uploadAvatar: jest.fn((req, res) => res.status(200).json({ message: 'Avatar uploaded' })),
  getUserSettings: jest.fn((req, res) => res.status(200).json({ settings: {} })),
  updateUserSettings: jest.fn((req, res) => res.status(200).json({ message: 'Settings updated' })),
  getUsers: jest.fn((req, res) => res.status(200).json({ users: [] })),
  getUserById: jest.fn((req, res) => res.status(200).json({ user: {} }))
}));

// Mock validation middleware
jest.mock('../../../src/middlewares/validation', () => ({
  validateUpdateProfile: jest.fn((req, res, next) => next()),
  validateChangePassword: jest.fn((req, res, next) => next()),
  validateUserSettings: jest.fn((req, res, next) => next()),
  validateUserId: jest.fn((req, res, next) => next())
}));

// Mock auth middleware
jest.mock('../../../src/middlewares/auth', () => ({
  authenticateJWT: jest.fn((req, res, next) => {
    req.user = { id: 1 };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next())
}));

// Mock upload middleware
jest.mock('../../../src/middlewares/upload', () => ({
  uploadAvatar: jest.fn((req, res, next) => next())
}));

// Import the routes after mocking
const userRoutes = require('../../../src/routes/user.routes');
const userController = require('../../../src/controllers/user.controller');
const validation = require('../../../src/middlewares/validation');
const { authenticateJWT, requireRole } = require('../../../src/middlewares/auth');
const { uploadAvatar } = require('../../../src/middlewares/upload');

describe('User Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/users', userRoutes);
    jest.clearAllMocks();
  });

  describe('GET /users/profile', () => {
    test('should have profile route with authentication', async () => {
      const response = await request(app)
        .get('/users/profile')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(userController.getUserProfile).toHaveBeenCalled();
    });
  });

  describe('PUT /users/profile', () => {
    test('should have update profile route with validation', async () => {
      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateUpdateProfile).toHaveBeenCalled();
      expect(userController.updateUserProfile).toHaveBeenCalled();
    });
  });

  describe('DELETE /users/profile', () => {
    test('should have delete user route with authentication', async () => {
      const response = await request(app)
        .delete('/users/profile')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(userController.deleteUser).toHaveBeenCalled();
    });
  });

  describe('POST /users/change-password', () => {
    test('should have change password route with validation', async () => {
      const response = await request(app)
        .post('/users/change-password')
        .set('Authorization', 'Bearer token')
        .send({
          currentPassword: 'oldpass',
          newPassword: 'newpass123'
        });

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateChangePassword).toHaveBeenCalled();
      expect(userController.changePassword).toHaveBeenCalled();
    });
  });

  describe('POST /users/avatar', () => {
    test('should have avatar upload route with upload middleware', async () => {
      const response = await request(app)
        .post('/users/avatar')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(uploadAvatar).toHaveBeenCalled();
      expect(userController.uploadAvatar).toHaveBeenCalled();
    });
  });

  describe('GET /users/settings', () => {
    test('should have get settings route with authentication', async () => {
      const response = await request(app)
        .get('/users/settings')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(userController.getUserSettings).toHaveBeenCalled();
    });
  });

  describe('PUT /users/settings', () => {
    test('should have update settings route with validation', async () => {
      const response = await request(app)
        .put('/users/settings')
        .set('Authorization', 'Bearer token')
        .send({ timezone: 'UTC' });

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateUserSettings).toHaveBeenCalled();
      expect(userController.updateUserSettings).toHaveBeenCalled();
    });
  });

  describe('GET /users', () => {
    test('should have list users route with admin role', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(requireRole).toHaveBeenCalledWith('admin');
      expect(userController.getUsers).toHaveBeenCalled();
    });
  });

  describe('GET /users/:id', () => {
    test('should have get user by id route with validation', async () => {
      const response = await request(app)
        .get('/users/123')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(authenticateJWT).toHaveBeenCalled();
      expect(validation.validateUserId).toHaveBeenCalled();
      expect(userController.getUserById).toHaveBeenCalled();
    });
  });
});