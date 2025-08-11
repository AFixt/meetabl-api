# Application Performance Monitoring (APM)

This document describes the comprehensive monitoring and observability setup for the meetabl API.

## Overview

The meetabl API includes multiple layers of monitoring:

1. **OpenTelemetry Integration** - Distributed tracing and metrics
2. **Custom Metrics Collection** - Business-specific metrics
3. **Performance Monitoring** - Request/response performance tracking
4. **Health Checks** - Service health and dependency monitoring
5. **Real-time Status Dashboard** - Live performance visualization

## Architecture

### OpenTelemetry Stack

```
Application Code
       ↓
OpenTelemetry SDK (Auto-instrumentation)
       ↓
Metrics Exporter (Prometheus)
       ↓
Monitoring Backend (Grafana/Prometheus)
```

### Custom Metrics

```
Business Logic → Metrics Service → OpenTelemetry → Prometheus
```

## Configuration

### Environment Variables

```bash
# Telemetry Configuration
ENABLE_TELEMETRY=true
METRICS_PORT=9090
NODE_ENV=production

# Optional: External APM Services
DATADOG_API_KEY=your_datadog_key
NEW_RELIC_LICENSE_KEY=your_newrelic_key
```

### Telemetry Initialization

Telemetry is automatically initialized when:
- `NODE_ENV=production`, OR
- `ENABLE_TELEMETRY=true`

## Monitoring Endpoints

### Health Check
- **URL**: `GET /api/monitoring/health`
- **Description**: Basic health status and dependency checks
- **Access**: Public

**Response Example**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "production",
  "version": "1.0.0",
  "uptime": 3600,
  "database": "connected",
  "memory": {
    "rss": 52428800,
    "heapTotal": 33554432,
    "heapUsed": 20971520
  }
}
```

### Metrics Dashboard
- **URL**: `GET /status`
- **Description**: Real-time performance dashboard
- **Access**: Public (in development)

### Detailed Metrics
- **URL**: `GET /api/monitoring/metrics`
- **Description**: Application-specific metrics
- **Access**: Authenticated

### System Statistics
- **URL**: `GET /api/monitoring/stats`
- **Description**: Detailed system and application statistics
- **Access**: Authenticated

### Performance Metrics
- **URL**: `GET /api/monitoring/performance`
- **Description**: Performance trends and analysis
- **Access**: Authenticated

## Metrics Collected

### Business Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `bookings_created_total` | Counter | Total bookings created |
| `bookings_cancelled_total` | Counter | Total bookings cancelled |
| `users_registered_total` | Counter | Total user registrations |
| `auth_attempts_total` | Counter | Authentication attempts |
| `auth_failures_total` | Counter | Failed authentication attempts |
| `subscription_changes_total` | Counter | Subscription tier changes |
| `webhook_events_total` | Counter | Webhook events processed |
| `webhook_failures_total` | Counter | Failed webhook processing |

### Performance Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `request_duration_seconds` | Histogram | HTTP request duration |
| `database_query_duration_seconds` | Histogram | Database query duration |
| `booking_processing_duration_seconds` | Histogram | Booking operation duration |
| `api_requests_total` | Counter | Total API requests |
| `api_errors_total` | Counter | API errors by status code |

### System Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `memory_usage_bytes` | Gauge | Memory usage (heap, RSS) |
| `active_connections` | Gauge | Active database connections |
| `queue_size` | Gauge | Background job queue size |
| `active_users` | Gauge | Currently active users |

## Alerting

### Automatic Alerts

The system automatically logs alerts for:

- **Slow Requests**: > 5 seconds response time
- **Slow Database Queries**: > 1 second execution time
- **High Memory Usage**: > 500MB RSS
- **Event Loop Lag**: > 100ms lag
- **Authentication Failures**: High failure rates

### Alert Configuration

Alerts are logged using structured logging and can be integrated with external alerting systems:

```javascript
logger.warn('Slow request detected', {
  method: 'POST',
  path: '/api/bookings',
  duration: 6000,
  statusCode: 200
});
```

## Integration with External APM

### Datadog Integration

```bash
# Install Datadog agent
npm install dd-trace

# Add to telemetry.js
const tracer = require('dd-trace').init({
  service: 'meetabl-api',
  env: process.env.NODE_ENV
});
```

### New Relic Integration

```bash
# Install New Relic agent
npm install newrelic

# Add newrelic.js configuration
module.exports = {
  app_name: ['meetabl-api'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info'
  }
};
```

### Prometheus + Grafana

Metrics are exported in Prometheus format on port 9090:

```bash
# Scrape configuration for prometheus.yml
scrape_configs:
  - job_name: 'meetabl-api'
    static_configs:
      - targets: ['localhost:9090']
```

## Custom Metrics Usage

### Recording Business Events

```javascript
const metricsService = require('../services/metrics.service');

// Record booking creation
metricsService.recordBookingCreated({
  user_id: user.id,
  booking_type: 'consultation'
});

// Record performance timing
const startTime = process.hrtime();
// ... perform operation
const [seconds, nanoseconds] = process.hrtime(startTime);
const duration = seconds + nanoseconds / 1000000000;
metricsService.recordBookingProcessingTime(duration, {
  operation: 'create'
});
```

### Custom Tracing

```javascript
const metricsService = require('../services/metrics.service');

await metricsService.createSpan('booking-validation', async (span) => {
  span.setAttributes({
    'booking.id': bookingId,
    'user.id': userId
  });
  
  // Perform validation logic
  const result = await validateBooking(booking);
  
  span.setAttributes({
    'validation.result': result.valid
  });
  
  return result;
});
```

## Performance Optimization

### Monitoring Best Practices

1. **Metric Cardinality**: Limit high-cardinality labels
2. **Sampling**: Use sampling for high-volume traces
3. **Buffering**: Metrics are buffered and sent in batches
4. **Async Processing**: All monitoring is non-blocking

### Memory Management

The monitoring system:
- Uses circular buffers for time-series data
- Automatically cleans up old metrics
- Monitors its own memory usage
- Gracefully degrades under memory pressure

## Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check memory metrics
curl http://localhost:3000/api/monitoring/metrics

# Check detailed stats
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/monitoring/stats
```

#### Slow Performance
```bash
# Check performance metrics
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/monitoring/performance

# View real-time dashboard
open http://localhost:3000/status
```

#### Database Issues
```bash
# Check database health
curl http://localhost:3000/api/monitoring/health

# Check connection pool stats
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/monitoring/stats
```

### Debug Mode

Enable debug logging for telemetry:

```bash
export DEBUG=telemetry*,metrics*,performance*
npm start
```

### Metrics Export

Export metrics in various formats:

```bash
# Prometheus format
curl http://localhost:9090/metrics

# JSON format
curl http://localhost:3000/api/monitoring/metrics
```

## Security Considerations

### Access Control

- Health endpoints are public (no sensitive data)
- Detailed metrics require authentication
- Admin-only access to system statistics
- Rate limiting on monitoring endpoints

### Data Privacy

- No sensitive user data in metrics
- User IDs are hashed in traces
- PII is excluded from logs
- Metrics retention follows data retention policies

## Maintenance

### Regular Tasks

1. **Weekly**: Review performance trends
2. **Monthly**: Analyze error patterns
3. **Quarterly**: Optimize metric collection
4. **Yearly**: Review alerting thresholds

### Metric Cleanup

Automatic cleanup of:
- Old trace data (7 days)
- Aggregated metrics (90 days)
- Error logs (30 days)
- Performance data (30 days)

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Prometheus Metrics](https://prometheus.io/docs/practices/naming/)
- [Express Status Monitor](https://github.com/RafalWilinski/express-status-monitor)
- [Node.js Performance Monitoring](https://nodejs.org/en/docs/guides/simple-profiling/)