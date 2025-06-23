# Comprehensive Logging Strategy

This document describes the enhanced logging infrastructure implemented in the meetabl API.

## Overview

The logging system provides:
- **Structured Logging**: JSON-formatted logs for easy parsing
- **Multiple Transports**: Console, file, and external service outputs
- **Log Rotation**: Automatic rotation and compression
- **Log Levels**: Configurable log levels per environment
- **Audit Logging**: Security and compliance event tracking
- **Performance Logging**: Request/response and database query monitoring
- **Error Tracking**: Comprehensive error capture and reporting

## Architecture

### Dual Logger Implementation

The system uses both Winston and Bunyan loggers:

- **Winston**: Primary logger with multiple transports and formatting
- **Bunyan**: Backward compatibility and structured JSON logging
- **Enhanced Logger**: Unified interface combining both loggers

### Log Types

1. **Application Logs**: General application events and debugging
2. **Access Logs**: HTTP request/response tracking
3. **Error Logs**: Error events and stack traces
4. **Audit Logs**: Security and compliance events
5. **Performance Logs**: Timing and performance metrics
6. **Business Logs**: Business logic events (bookings, payments, etc.)

## Configuration

### Environment Variables

```bash
# Log Level Configuration
LOG_LEVEL=info                    # debug, info, warn, error
LOG_FORMAT=json                   # json, pretty, simple
LOG_MAX_SIZE=20m                  # Maximum log file size
LOG_MAX_FILES=14d                 # Log retention period
LOG_RETENTION_DAYS=30             # Days to keep logs

# Enable/Disable Logging Types
ENABLE_CONSOLE_LOGGING=true       # Console output
ENABLE_FILE_LOGGING=true          # File output
ENABLE_AUDIT_LOGGING=true         # Audit logs
LOG_COMPRESSION=true              # Compress old logs
```

### Log Levels by Environment

```javascript
// Production
LOG_LEVEL=info

// Development
LOG_LEVEL=debug

// Test
LOG_LEVEL=error
```

## Log Structure

### Standard Log Format

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Request completed",
  "service": "meetabl-api",
  "environment": "production",
  "version": "1.0.0",
  "hostname": "api-server-01",
  "pid": 12345,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user123",
  "duration": 150,
  "statusCode": 200
}
```

### HTTP Request Logs

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "http",
  "message": "Request completed",
  "type": "http",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "url": "/api/bookings",
  "statusCode": 201,
  "duration": 150,
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "userId": "user123"
}
```

### Error Logs

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "error",
  "message": "Database connection failed",
  "type": "error",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": {
    "name": "ConnectionError",
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n    at..."
  },
  "userId": "user123"
}
```

### Audit Logs

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Audit event",
  "type": "audit",
  "event": "user_login",
  "userId": "user123",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "success": true
}
```

## Usage Examples

### Basic Logging

```javascript
const { createLogger } = require('../config/logger');
const logger = createLogger('booking-service');

// Standard log levels
logger.debug('Debug information', { bookingId: '123' });
logger.info('Booking created successfully', { bookingId: '123' });
logger.warn('Low availability detected', { availableSlots: 2 });
logger.error('Booking validation failed', { error: error.message });
```

### Business Event Logging

```javascript
const { logBusinessEvent } = require('../middlewares/logging');

// Log business events
logBusinessEvent('booking_created', {
  bookingId: booking.id,
  userId: user.id,
  amount: booking.amount
}, req);

logBusinessEvent('payment_processed', {
  paymentId: payment.id,
  amount: payment.amount,
  currency: payment.currency
}, req);
```

### Audit Logging

```javascript
const { logAuditEvent } = require('../middlewares/logging');

// Log security and compliance events
logAuditEvent('user_login', {
  userId: user.id,
  method: 'password',
  success: true
}, req);

logAuditEvent('data_access', {
  userId: user.id,
  resource: 'user_profile',
  action: 'read'
}, req);
```

### Performance Logging

```javascript
const { logPerformance } = require('../middlewares/logging');

const startTime = Date.now();
// ... perform operation
const duration = Date.now() - startTime;

logPerformance('database_query', duration, {
  query: 'SELECT * FROM bookings',
  resultCount: results.length
}, req);
```

### Security Logging

```javascript
const { logSecurityEvent } = require('../middlewares/logging');

// Log security events
logSecurityEvent('suspicious_activity', {
  reason: 'multiple_failed_logins',
  attempts: 5,
  timeWindow: '5 minutes'
}, req);

logSecurityEvent('access_denied', {
  resource: '/admin/users',
  reason: 'insufficient_permissions'
}, req);
```

## Log File Structure

```
logs/
├── application-2024-01-01.log    # Daily application logs
├── application-2024-01-02.log
├── access-2024-01-01.log         # HTTP access logs
├── errors/
│   ├── error-2024-01-01.log      # Error logs
│   ├── exceptions.log             # Unhandled exceptions
│   └── rejections.log             # Unhandled promise rejections
├── audit/
│   ├── audit-2024-01-01.log      # Audit logs (1 year retention)
│   └── audit-2024-01-02.log
└── archive/
    ├── application-2023-12-30.log.gz  # Compressed old logs
    └── error-2023-12-30.log.gz
```

## Log Management

### Automatic Rotation

- **Daily Rotation**: Logs rotate daily at midnight
- **Size Limits**: Files rotate when exceeding 20MB
- **Retention**: Default 14 days, audit logs 1 year
- **Compression**: Logs older than 1 day are compressed

### Manual Management

```bash
# View log statistics
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/monitoring/logs/stats

# Trigger manual cleanup
curl -X POST -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/monitoring/logs/cleanup

# Trigger manual compression
curl -X POST -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/monitoring/logs/compress
```

### Log Statistics Example

```json
{
  "success": true,
  "logStats": {
    "directories": {
      "logs": {
        "fileCount": 7,
        "totalSize": 52428800,
        "totalSizeFormatted": "50 MB",
        "compressedFiles": 3,
        "oldestFile": "2023-12-25T00:00:00.000Z",
        "newestFile": "2024-01-01T23:59:59.000Z"
      },
      "audit": {
        "fileCount": 30,
        "totalSize": 104857600,
        "totalSizeFormatted": "100 MB",
        "compressedFiles": 25
      },
      "errors": {
        "fileCount": 5,
        "totalSize": 10485760,
        "totalSizeFormatted": "10 MB",
        "compressedFiles": 3
      }
    },
    "totalSize": 167772160,
    "totalFiles": 42,
    "totalSizeFormatted": "160 MB"
  }
}
```

## Security and Privacy

### Data Sanitization

Sensitive data is automatically sanitized:

```javascript
// Automatically redacted fields
const sensitiveFields = [
  'password', 'token', 'secret', 'authorization',
  'cookie', 'email', 'phone', 'ssn', 'credit_card'
];

// Example sanitized log
{
  "user": {
    "id": "user123",
    "email": "joh***",  // Partially redacted
    "password": "[REDACTED]"
  },
  "payment": {
    "amount": 100,
    "currency": "USD",
    "hasStripeIntent": true  // Instead of actual token
  }
}
```

### Compliance

- **GDPR**: Personal data is masked or excluded
- **PCI DSS**: Payment data is never logged
- **SOX**: Audit logs are immutable and retained
- **HIPAA**: Health data is excluded from logs

## Integration with External Services

### ELK Stack

```yaml
# Filebeat configuration
filebeat.inputs:
- type: log
  paths:
    - /app/logs/*.log
  fields:
    service: meetabl-api
    environment: production

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

### CloudWatch Logs

```javascript
// Winston CloudWatch transport
const CloudWatchTransport = require('winston-cloudwatch');

transports.push(new CloudWatchTransport({
  logGroupName: 'meetabl-api',
  logStreamName: process.env.NODE_ENV,
  awsRegion: 'us-east-1'
}));
```

### Datadog

```javascript
// Datadog log shipping
const datadogTransport = require('@datadog/winston');

transports.push(new datadogTransport({
  apiKey: process.env.DATADOG_API_KEY,
  hostname: require('os').hostname(),
  service: 'meetabl-api',
  ddsource: 'nodejs'
}));
```

## Monitoring and Alerting

### Log-based Alerts

Configure alerts based on log patterns:

```yaml
# Example alert rules
alerts:
  - name: "High Error Rate"
    condition: "error_count > 50 in 5 minutes"
    
  - name: "Authentication Failures"
    condition: "auth_failure_count > 10 in 1 minute"
    
  - name: "Slow Requests"
    condition: "avg_response_time > 5000ms in 5 minutes"
```

### Metrics from Logs

Extract metrics from structured logs:

- **Error Rate**: Count of error-level logs
- **Response Time**: Extract from performance logs
- **Business Metrics**: Count of business events
- **Security Events**: Count of security-related logs

## Best Practices

### Development

1. **Use Structured Logging**: Always include relevant context
2. **Appropriate Log Levels**: Use correct log levels
3. **Avoid Sensitive Data**: Never log passwords or tokens
4. **Include Request IDs**: For tracing requests across services
5. **Log Business Events**: Track important business logic

### Production

1. **Monitor Log Volume**: Watch for log spam
2. **Set Up Alerts**: Alert on error patterns
3. **Regular Cleanup**: Ensure logs don't fill disk
4. **Centralized Logging**: Ship logs to central system
5. **Log Analysis**: Regularly analyze logs for insights

### Performance

1. **Async Logging**: Use non-blocking log writes
2. **Batch Processing**: Batch log writes when possible
3. **Compression**: Compress old logs to save space
4. **Sampling**: Sample high-volume logs if needed
5. **Buffer Management**: Manage log buffers properly

## Troubleshooting

### Common Issues

#### Disk Space Full

```bash
# Check log sizes
du -sh /app/logs/*

# Emergency cleanup
find /app/logs -name "*.log" -mtime +7 -delete

# Compress large files
gzip /app/logs/*.log
```

#### Missing Logs

```bash
# Check log configuration
curl http://localhost:3000/api/monitoring/logs/stats

# Verify permissions
ls -la /app/logs/

# Check log service status
docker logs meetabl-api | grep "Log"
```

#### High Memory Usage

```bash
# Check for log memory leaks
process.memoryUsage()

# Restart log service
pm2 restart meetabl-api
```

## Log Analysis Examples

### Error Analysis

```bash
# Count errors by type
cat application-*.log | jq -r 'select(.level=="error") | .error.name' | sort | uniq -c

# Find slow requests
cat access-*.log | jq -r 'select(.duration > 5000) | .url' | sort | uniq -c

# Security event summary
cat audit-*.log | jq -r 'select(.type=="security") | .event' | sort | uniq -c
```

### Business Intelligence

```bash
# Booking trends
cat application-*.log | jq -r 'select(.event=="booking_created") | .timestamp' | cut -d'T' -f1 | sort | uniq -c

# User activity
cat audit-*.log | jq -r 'select(.event=="user_login") | .userId' | sort | uniq -c

# Payment processing
cat application-*.log | jq -r 'select(.event=="payment_processed") | .amount' | awk '{sum+=$1} END {print sum}'
```

## Maintenance Schedule

### Daily
- Monitor disk usage
- Check error rates
- Review security events

### Weekly
- Analyze performance trends
- Review log retention
- Update alert thresholds

### Monthly
- Archive old logs
- Review log configuration
- Optimize log queries

### Quarterly
- Review compliance requirements
- Update sensitive data patterns
- Optimize log infrastructure