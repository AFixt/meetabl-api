/**
 * Logging middleware
 * 
 * Provides comprehensive HTTP request/response logging with structured data
 * 
 * @author meetabl Team
 */

const { createLogger } = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

const logger = createLogger('http');

/**
 * HTTP request logging middleware
 */
const requestLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  // Add request ID to request object for tracing
  req.requestId = requestId;
  
  // Extract useful information from request
  const requestInfo = {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    protocol: req.protocol,
    secure: req.secure,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    acceptLanguage: req.get('Accept-Language'),
    timestamp: new Date().toISOString()
  };

  // Add user information if available (after auth middleware)
  if (req.user) {
    requestInfo.userId = req.user.id;
    requestInfo.userEmail = req.user.email;
    requestInfo.userRole = req.user.role;
  }

  // Log request start
  logger.http('Request started', requestInfo);

  // Override res.end to capture response information
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const responseInfo = {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      contentLength: res.get('Content-Length'),
      duration,
      timestamp: new Date().toISOString()
    };

    // Add user information if available
    if (req.user) {
      responseInfo.userId = req.user.id;
    }

    // Determine log level based on status code
    let logLevel = 'http';
    let message = 'Request completed';
    
    if (res.statusCode >= 400 && res.statusCode < 500) {
      logLevel = 'warn';
      message = 'Request completed with client error';
    } else if (res.statusCode >= 500) {
      logLevel = 'error';
      message = 'Request completed with server error';
    }

    // Log response
    logger[logLevel](message, responseInfo);

    // Log slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        ...responseInfo,
        type: 'performance',
        issue: 'slow_request'
      });
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Error logging middleware
 */
const errorLoggingMiddleware = (err, req, res, next) => {
  const errorInfo = {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    statusCode: err.statusCode || 500,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  };

  // Add user information if available
  if (req.user) {
    errorInfo.userId = req.user.id;
    errorInfo.userEmail = req.user.email;
  }

  // Add request body for POST/PUT requests (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    sensitiveFields.forEach(field => {
      Object.keys(sanitizedBody).forEach(key => {
        if (key.toLowerCase().includes(field)) {
          sanitizedBody[key] = '[REDACTED]';
        }
      });
    });
    
    errorInfo.requestBody = sanitizedBody;
  }

  logger.error('Request error', errorInfo);

  // Security logging for authentication/authorization errors
  if (err.statusCode === 401 || err.statusCode === 403) {
    logger.security('access_denied', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      reason: err.message
    });
  }

  next(err);
};

/**
 * Business event logging helper
 */
const logBusinessEvent = (event, details = {}, req = null) => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };

  // Add request context if available
  if (req) {
    logData.requestId = req.requestId;
    logData.ip = req.ip;
    logData.userAgent = req.get('User-Agent');
    
    if (req.user) {
      logData.userId = req.user.id;
      logData.userEmail = req.user.email;
    }
  }

  logger.business(event, logData);
};

/**
 * Audit event logging helper
 */
const logAuditEvent = (event, details = {}, req = null) => {
  const auditData = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };

  // Add request context if available
  if (req) {
    auditData.requestId = req.requestId;
    auditData.ip = req.ip;
    auditData.userAgent = req.get('User-Agent');
    
    if (req.user) {
      auditData.userId = req.user.id;
      auditData.userEmail = req.user.email;
    }
  }

  logger.auditLog(event, auditData);
};

/**
 * Security event logging helper
 */
const logSecurityEvent = (event, details = {}, req = null) => {
  const securityData = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };

  // Add request context if available
  if (req) {
    securityData.requestId = req.requestId;
    securityData.ip = req.ip;
    securityData.userAgent = req.get('User-Agent');
    
    if (req.user) {
      securityData.userId = req.user.id;
      securityData.userEmail = req.user.email;
    }
  }

  logger.security(event, securityData);
};

/**
 * Performance logging helper
 */
const logPerformance = (operation, duration, details = {}, req = null) => {
  const performanceData = {
    operation,
    duration,
    timestamp: new Date().toISOString(),
    ...details
  };

  // Add request context if available
  if (req) {
    performanceData.requestId = req.requestId;
    
    if (req.user) {
      performanceData.userId = req.user.id;
    }
  }

  logger.performance(operation, duration, performanceData);
};

/**
 * Database query logging wrapper
 */
const logDatabaseQuery = (query, duration, result = null, error = null) => {
  const queryData = {
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    duration,
    timestamp: new Date().toISOString(),
    success: !error
  };

  if (result) {
    queryData.rowCount = result.rowCount || result.length;
  }

  if (error) {
    queryData.error = {
      name: error.name,
      message: error.message
    };
  }

  // Extract operation and table from query
  const operationMatch = query.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i);
  const tableMatch = query.match(/(?:FROM|UPDATE|INSERT INTO|DELETE FROM)\s+`?(\w+)`?/i);
  
  if (operationMatch) queryData.operation = operationMatch[1].toLowerCase();
  if (tableMatch) queryData.table = tableMatch[1];

  if (error) {
    logger.error('Database query failed', queryData);
  } else if (duration > 1000) {
    logger.warn('Slow database query', queryData);
  } else {
    logger.debug('Database query executed', queryData);
  }
};

module.exports = {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  logBusinessEvent,
  logAuditEvent,
  logSecurityEvent,
  logPerformance,
  logDatabaseQuery
};