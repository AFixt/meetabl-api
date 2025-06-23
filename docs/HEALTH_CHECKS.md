# Health Check System

This document describes the comprehensive health check system implemented in the meetabl API for load balancers, monitoring systems, and Kubernetes deployments.

## Overview

The health check system provides multiple endpoints for different use cases:

- **Load Balancer Health Checks**: Fast, minimal checks for traffic routing
- **Kubernetes Probes**: Liveness and readiness probes for container orchestration
- **Monitoring Systems**: Detailed health status with comprehensive metrics
- **Individual Component Checks**: Specific health checks for different services

## Health Check Endpoints

### Root Level Endpoints

#### `GET /health`
**Purpose**: Load balancer health check (fast, basic)
- **Response Time**: < 100ms
- **Authentication**: None required
- **Caching**: Should not be cached

```bash
curl http://localhost:3000/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### `GET /healthz`
**Purpose**: Kubernetes-style health check
- **Response Time**: < 100ms
- **Authentication**: None required
- **Use Case**: Load balancers, ingress controllers

```bash
curl http://localhost:3000/healthz
```

#### `GET /ping`
**Purpose**: Simple alive check
- **Response Time**: < 50ms
- **Authentication**: None required
- **Use Case**: Basic connectivity tests

```bash
curl http://localhost:3000/ping
```

**Response**:
```json
{
  "status": "pong",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 123456
}
```

#### `GET /ready`
**Purpose**: Kubernetes readiness probe
- **Response Time**: < 500ms
- **Authentication**: None required
- **Use Case**: Container orchestration

```bash
curl http://localhost:3000/ready
```

#### `GET /alive`
**Purpose**: Kubernetes liveness probe
- **Response Time**: < 100ms
- **Authentication**: None required
- **Use Case**: Container restart decisions

```bash
curl http://localhost:3000/alive
```

### Detailed Monitoring Endpoints

#### `GET /api/monitoring/health`
**Purpose**: Comprehensive health check with all components
- **Response Time**: < 2s
- **Authentication**: None required (but detailed for authenticated users)
- **Use Case**: Monitoring dashboards, detailed diagnostics

```bash
curl http://localhost:3000/api/monitoring/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "production",
  "version": "1.0.0",
  "uptime": 123456,
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connected",
      "details": {
        "connected": true,
        "pool": {
          "size": 10,
          "available": 8,
          "used": 2,
          "pending": 0
        }
      },
      "responseTime": 45,
      "timestamp": "2024-01-01T12:00:00.000Z"
    },
    "redis": {
      "status": "healthy",
      "message": "Redis connected",
      "details": {
        "connected": true,
        "ping": "PONG",
        "memoryUsed": "2.5M"
      },
      "responseTime": 12,
      "timestamp": "2024-01-01T12:00:00.000Z"
    },
    "memory": {
      "status": "healthy",
      "message": "Memory usage normal",
      "details": {
        "process": {
          "rss": 128,
          "heapTotal": 64,
          "heapUsed": 32,
          "external": 8,
          "percentage": 12.5
        },
        "system": {
          "total": 8192,
          "free": 4096,
          "usage": 50.0
        }
      },
      "responseTime": 5,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  },
  "summary": {
    "total": 7,
    "passed": 6,
    "failed": 0,
    "warnings": 1
  },
  "performance": {
    "totalTime": 150,
    "slowestCheck": {
      "name": "database",
      "time": 45
    },
    "fastestCheck": {
      "name": "memory",
      "time": 5
    }
  }
}
```

#### `GET /api/monitoring/health/basic`
**Purpose**: Load balancer optimized health check
- **Response Time**: < 200ms
- **Authentication**: None required
- **Use Case**: High-frequency load balancer checks

#### `GET /api/monitoring/health/live`
**Purpose**: Kubernetes liveness probe (detailed)
- **Response Time**: < 100ms
- **Authentication**: None required
- **Use Case**: Container liveness detection

#### `GET /api/monitoring/health/ready`
**Purpose**: Kubernetes readiness probe (detailed)
- **Response Time**: < 500ms
- **Authentication**: None required
- **Use Case**: Traffic routing decisions

#### `GET /api/monitoring/health/:check`
**Purpose**: Individual component health check
- **Response Time**: Varies by component
- **Authentication**: None required
- **Use Case**: Debugging specific issues

Available checks:
- `database` - Database connectivity and pool status
- `redis` - Redis connectivity and memory usage
- `filesystem` - File system access and write permissions
- `memory` - Memory usage and availability
- `disk` - Disk space and access
- `external-apis` - External service dependencies
- `dependencies` - Critical Node.js dependencies

```bash
curl http://localhost:3000/api/monitoring/health/database
```

## Health Check Components

### Database Health Check
- **Purpose**: Verify database connectivity and pool health
- **Timeout**: 3 seconds
- **Critical**: Yes (service unavailable if failed)

**Checks**:
- Connection establishment
- Query execution
- Connection pool utilization
- Pool availability

**Status Levels**:
- `healthy`: Database connected, pool utilization < 90%
- `warning`: Connected but pool utilization > 90%
- `unhealthy`: Connection failed or timeout

### Redis Health Check
- **Purpose**: Verify Redis connectivity and performance
- **Timeout**: 2 seconds
- **Critical**: No (service degraded if failed)

**Checks**:
- Connection establishment
- PING command
- Memory usage information

**Status Levels**:
- `healthy`: Redis connected and responding
- `unhealthy`: Connection failed or timeout

### Memory Health Check
- **Purpose**: Monitor memory usage and availability
- **Timeout**: 100ms
- **Critical**: Yes if critical levels reached

**Checks**:
- Process memory usage
- System memory availability
- Heap utilization

**Status Levels**:
- `healthy`: Memory usage < 80%
- `warning`: Memory usage 80-90%
- `unhealthy`: Memory usage > 90%

### Filesystem Health Check
- **Purpose**: Verify file system access and permissions
- **Timeout**: 1 second
- **Critical**: Yes (required for logging and temp files)

**Checks**:
- Write permissions to logs directory
- Read/write integrity test
- Temporary file creation

### External APIs Health Check
- **Purpose**: Verify external service dependencies
- **Timeout**: 3 seconds per service
- **Critical**: No (service degraded if failed)

**Checks**:
- Google APIs (if configured)
- Microsoft Graph API (if configured)
- Stripe API (if configured)
- Other configured external services

### Dependencies Health Check
- **Purpose**: Verify critical Node.js dependencies
- **Timeout**: 500ms
- **Critical**: Yes (service unavailable if failed)

**Checks**:
- Required npm packages availability
- Node.js version compatibility
- Critical module loading

## Load Balancer Configuration

### AWS Application Load Balancer (ALB)

```yaml
HealthCheck:
  Path: /health
  Protocol: HTTP
  Port: 3000
  HealthyThresholdCount: 2
  UnhealthyThresholdCount: 3
  TimeoutSeconds: 5
  IntervalSeconds: 15
  Matcher:
    HttpCode: 200
```

### NGINX Load Balancer

```nginx
upstream meetabl_api {
    server api1.example.com:3000;
    server api2.example.com:3000;
    server api3.example.com:3000;
}

server {
    location /health {
        access_log off;
        proxy_pass http://meetabl_api;
        proxy_set_header Host $host;
        proxy_connect_timeout 5s;
        proxy_read_timeout 5s;
    }
}
```

### HAProxy Configuration

```haproxy
backend meetabl_api
    balance roundrobin
    option httpchk GET /health HTTP/1.1\r\nHost:\ api.meetabl.com
    http-check expect status 200
    
    server api1 api1.example.com:3000 check inter 15s fall 3 rise 2
    server api2 api2.example.com:3000 check inter 15s fall 3 rise 2
    server api3 api3.example.com:3000 check inter 15s fall 3 rise 2
```

## Kubernetes Configuration

### Deployment with Probes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meetabl-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: meetabl-api
  template:
    metadata:
      labels:
        app: meetabl-api
    spec:
      containers:
      - name: meetabl-api
        image: meetabl/api:1.0.0
        ports:
        - containerPort: 3000
        
        # Liveness Probe
        livenessProbe:
          httpGet:
            path: /alive
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
          successThreshold: 1
        
        # Readiness Probe
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
          successThreshold: 1
        
        # Startup Probe (for slow-starting containers)
        startupProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 10
          successThreshold: 1
        
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
```

### Service Configuration

```yaml
apiVersion: v1
kind: Service
metadata:
  name: meetabl-api-service
spec:
  selector:
    app: meetabl-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### Ingress with Health Checks

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: meetabl-api-ingress
  annotations:
    nginx.ingress.kubernetes.io/health-check-path: "/health"
    nginx.ingress.kubernetes.io/health-check-interval: "15s"
    nginx.ingress.kubernetes.io/health-check-timeout: "5s"
spec:
  rules:
  - host: api.meetabl.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: meetabl-api-service
            port:
              number: 80
```

## Monitoring Integration

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'meetabl-api-health'
    metrics_path: '/api/monitoring/health'
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['api.meetabl.com:3000']
```

### Grafana Dashboard

Example queries for health check visualization:

```promql
# Health check success rate
rate(http_requests_total{endpoint="/health",status="200"}[5m]) / 
rate(http_requests_total{endpoint="/health"}[5m])

# Average health check response time
avg(http_request_duration_seconds{endpoint="/health"})

# Database connection pool utilization
database_pool_used / database_pool_total * 100
```

### Alerting Rules

```yaml
groups:
  - name: meetabl-api-health
    rules:
      - alert: HealthCheckFailing
        expr: probe_success{job="meetabl-api-health"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "meetabl API health check failing"
          description: "Health check has been failing for more than 1 minute"
      
      - alert: HighMemoryUsage
        expr: process_memory_usage_percentage > 85
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 85% for more than 2 minutes"
      
      - alert: DatabaseConnectionIssue
        expr: database_connection_status != 1
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Database connection issue"
          description: "Unable to connect to database"
```

## Performance Considerations

### Response Time Targets

| Endpoint | Target Response Time | Use Case |
|----------|---------------------|-----------|
| `/ping` | < 50ms | Basic alive check |
| `/health` | < 100ms | Load balancer |
| `/healthz` | < 100ms | Kubernetes |
| `/alive` | < 100ms | Liveness probe |
| `/ready` | < 500ms | Readiness probe |
| `/api/monitoring/health` | < 2s | Detailed monitoring |
| Individual checks | < 1s | Component debugging |

### Caching Strategy

- **No caching** for health endpoints to ensure real-time status
- Health check results are cached internally for 5 seconds to prevent overload
- Load balancers should not cache health check responses

### Rate Limiting

Health check endpoints are **excluded** from rate limiting to ensure:
- Load balancers can perform frequent checks
- Monitoring systems can poll without restrictions
- Emergency diagnostics are not blocked

## Troubleshooting

### Common Issues

#### Health Check Timeouts
**Symptoms**: 504 Gateway Timeout from load balancer
**Causes**:
- Database connection pool exhaustion
- High memory usage causing GC pauses
- Blocked event loop

**Solutions**:
```bash
# Check specific component
curl http://localhost:3000/api/monitoring/health/database

# Check memory usage
curl http://localhost:3000/api/monitoring/health/memory

# Check detailed health
curl http://localhost:3000/api/monitoring/health
```

#### False Positive Health Checks
**Symptoms**: Health check passes but application errors
**Causes**:
- Health check not comprehensive enough
- External dependencies not checked
- Application-specific issues not detected

**Solutions**:
- Use `/api/monitoring/health` for comprehensive checks
- Check individual components
- Review application logs

#### High Health Check Overhead
**Symptoms**: High CPU/memory usage from health checks
**Causes**:
- Too frequent health check polling
- Expensive health check operations
- Multiple monitoring systems

**Solutions**:
- Use `/health` for high-frequency checks
- Adjust polling intervals
- Cache health check results

### Debugging Commands

```bash
# Basic connectivity
curl -f http://localhost:3000/ping

# Load balancer health
curl -f http://localhost:3000/health

# Detailed health analysis
curl -s http://localhost:3000/api/monitoring/health | jq '.'

# Check specific component
curl -s http://localhost:3000/api/monitoring/health/database | jq '.'

# Test readiness
curl -f http://localhost:3000/ready

# Test liveness
curl -f http://localhost:3000/alive

# Check response times
time curl -s http://localhost:3000/health > /dev/null
```

### Log Analysis

Health check failures are logged with detailed context:

```bash
# Search for health check failures
grep "Health check failed" logs/application-*.log

# Search for specific component failures
grep "Database connection failed" logs/application-*.log

# Monitor health check performance
grep "Health check completed" logs/application-*.log | grep -o "duration:[0-9]*"
```

## Best Practices

### Load Balancer Configuration
1. Use `/health` or `/healthz` for basic checks
2. Set appropriate timeout values (5-10 seconds)
3. Configure proper threshold counts (2-3 failures)
4. Use reasonable polling intervals (10-30 seconds)

### Kubernetes Configuration
1. Use different endpoints for different probe types
2. Set appropriate initial delays for slow-starting services
3. Configure proper failure and success thresholds
4. Use startup probes for services with long initialization

### Monitoring Setup
1. Use `/api/monitoring/health` for detailed monitoring
2. Set up alerts for critical component failures
3. Monitor health check response times
4. Track health check success rates

### Development
1. Test health checks in all environments
2. Ensure health checks don't affect application performance
3. Include health checks in integration tests
4. Document custom health check additions

## Security Considerations

### Information Disclosure
- Health endpoints expose minimal system information
- Sensitive configuration details are excluded
- Error messages are generic in production
- Detailed diagnostics require authentication in some cases

### Access Control
- Basic health endpoints are publicly accessible
- Detailed monitoring endpoints may require authentication
- Internal system details are limited to authorized users
- Health check URLs should not be guessable

### DoS Protection
- Health checks are excluded from rate limiting
- Internal caching prevents health check abuse
- Timeouts prevent resource exhaustion
- Failed health checks don't consume excessive resources

## Custom Health Checks

### Adding New Health Checks

To add a custom health check:

```javascript
// In health-check.service.js
this.registerCheck('custom-service', this.checkCustomService.bind(this));

async checkCustomService() {
  try {
    // Perform your custom check
    const result = await customService.healthCheck();
    
    return {
      status: result.ok ? 'healthy' : 'unhealthy',
      message: result.message,
      details: result.details
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Custom service check failed',
      details: { error: error.message }
    };
  }
}
```

### Health Check Guidelines

1. **Keep checks fast**: Target < 1 second for individual checks
2. **Be specific**: Provide meaningful error messages
3. **Include details**: Add relevant diagnostic information
4. **Handle timeouts**: Implement proper timeout handling
5. **Return appropriate status**: Use 'healthy', 'warning', or 'unhealthy'
6. **Log failures**: Log health check failures for debugging
7. **Test thoroughly**: Test health checks under various conditions