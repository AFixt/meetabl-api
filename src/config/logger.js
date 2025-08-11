/**
 * Enhanced logging configuration
 *
 * Provides comprehensive logging with structured output, multiple transports,
 * log rotation, and centralized configuration
 *
 * @author meetabl Team
 */

const bunyan = require('bunyan');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Log configuration
const LOG_CONFIG = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  datePattern: 'YYYY-MM-DD',
  format: process.env.LOG_FORMAT || 'json', // json, pretty, simple
  enableConsole: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
  enableFile: process.env.ENABLE_FILE_LOGGING !== 'false',
  enableAudit: process.env.ENABLE_AUDIT_LOGGING !== 'false'
};

// Environment checks
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const isDevelopment = process.env.NODE_ENV === 'development';

// Create logs directory structure (only in non-Lambda environments)
const isLambda = !!process.env.LAMBDA_TASK_ROOT || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const logsDir = isLambda ? '/tmp/logs' : path.join(__dirname, '../../logs');
const auditDir = path.join(logsDir, 'audit');
const errorDir = path.join(logsDir, 'errors');

const ensureDirectories = () => {
  // Skip directory creation in Lambda or if logs are disabled
  if (isLambda || process.env.DISABLE_FILE_LOGS === 'true') {
    return;
  }
  
  [logsDir, auditDir, errorDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDirectories();

// Custom serializers for better logging
const customSerializers = {
  ...bunyan.stdSerializers,
  user: (user) => {
    if (!user) return user;
    return {
      id: user.id,
      email: user.email ? user.email.substring(0, 3) + '***' : undefined,
      role: user.role
    };
  },
  booking: (booking) => {
    if (!booking) return booking;
    return {
      id: booking.id,
      hostId: booking.hostId,
      status: booking.status,
      startTime: booking.startTime
    };
  },
  payment: (payment) => {
    if (!payment) return payment;
    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      // Never log sensitive payment data
      ...(payment.stripePaymentIntentId && { hasStripeIntent: true })
    };
  }
};

// Winston logger for structured logging with multiple transports
const createWinstonLogger = () => {
  const transports = [];

  // Console transport
  if (LOG_CONFIG.enableConsole && !isTest) {
    transports.push(
      new winston.transports.Console({
        level: LOG_CONFIG.level,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          isDevelopment
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
              )
            : winston.format.json()
        )
      })
    );
  }

  // File transports (disabled in Lambda)
  if (LOG_CONFIG.enableFile && !isLambda) {
    // Application logs
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'application-%DATE%.log'),
        datePattern: LOG_CONFIG.datePattern,
        maxSize: LOG_CONFIG.maxSize,
        maxFiles: LOG_CONFIG.maxFiles,
        level: LOG_CONFIG.level,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      })
    );

    // Error logs
    transports.push(
      new DailyRotateFile({
        filename: path.join(errorDir, 'error-%DATE%.log'),
        datePattern: LOG_CONFIG.datePattern,
        maxSize: LOG_CONFIG.maxSize,
        maxFiles: LOG_CONFIG.maxFiles,
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      })
    );

    // HTTP access logs
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'access-%DATE%.log'),
        datePattern: LOG_CONFIG.datePattern,
        maxSize: LOG_CONFIG.maxSize,
        maxFiles: LOG_CONFIG.maxFiles,
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    );
  }

  return winston.createLogger({
    level: LOG_CONFIG.level,
    defaultMeta: {
      service: 'meetabl-api',
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      hostname: require('os').hostname(),
      pid: process.pid
    },
    transports,
    exceptionHandlers: [
      new winston.transports.File({
        filename: path.join(errorDir, 'exceptions.log')
      })
    ],
    rejectionHandlers: [
      new winston.transports.File({
        filename: path.join(errorDir, 'rejections.log')
      })
    ]
  });
};

// Bunyan logger for backward compatibility
const createBunyanLogger = () => {
  const streams = [];

  // Console stream for development
  if (LOG_CONFIG.enableConsole && !isTest) {
    streams.push({
      level: LOG_CONFIG.level,
      stream: process.stdout
    });
  }

  // File streams (disabled in Lambda)
  if (LOG_CONFIG.enableFile && !isLambda) {
    streams.push(
      {
        level: LOG_CONFIG.level,
        type: 'rotating-file',
        path: path.join(logsDir, 'bunyan.log'),
        period: '1d',
        count: 14
      },
      {
        level: 'error',
        type: 'rotating-file',
        path: path.join(errorDir, 'bunyan-error.log'),
        period: '1d',
        count: 14
      }
    );
  }

  return bunyan.createLogger({
    name: 'meetabl-api',
    level: LOG_CONFIG.level,
    serializers: customSerializers,
    streams
  });
};

// Audit logger for security and compliance
const createAuditLogger = () => {
  if (!LOG_CONFIG.enableAudit) {
    return {
      info: () => {},
      warn: () => {},
      error: () => {}
    };
  }

  return winston.createLogger({
    level: 'info',
    defaultMeta: {
      type: 'audit',
      service: 'meetabl-api',
      environment: process.env.NODE_ENV
    },
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new DailyRotateFile({
        filename: path.join(auditDir, 'audit-%DATE%.log'),
        datePattern: LOG_CONFIG.datePattern,
        maxSize: LOG_CONFIG.maxSize,
        maxFiles: '365d', // Keep audit logs for 1 year
        level: 'info'
      })
    ]
  });
};

// Create loggers
const winstonLogger = createWinstonLogger();
const bunyanLogger = createBunyanLogger();
const auditLogger = createAuditLogger();

// Enhanced logger interface
class EnhancedLogger {
  constructor() {
    this.winston = winstonLogger;
    this.bunyan = bunyanLogger;
    this.audit = auditLogger;
  }

  // Standard log levels
  debug(message, meta = {}) {
    this.winston.debug(message, meta);
    this.bunyan.debug(meta, message);
  }

  info(message, meta = {}) {
    this.winston.info(message, meta);
    this.bunyan.info(meta, message);
  }

  warn(message, meta = {}) {
    this.winston.warn(message, meta);
    this.bunyan.warn(meta, message);
  }

  error(message, meta = {}) {
    this.winston.error(message, meta);
    this.bunyan.error(meta, message);
  }

  // HTTP access logging
  http(message, meta = {}) {
    this.winston.http(message, { ...meta, type: 'http' });
  }

  // Audit logging for security events
  auditLog(event, details = {}) {
    const auditEntry = {
      event,
      timestamp: new Date().toISOString(),
      ...details
    };
    this.audit.info('Audit event', auditEntry);
  }

  // Performance logging
  performance(operation, duration, meta = {}) {
    this.info(`Performance: ${operation}`, {
      ...meta,
      type: 'performance',
      operation,
      duration,
      slow: duration > 1000
    });
  }

  // Business event logging
  business(event, details = {}) {
    this.info(`Business event: ${event}`, {
      ...details,
      type: 'business',
      event
    });
  }

  // Security event logging
  security(event, details = {}) {
    this.warn(`Security event: ${event}`, {
      ...details,
      type: 'security',
      event
    });
    this.auditLog(`security_${event}`, details);
  }

  // Create child logger with additional context
  child(context = {}) {
    const childLogger = new EnhancedLogger();
    childLogger.winston = this.winston.child(context);
    childLogger.bunyan = this.bunyan.child(context);
    return childLogger;
  }
}

// Export the enhanced logger
const logger = new EnhancedLogger();

// Add backward compatibility
logger.debug.bind = logger.debug.bind(logger);
logger.info.bind = logger.info.bind(logger);
logger.warn.bind = logger.warn.bind(logger);
logger.error.bind = logger.error.bind(logger);

// Factory function for creating loggers with context
const createLogger = (context) => {
  if (typeof context === 'string') {
    return logger.child({ component: context });
  }
  return logger.child(context || {});
};

// Log configuration on startup
logger.info('Logger initialized', {
  config: {
    level: LOG_CONFIG.level,
    environment: process.env.NODE_ENV,
    enableConsole: LOG_CONFIG.enableConsole,
    enableFile: LOG_CONFIG.enableFile,
    enableAudit: LOG_CONFIG.enableAudit
  }
});

module.exports = logger;
module.exports.createLogger = createLogger;
module.exports.auditLogger = auditLogger;
module.exports.config = LOG_CONFIG;
