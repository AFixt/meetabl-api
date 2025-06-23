# Security Best Practices

This document outlines essential security guidelines and best practices for developers working with the meetabl API. Following these practices helps ensure the security, privacy, and integrity of user data and system operations.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [API Security](#api-security)
3. [Data Protection](#data-protection)
4. [Input Validation](#input-validation)
5. [Error Handling](#error-handling)
6. [Database Security](#database-security)
7. [Network Security](#network-security)
8. [Logging & Monitoring](#logging--monitoring)
9. [Dependency Management](#dependency-management)
10. [Development Environment](#development-environment)
11. [Deployment Security](#deployment-security)
12. [Incident Response](#incident-response)

## Authentication & Authorization

### JWT Token Security

**Best Practices:**
- Use strong, randomly generated secrets for JWT signing
- Implement short token expiration times (15-30 minutes for access tokens)
- Always use refresh tokens for long-term authentication
- Store tokens securely (httpOnly cookies for web, secure storage for mobile)

```javascript
// ✅ Good: Secure token handling
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate strong secret
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Short-lived access token
const accessToken = jwt.sign(
  { userId: user.id, role: user.role },
  JWT_SECRET,
  { expiresIn: '15m', issuer: 'meetabl-api', audience: 'meetabl-app' }
);

// Longer-lived refresh token
const refreshToken = jwt.sign(
  { userId: user.id, type: 'refresh' },
  JWT_SECRET,
  { expiresIn: '7d' }
);
```

```javascript
// ❌ Bad: Insecure token practices
const token = jwt.sign({ userId: user.id }, 'weak-secret', { expiresIn: '30d' });
localStorage.setItem('token', token); // Vulnerable to XSS
```

### Password Security

**Requirements:**
- Minimum 8 characters with complexity requirements
- Use bcrypt with minimum 12 rounds for hashing
- Implement account lockout after failed attempts
- Support for password reset with secure tokens

```javascript
// ✅ Good: Secure password handling
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Hash password with sufficient rounds
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Generate secure password reset token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Validate password strength
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);
  
  return password.length >= minLength && hasUpperCase && 
         hasLowerCase && hasNumbers && hasNonalphas;
};
```

### Multi-Factor Authentication (MFA)

**Implementation:**
- Support TOTP (Time-based One-Time Password)
- Provide backup codes for account recovery
- Require MFA for sensitive operations

```javascript
// ✅ Good: MFA implementation
const speakeasy = require('speakeasy');

const generateMFASecret = () => {
  return speakeasy.generateSecret({
    name: 'meetabl',
    issuer: 'meetabl.com',
    length: 32
  });
};

const verifyMFAToken = (token, secret) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1 // Allow 1 step tolerance
  });
};
```

## API Security

### Rate Limiting

**Implementation:**
- Global rate limits (100 requests per 15 minutes)
- Endpoint-specific limits for sensitive operations
- User-based rate limiting for authenticated endpoints
- IP-based rate limiting for public endpoints

```javascript
// ✅ Good: Comprehensive rate limiting
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Global rate limiter
const globalLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limits for authentication endpoints
const authLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 auth attempts per window
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts, please try again later'
});
```

### CORS Configuration

**Security Settings:**
- Restrict origins to known domains only
- Disable credentials for public endpoints
- Use specific allowed headers and methods

```javascript
// ✅ Good: Secure CORS configuration
const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://app.meetabl.com',
      'https://meetabl.com',
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));
```

### Request Size Limits

```javascript
// ✅ Good: Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Specific limits for file uploads
const multer = require('multer');
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  }
});
```

## Data Protection

### Encryption

**Data at Rest:**
- Encrypt sensitive data using AES-256
- Use separate encryption keys per data type
- Implement key rotation policies

```javascript
// ✅ Good: Data encryption
const crypto = require('crypto');

class DataEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
  }

  encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setIV(iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData, key) {
    const decipher = crypto.createDecipher(this.algorithm, key);
    decipher.setIV(Buffer.from(encryptedData.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

**Data in Transit:**
- Always use HTTPS/TLS 1.2+
- Implement HSTS headers
- Use certificate pinning for critical connections

```javascript
// ✅ Good: HTTPS enforcement
const helmet = require('helmet');

app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));
```

### Personal Data Handling

**GDPR/Privacy Compliance:**
- Implement data minimization principles
- Provide data export functionality
- Support data deletion requests
- Maintain audit logs for data access

```javascript
// ✅ Good: Privacy-compliant data handling
class UserDataManager {
  async exportUserData(userId) {
    const userData = {
      profile: await User.findByPk(userId, {
        attributes: { exclude: ['password', 'resetToken'] }
      }),
      bookings: await Booking.findAll({ where: { userId } }),
      settings: await UserSettings.findOne({ where: { userId } })
    };
    
    // Log data export
    await AuditLog.create({
      userId,
      action: 'DATA_EXPORT',
      details: { timestamp: new Date() }
    });
    
    return userData;
  }

  async deleteUserData(userId) {
    const transaction = await sequelize.transaction();
    
    try {
      // Delete in proper order to respect foreign keys
      await UserSettings.destroy({ where: { userId }, transaction });
      await Booking.destroy({ where: { userId }, transaction });
      await User.destroy({ where: { id: userId }, transaction });
      
      // Log data deletion
      await AuditLog.create({
        userId,
        action: 'DATA_DELETION',
        details: { timestamp: new Date() }
      }, { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

## Input Validation

### Comprehensive Validation

**Always validate:**
- Data types and formats
- String lengths and patterns
- Numeric ranges
- Allowed values (enums)

```javascript
// ✅ Good: Comprehensive input validation
const { body, param, query, validationResult } = require('express-validator');

const validateBookingCreation = [
  body('title')
    .isLength({ min: 1, max: 200 })
    .escape()
    .withMessage('Title must be 1-200 characters'),
  
  body('start')
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (value <= new Date()) {
        throw new Error('Start time must be in the future');
      }
      return true;
    }),
  
  body('end')
    .isISO8601()
    .toDate()
    .custom((value, { req }) => {
      if (value <= req.body.start) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  
  body('attendeeEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address required'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .escape(),
  
  body('location')
    .optional()
    .isLength({ max: 200 })
    .escape()
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};
```

### SQL Injection Prevention

**Always use:**
- Parameterized queries
- ORM query builders
- Input sanitization

```javascript
// ✅ Good: SQL injection prevention
const { Op } = require('sequelize');

// Safe parameterized query
const findUserBookings = async (userId, startDate, endDate) => {
  return await Booking.findAll({
    where: {
      userId: userId,
      start: {
        [Op.between]: [startDate, endDate]
      }
    },
    order: [['start', 'ASC']]
  });
};

// ❌ Bad: Vulnerable to SQL injection
const findUserBookingsUnsafe = async (userId, startDate, endDate) => {
  const query = `SELECT * FROM bookings WHERE userId = ${userId} AND start BETWEEN '${startDate}' AND '${endDate}'`;
  return await sequelize.query(query);
};
```

### XSS Prevention

```javascript
// ✅ Good: XSS prevention
const xss = require('xss');
const DOMPurify = require('dompurify');

const sanitizeUserInput = (input) => {
  return xss(input, {
    whiteList: {
      // Allow only safe HTML tags
      p: [],
      br: [],
      strong: [],
      em: [],
      ul: [],
      ol: [],
      li: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  });
};

// Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
  );
  next();
});
```

## Error Handling

### Secure Error Responses

**Never expose:**
- Stack traces in production
- Database schema information
- Internal file paths
- Sensitive configuration details

```javascript
// ✅ Good: Secure error handling
const handleErrors = (err, req, res, next) => {
  // Log full error details internally
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Send sanitized error response
  if (process.env.NODE_ENV === 'production') {
    // Production: generic error messages
    const statusCode = err.statusCode || 500;
    const message = err.expose ? err.message : 'Internal server error';
    
    res.status(statusCode).json({
      error: message,
      code: err.code || 'INTERNAL_ERROR'
    });
  } else {
    // Development: detailed errors for debugging
    res.status(err.statusCode || 500).json({
      error: err.message,
      stack: err.stack,
      code: err.code
    });
  }
};

// Custom error classes
class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.details = details;
    this.expose = true;
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.code = 'AUTH_FAILED';
    this.expose = true;
  }
}
```

## Database Security

### Connection Security

```javascript
// ✅ Good: Secure database configuration
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: true
      } : false,
      connectTimeout: 10000,
      acquireTimeout: 10000,
      timeout: 10000
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  }
);
```

### Data Masking

```javascript
// ✅ Good: Sensitive data masking
const maskSensitiveData = (user) => {
  const maskedUser = { ...user.toJSON() };
  
  // Remove sensitive fields
  delete maskedUser.password;
  delete maskedUser.resetToken;
  delete maskedUser.mfaSecret;
  
  // Mask partial data
  if (maskedUser.email) {
    const [local, domain] = maskedUser.email.split('@');
    maskedUser.email = `${local.substring(0, 2)}***@${domain}`;
  }
  
  if (maskedUser.phoneNumber) {
    maskedUser.phoneNumber = maskedUser.phoneNumber.replace(/\d(?=\d{4})/g, '*');
  }
  
  return maskedUser;
};
```

## Network Security

### HTTPS Enforcement

```javascript
// ✅ Good: HTTPS enforcement
const forceHTTPS = (req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
};

app.use(forceHTTPS);
```

### Security Headers

```javascript
// ✅ Good: Comprehensive security headers
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["https://js.stripe.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

## Logging & Monitoring

### Security Event Logging

```javascript
// ✅ Good: Comprehensive security logging
const bunyan = require('bunyan');

const securityLogger = bunyan.createLogger({
  name: 'meetabl-security',
  level: 'info',
  streams: [
    {
      level: 'info',
      stream: process.stdout
    },
    {
      level: 'warn',
      path: '/var/log/meetabl-security.log'
    }
  ]
});

class SecurityEventLogger {
  static logAuthAttempt(email, success, ip, userAgent) {
    securityLogger.info({
      event: 'AUTH_ATTEMPT',
      email,
      success,
      ip,
      userAgent,
      timestamp: new Date().toISOString()
    });
  }

  static logPrivilegeEscalation(userId, action, ip) {
    securityLogger.warn({
      event: 'PRIVILEGE_ESCALATION',
      userId,
      action,
      ip,
      timestamp: new Date().toISOString()
    });
  }

  static logSuspiciousActivity(userId, activity, details, ip) {
    securityLogger.warn({
      event: 'SUSPICIOUS_ACTIVITY',
      userId,
      activity,
      details,
      ip,
      timestamp: new Date().toISOString()
    });
  }

  static logDataAccess(userId, resource, action, ip) {
    securityLogger.info({
      event: 'DATA_ACCESS',
      userId,
      resource,
      action,
      ip,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Monitoring Alerts

```javascript
// ✅ Good: Security monitoring
class SecurityMonitor {
  static async checkBruteForce(ip, email) {
    const key = `auth_attempts:${ip}:${email}`;
    const attempts = await redis.incr(key);
    
    if (attempts === 1) {
      await redis.expire(key, 900); // 15 minutes
    }
    
    if (attempts >= 5) {
      SecurityEventLogger.logSuspiciousActivity(
        null,
        'BRUTE_FORCE_ATTEMPT',
        { ip, email, attempts },
        ip
      );
      
      // Send alert to security team
      await this.sendSecurityAlert('Brute force detected', {
        ip,
        email,
        attempts
      });
      
      return true; // Block request
    }
    
    return false;
  }

  static async sendSecurityAlert(title, details) {
    // Implement alerting mechanism (email, Slack, PagerDuty, etc.)
    console.log(`SECURITY ALERT: ${title}`, details);
  }
}
```

## Dependency Management

### Package Security

```javascript
// package.json security configuration
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "security:check": "npm audit && npm run outdated",
    "outdated": "npm outdated"
  },
  "dependencies": {
    // Pin specific versions for security
    "express": "4.18.2",
    "helmet": "6.1.5"
  }
}
```

### Regular Security Updates

```bash
#!/bin/bash
# Security update script

echo "Running security audit..."
npm audit

echo "Checking for outdated packages..."
npm outdated

echo "Updating security patches..."
npm update --save

echo "Running tests after updates..."
npm test

echo "Security check complete!"
```

## Development Environment

### Environment Variables

```javascript
// ✅ Good: Secure environment configuration
const dotenv = require('dotenv');
const Joi = require('joi');

// Load environment variables
dotenv.config();

// Validate required environment variables
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  ENCRYPTION_KEY: Joi.string().length(64).required()
}).unknown();

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

module.exports = env;
```

### Secrets Management

```javascript
// ✅ Good: Secrets management
class SecretsManager {
  static getSecret(name) {
    const secret = process.env[name];
    
    if (!secret) {
      throw new Error(`Required secret ${name} not found`);
    }
    
    return secret;
  }

  static rotateSecret(name, newValue) {
    // Implement secret rotation logic
    // This would typically integrate with AWS Secrets Manager,
    // Azure Key Vault, or similar service
    console.log(`Rotating secret: ${name}`);
  }
}

// ❌ Bad: Hardcoded secrets
const JWT_SECRET = 'my-secret-key'; // Never do this!
```

## Deployment Security

### Production Checklist

**Before deploying to production:**

1. **Environment Configuration**
   - [ ] All secrets stored in environment variables
   - [ ] Debug mode disabled
   - [ ] Appropriate log levels set
   - [ ] Error handling configured for production

2. **Security Headers**
   - [ ] HTTPS enforced
   - [ ] Security headers configured
   - [ ] CORS properly restricted
   - [ ] CSP headers implemented

3. **Authentication & Authorization**
   - [ ] Strong JWT secrets
   - [ ] Token expiration configured
   - [ ] Rate limiting enabled
   - [ ] MFA implemented for admin accounts

4. **Database Security**
   - [ ] Database credentials secured
   - [ ] SSL/TLS enabled for database connections
   - [ ] Backup encryption enabled
   - [ ] Database access restricted

5. **Monitoring & Logging**
   - [ ] Security event logging enabled
   - [ ] Monitoring alerts configured
   - [ ] Log rotation configured
   - [ ] Audit trails enabled

### Docker Security

```dockerfile
# ✅ Good: Secure Dockerfile
FROM node:18-alpine AS builder

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S meetabl -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R meetabl:nodejs /app

# Switch to non-root user
USER meetabl

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "server.js"]
```

## Incident Response

### Security Incident Procedures

**When a security incident is detected:**

1. **Immediate Response (0-1 hour)**
   - Identify and contain the threat
   - Preserve evidence
   - Assess impact and scope
   - Notify security team

2. **Short-term Response (1-24 hours)**
   - Implement mitigation measures
   - Patch vulnerabilities
   - Reset compromised credentials
   - Document incident timeline

3. **Recovery (1-7 days)**
   - Restore normal operations
   - Monitor for related activity
   - Update security measures
   - Conduct lessons learned session

### Incident Response Code

```javascript
// ✅ Good: Incident response automation
class IncidentResponse {
  static async handleSecurityIncident(type, details) {
    const incident = {
      id: crypto.randomUUID(),
      type,
      details,
      timestamp: new Date().toISOString(),
      status: 'DETECTED'
    };

    // Log incident
    securityLogger.error('Security incident detected', incident);

    // Immediate automated response
    switch (type) {
      case 'BRUTE_FORCE':
        await this.blockIP(details.ip);
        break;
      case 'SUSPICIOUS_LOGIN':
        await this.lockUserAccount(details.userId);
        break;
      case 'DATA_BREACH':
        await this.enableEmergencyMode();
        break;
    }

    // Notify security team
    await this.notifySecurityTeam(incident);

    return incident;
  }

  static async blockIP(ip) {
    // Add IP to blocklist
    await redis.sadd('blocked_ips', ip);
    await redis.expire('blocked_ips', 86400); // 24 hours
  }

  static async lockUserAccount(userId) {
    await User.update(
      { isLocked: true, lockedAt: new Date() },
      { where: { id: userId } }
    );
  }

  static async enableEmergencyMode() {
    // Implement emergency procedures
    console.log('EMERGENCY MODE ACTIVATED');
  }
}
```

## Security Testing

### Automated Security Testing

```javascript
// Security test examples
const request = require('supertest');
const app = require('../app');

describe('Security Tests', () => {
  test('should prevent SQL injection', async () => {
    const response = await request(app)
      .get('/api/users/search')
      .query({ q: "'; DROP TABLE users; --" });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid input');
  });

  test('should enforce rate limiting', async () => {
    const requests = Array(10).fill().map(() =>
      request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrong'
      })
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  test('should require authentication for protected routes', async () => {
    const response = await request(app).get('/api/users/me');
    
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Authentication required');
  });
});
```

## Conclusion

Security is an ongoing process that requires constant attention and updates. Regularly review and update these practices based on:

- New security threats and vulnerabilities
- Industry best practices and standards
- Compliance requirements
- Security audit findings
- Team feedback and lessons learned

For security concerns or to report vulnerabilities, contact: security@meetabl.com

**Remember:** Security is everyone's responsibility. When in doubt, choose the more secure option.