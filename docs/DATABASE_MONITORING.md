# Database Query Monitoring

The meetabl API includes comprehensive database query monitoring to help identify performance bottlenecks, track slow queries, and optimize database performance.

## Features

- **Real-time Query Monitoring**: Tracks all database queries with execution times
- **Slow Query Detection**: Automatically logs queries exceeding configurable thresholds
- **Performance Statistics**: Aggregates query statistics by type and table
- **Connection Pool Monitoring**: Tracks database connection pool health
- **RESTful Monitoring API**: Access monitoring data via API endpoints

## Configuration

Add these environment variables to your `.env` file:

```env
# Enable/disable database monitoring
DB_MONITORING_ENABLED=true

# Slow query threshold in milliseconds (default: 1000ms)
SLOW_QUERY_THRESHOLD=1000

# Monitoring log level: debug, info, warn, error (default: warn)
DB_MONITOR_LOG_LEVEL=warn

# Monitoring statistics interval in minutes (default: 5)
DB_MONITOR_INTERVAL=5
```

## Monitoring Endpoints

### Health Check with Monitoring Info

```bash
GET /api/health
```

Returns health status including database monitoring information:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "database": {
    "status": "connected",
    "pool": {
      "size": 10,
      "available": 8,
      "using": 2,
      "waiting": 0
    }
  },
  "monitoring": {
    "enabled": true,
    "slowQueryThreshold": 1000,
    "stats": {
      "SELECT:Users": {
        "count": 150,
        "totalTime": 2500,
        "minTime": 5,
        "maxTime": 120,
        "avgTime": 17
      }
    },
    "slowQueries": [
      {
        "queryType": "SELECT",
        "tableName": "Bookings",
        "count": 10,
        "maxTime": 1500,
        "avgTime": 1200
      }
    ]
  }
}
```

### Database Statistics (Development Only)

```bash
GET /api/monitoring/db-stats
```

Returns detailed database monitoring statistics:

```json
{
  "enabled": true,
  "slowQueryThreshold": 1000,
  "stats": {
    "SELECT:Users": {
      "count": 500,
      "totalTime": 10000,
      "minTime": 5,
      "maxTime": 250,
      "avgTime": 20
    },
    "INSERT:Bookings": {
      "count": 50,
      "totalTime": 2500,
      "minTime": 30,
      "maxTime": 100,
      "avgTime": 50
    }
  },
  "slowQueries": [
    {
      "queryType": "SELECT",
      "tableName": "Bookings",
      "count": 5,
      "totalTime": 8000,
      "minTime": 1200,
      "maxTime": 2000,
      "avgTime": 1600
    }
  ]
}
```

## Log Output

### Slow Query Logs

When a query exceeds the slow query threshold:

```
WARN: Slow query detected
{
  "sql": "SELECT * FROM Bookings WHERE userId = '?' AND startTime > '?'",
  "executionTime": 1523,
  "queryType": "SELECT",
  "tableName": "Bookings",
  "threshold": 1000,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Periodic Statistics Logs

Every monitoring interval (default 5 minutes):

```
INFO: Database performance summary
{
  "totalQueries": 1250,
  "avgQueryTime": 45,
  "slowQueryCount": 3,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Query Optimization Tips

Based on monitoring data, consider these optimizations:

### 1. Index Optimization

If you see slow SELECT queries on specific tables:

```sql
-- Add indexes for commonly queried columns
CREATE INDEX idx_bookings_user_start ON Bookings(userId, startTime);
CREATE INDEX idx_availability_user_day ON AvailabilityRules(userId, dayOfWeek);
```

### 2. Query Refinement

Replace slow queries with optimized versions:

```javascript
// Instead of:
const bookings = await Booking.findAll({
  include: [{ all: true }]
});

// Use specific includes:
const bookings = await Booking.findAll({
  include: [{
    model: User,
    attributes: ['id', 'firstName', 'lastName', 'email']
  }],
  attributes: ['id', 'startTime', 'endTime', 'title']
});
```

### 3. Connection Pool Tuning

If you see high pool usage:

```javascript
// In database config
{
  pool: {
    max: 20,      // Increase max connections
    min: 5,       // Maintain minimum connections
    acquire: 30000,
    idle: 10000
  }
}
```

## Monitoring Best Practices

1. **Regular Review**: Check monitoring stats weekly to identify trends
2. **Alert Setup**: Configure alerts for queries exceeding 2x the threshold
3. **Baseline Establishment**: Document normal query performance metrics
4. **Test Environment**: Always test query optimizations in development first
5. **Query Analysis**: Use `EXPLAIN` to understand slow query execution plans

## Troubleshooting

### High Slow Query Count

1. Check for missing indexes
2. Review query complexity
3. Consider query caching
4. Optimize JOIN operations

### Connection Pool Exhaustion

1. Increase pool size
2. Reduce query execution time
3. Check for connection leaks
4. Implement connection retry logic

### Memory Usage

1. Limit result set sizes
2. Use pagination for large queries
3. Stream large result sets
4. Monitor Node.js memory usage

## Integration with APM Tools

The monitoring data can be exported to Application Performance Monitoring tools:

```javascript
// Example: Export to Datadog
const StatsD = require('node-dogstatsd').StatsD;
const dogstatsd = new StatsD();

// In your monitoring job
const stats = dbMonitor.getStats();
for (const [key, value] of Object.entries(stats)) {
  dogstatsd.gauge('db.query.avg_time', value.avgTime, [`query:${key}`]);
  dogstatsd.increment('db.query.count', value.count, [`query:${key}`]);
}
```

## Security Considerations

- Query sanitization removes sensitive data before logging
- Monitoring endpoints are disabled in production by default
- Access to monitoring data should be restricted
- Never log full query parameters in production