/**
 * Validation middleware tests
 * 
 * @author AccessMeet Team
 */

const { validateRequest } = require('../../../src/middlewares/validation');
const { body, validationResult } = require('express-validator');
const { mockRequest, mockResponse } = require('../../fixtures/mocks');

describe('Validation Middleware', () => {
  test('should pass validation with valid data', async () => {
    // Define validation rules
    const validationRules = [
      body('name').notEmpty().withMessage('Name is required'),
      body('email').isEmail().withMessage('Invalid email format')
    ];
    
    // Create valid request
    const req = mockRequest({
      body: {
        name: 'Test User',
        email: 'test@example.com'
      }
    });
    const res = mockResponse();
    const next = jest.fn();

    // Apply validation rules
    await Promise.all(validationRules.map(validation => validation.run(req)));
    
    // Execute validateRequest middleware
    validateRequest(req, res, next);

    // Should call next() if validation passes
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('should reject validation with invalid data', async () => {
    // Define validation rules
    const validationRules = [
      body('name').notEmpty().withMessage('Name is required'),
      body('email').isEmail().withMessage('Invalid email format')
    ];
    
    // Create invalid request
    const req = mockRequest({
      body: {
        name: '',
        email: 'invalid-email'
      }
    });
    const res = mockResponse();
    const next = jest.fn();

    // Apply validation rules
    await Promise.all(validationRules.map(validation => validation.run(req)));
    
    // Execute validateRequest middleware
    validateRequest(req, res, next);

    // Should return error response if validation fails
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.error).toBeDefined();
    expect(responseData.error.code).toBe('bad_request');
    expect(responseData.error.params.length).toBeGreaterThan(0); // At least one validation error
  });

  test('should sanitize data', async () => {
    // Define validation rules with sanitization
    const validationRules = [
      body('name').trim().notEmpty(),
      body('email').normalizeEmail().isEmail()
    ];
    
    // Create request with data to sanitize
    const req = mockRequest({
      body: {
        name: '  Test User  ',
        email: 'TEST@EXAMPLE.COM'
      }
    });
    const res = mockResponse();
    const next = jest.fn();

    // Apply validation rules with sanitization
    await Promise.all(validationRules.map(validation => validation.run(req)));
    
    // Execute validateRequest middleware
    validateRequest(req, res, next);

    // Should sanitize data and call next()
    expect(next).toHaveBeenCalled();
    expect(req.body.name).toBe('Test User'); // Trimmed
    expect(req.body.email.toLowerCase()).toContain('test@'); // Normalized
  });
});