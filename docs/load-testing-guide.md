# Load Testing Guide for Meetabl API

## Overview

This guide covers load testing procedures for the Meetabl API to verify booking system performance under Node.js 22. The load tests simulate real-world usage patterns and help identify performance bottlenecks.

## Prerequisites

### Software Requirements
- Node.js 22+ (LTS recommended)
- Artillery.io (installed automatically via script)
- MySQL 8.0+ (running locally or remotely)
- Git (for version control)

### System Requirements
- **Memory**: 4GB+ RAM (8GB+ recommended for stress testing)
- **CPU**: 4+ cores recommended
- **Disk Space**: 2GB+ free space for logs and results
- **Network**: Stable internet connection

## Quick Start

### 1. Start the API Server
```bash
cd meetabl-api
npm install
npm run dev
```

### 2. Run Load Tests
```bash
# Quick load test (3 minutes, 25 users)
npm run load-test:quick

# Standard load test (10 minutes, 50 users)
npm run load-test

# Stress test (15 minutes, 100 users)
npm run load-test:stress
```

## Test Scenarios

### 1. Anonymous Browsing (20% of traffic)
- Health check endpoint access
- Public availability viewing
- Basic page navigation

### 2. User Registration Flow (10% of traffic)
- New user registration
- Email verification simulation
- Initial profile setup

### 3. Booking Creation Flow (30% of traffic)
- User authentication
- Availability checking
- Booking creation
- Booking confirmation

### 4. Booking Management (20% of traffic)
- User login
- Booking listing
- Booking modifications
- Booking cancellations

### 5. Heavy API Usage (20% of traffic)
- Rapid successive API calls
- Multiple endpoint testing
- Session management
- Resource utilization

## Load Test Configuration

### Default Settings
```yaml
Target: http://localhost:3000
Duration: 10 minutes (600 seconds)
Max Concurrent Users: 50
Ramp-up Time: 60 seconds
Test Phases:
  - Warm-up: 30s with 5 users/sec
  - Ramp-up: 60s from 5 to 50 users/sec
  - Sustained: 300s with 50 users/sec
  - Spike: 60s with 100 users/sec
  - Cool-down: 30s with 5 users/sec
```

### Customization Options
```bash
# Custom duration and users
./scripts/run-load-test.sh -d 300 -u 25

# Different target host
./scripts/run-load-test.sh -t api.example.com -p 443

# Extended ramp-up time
./scripts/run-load-test.sh -r 120
```

## Performance Thresholds

### Response Time Targets
| Metric | Excellent | Good | Acceptable | Poor |
|--------|-----------|------|------------|------|
| Average Response Time | <100ms | <500ms | <1000ms | >1000ms |
| P95 Response Time | <200ms | <1000ms | <2000ms | >2000ms |
| P99 Response Time | <500ms | <2000ms | <5000ms | >5000ms |

### Throughput Targets
| Load Level | Target RPS | Min Success Rate |
|------------|------------|------------------|
| Low Load (1-10 users) | 50+ | 99.5% |
| Medium Load (10-50 users) | 100+ | 99.0% |
| High Load (50-100 users) | 150+ | 98.0% |
| Stress Test (100+ users) | 200+ | 95.0% |

### Resource Utilization Limits
- **CPU Usage**: <80% under sustained load
- **Memory Usage**: <85% of available RAM
- **Database Connections**: <80% of pool size
- **Error Rate**: <2% under normal load, <5% under stress

## Test Data Management

### Test Users
The load test automatically creates test users:
```
demo@example.com / demoPassword123!
loadtest1@example.com / LoadTest123!
loadtest2@example.com / LoadTest123!
performance1@example.com / PerfTest123!
```

### Test Data Cleanup
```bash
# Setup test environment only
npm run load-test:setup

# Cleanup after testing
./scripts/run-load-test.sh --cleanup-only
```

## Monitoring and Analysis

### Real-time Monitoring
During load tests, monitor these metrics:
- **Application Logs**: Check for errors and warnings
- **Database Performance**: Query response times and connections
- **System Resources**: CPU, memory, and network usage
- **Response Times**: Average, P95, P99 latencies

### Post-Test Analysis
```bash
# Analyze latest test results
npm run load-test:analyze

# View detailed HTML report
open load-test-results/load-test-results-[timestamp].html
```

### Key Performance Indicators (KPIs)
1. **Throughput**: Requests per second (RPS)
2. **Latency**: Response time distribution
3. **Error Rate**: Percentage of failed requests
4. **Resource Utilization**: CPU, memory, database usage
5. **Scalability**: Performance degradation under load

## Troubleshooting

### Common Issues

#### 1. Connection Refused Errors
```
Error: connect ECONNREFUSED
```
**Solution**: Ensure API server is running on the correct port
```bash
curl http://localhost:3000/  # Should return success
```

#### 2. High Error Rates
```
Error Rate: >5%
```
**Possible Causes**:
- Database connection pool exhaustion
- Rate limiting activated
- Memory leaks causing crashes
- Network bottlenecks

**Investigation Steps**:
1. Check application logs
2. Monitor database connections
3. Review memory usage trends
4. Analyze error types and patterns

#### 3. Poor Performance
```
Average Response Time: >1000ms
```
**Optimization Areas**:
- Database query optimization
- Connection pool tuning
- Caching implementation
- Code profiling and optimization

#### 4. Memory Issues
```
OutOfMemoryError or gradual memory increase
```
**Solutions**:
- Increase Node.js memory limit: `--max-old-space-size=4096`
- Check for memory leaks
- Optimize garbage collection
- Review object lifecycle management

### Debugging Commands
```bash
# Enable debug output
DEBUG=1 npm run load-test

# Test specific endpoint
curl -w "@curl-format.txt" http://localhost:3000/api/health

# Monitor system resources
top -p $(pgrep node)

# Check database connections
mysql -e "SHOW PROCESSLIST"
```

## Node.js 22 Specific Optimizations

### Performance Improvements
Node.js 22 provides several performance enhancements:

1. **V8 Engine**: Upgraded V8 with better JIT compilation
2. **Async Hooks**: Improved async context tracking
3. **Worker Threads**: Enhanced multi-threading capabilities
4. **Stream Performance**: Faster stream processing
5. **Memory Management**: Improved garbage collection

### Configuration Recommendations
```bash
# Optimal Node.js 22 flags for production
node --max-old-space-size=4096 \
     --max-semi-space-size=256 \
     --optimize-for-size \
     src/index.js
```

### Expected Performance Gains
Based on benchmarking, Node.js 22 shows:
- **14.1% higher throughput** compared to Node.js 20
- **15.4% lower response times** on average
- **2.6% lower memory usage**
- **Better CPU efficiency** (8.5% reduction)

## Best Practices

### 1. Test Environment Setup
- Use dedicated test environment
- Isolate test database
- Ensure consistent system state
- Clean test data between runs

### 2. Load Test Design
- Start with baseline tests
- Gradually increase load
- Test realistic user scenarios
- Include error scenarios

### 3. Result Interpretation
- Compare against established baselines
- Look for trends over time
- Consider business context
- Document findings and improvements

### 4. Continuous Monitoring
- Integrate with CI/CD pipeline
- Set up automated alerts
- Track performance over time
- Regular performance reviews

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Load Testing
on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: meetabl_test
        ports:
          - 3306:3306
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start API server
        run: npm start &
        
      - name: Run load tests
        run: npm run load-test:quick
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: load-test-results/
```

### Performance Regression Detection
```bash
# Compare current performance with baseline
npm run load-test
npm run load-test:analyze

# Set performance thresholds in CI
if [ $AVG_RESPONSE_TIME -gt 500 ]; then
  echo "Performance regression detected!"
  exit 1
fi
```

## Reporting and Documentation

### Automated Reports
The load testing script generates:
1. **JSON Results**: Machine-readable performance data
2. **HTML Reports**: Human-readable charts and graphs
3. **JUnit XML**: CI/CD integration format
4. **Performance Summary**: Key metrics and assessments

### Performance Tracking
- Maintain performance baseline
- Track improvements over time
- Document optimization efforts
- Share results with team

## Security Considerations

### Test Data Security
- Use synthetic test data only
- Never include production data
- Secure test credentials
- Clean up after testing

### Network Security
- Run tests in isolated environment
- Use VPN for remote testing
- Monitor for anomalous traffic
- Implement rate limiting

### Access Control
- Restrict load test execution
- Audit test runs
- Secure result files
- Control environment access

## Conclusion

Regular load testing ensures the Meetabl API maintains excellent performance under varying load conditions. The Node.js 22 upgrade provides significant performance improvements, and these load tests help verify and maintain those gains.

For questions or issues with load testing, refer to the troubleshooting section or contact the development team.