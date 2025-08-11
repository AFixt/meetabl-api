/**
 * CSRF Middleware Unit Tests
 */

const { 
  initializeCsrf, 
  protectCsrf, 
  provideCsrfToken,
  generateSecret,
  generateToken,
  verifyToken
} = require('../../../src/middlewares/csrf');

describe('CSRF Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'POST',
      url: '/api/test',
      ip: '127.0.0.1',
      headers: {},
      body: {},
      query: {},
      session: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('generateSecret', () => {
    test('should generate a secret', () => {
      const secret = generateSecret();
      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
    });
  });

  describe('generateToken', () => {
    test('should generate a token from secret', () => {
      const secret = generateSecret();
      const token = generateToken(secret);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('verifyToken', () => {
    test('should verify valid token', () => {
      const secret = generateSecret();
      const token = generateToken(secret);
      const isValid = verifyToken(secret, token);
      expect(isValid).toBe(true);
    });

    test('should reject invalid token', () => {
      const secret = generateSecret();
      const isValid = verifyToken(secret, 'invalid-token');
      expect(isValid).toBe(false);
    });

    test('should reject token with wrong secret', () => {
      const secret1 = generateSecret();
      const secret2 = generateSecret();
      const token = generateToken(secret1);
      const isValid = verifyToken(secret2, token);
      expect(isValid).toBe(false);
    });
  });

  describe('initializeCsrf', () => {
    test('should initialize CSRF secret in session', () => {
      req.session = {};
      
      initializeCsrf(req, res, next);
      
      expect(req.session.csrfSecret).toBeDefined();
      expect(typeof req.session.csrfSecret).toBe('string');
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should not overwrite existing CSRF secret', () => {
      const existingSecret = 'existing-secret';
      req.session = { csrfSecret: existingSecret };
      
      initializeCsrf(req, res, next);
      
      expect(req.session.csrfSecret).toBe(existingSecret);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should create session if not exists', () => {
      req.session = null;
      
      initializeCsrf(req, res, next);
      
      expect(req.session).toBeDefined();
      expect(req.session.csrfSecret).toBeDefined();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('provideCsrfToken', () => {
    test('should provide CSRF token when secret exists', () => {
      const secret = generateSecret();
      req.session = { csrfSecret: secret };
      
      provideCsrfToken(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        csrfToken: expect.any(String)
      });
    });

    test('should return error when no secret', () => {
      req.session = {};
      
      provideCsrfToken(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'csrf_not_initialized',
          message: 'CSRF protection not initialized'
        }
      });
    });
  });

  describe('protectCsrf', () => {
    test('should allow GET requests without CSRF token', () => {
      req.method = 'GET';
      
      protectCsrf(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should allow HEAD requests without CSRF token', () => {
      req.method = 'HEAD';
      
      protectCsrf(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should allow OPTIONS requests without CSRF token', () => {
      req.method = 'OPTIONS';
      
      protectCsrf(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should allow requests with JWT Bearer token', () => {
      req.headers.authorization = 'Bearer jwt-token';
      
      protectCsrf(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should reject POST requests without secret', () => {
      req.session = {};
      
      protectCsrf(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'csrf_no_secret',
          message: 'CSRF protection not initialized'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject requests without CSRF token', () => {
      const secret = generateSecret();
      req.session = { csrfSecret: secret };
      
      protectCsrf(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'csrf_token_missing',
          message: 'CSRF token required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject requests with invalid CSRF token', () => {
      const secret = generateSecret();
      req.session = { csrfSecret: secret };
      req.headers['x-csrf-token'] = 'invalid-token';
      
      protectCsrf(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'csrf_token_invalid',
          message: 'Invalid CSRF token'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow requests with valid CSRF token in header', () => {
      const secret = generateSecret();
      const token = generateToken(secret);
      req.session = { csrfSecret: secret };
      req.headers['x-csrf-token'] = token;
      
      protectCsrf(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should allow requests with valid CSRF token in x-xsrf-token header', () => {
      const secret = generateSecret();
      const token = generateToken(secret);
      req.session = { csrfSecret: secret };
      req.headers['x-xsrf-token'] = token;
      
      protectCsrf(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should allow requests with valid CSRF token in body', () => {
      const secret = generateSecret();
      const token = generateToken(secret);
      req.session = { csrfSecret: secret };
      req.body = { _csrf: token };
      
      protectCsrf(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should allow requests with valid CSRF token in query', () => {
      const secret = generateSecret();
      const token = generateToken(secret);
      req.session = { csrfSecret: secret };
      req.query = { _csrf: token };
      
      protectCsrf(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});