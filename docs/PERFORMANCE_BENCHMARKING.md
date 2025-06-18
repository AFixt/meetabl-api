# Performance Benchmarking Guide

This document describes the comprehensive performance benchmarking system for comparing Node.js 20 vs 22 performance in the meetabl API application.

## Overview

The benchmarking system consists of three main components:

1. **API Performance Benchmarks** (`scripts/performance-benchmark.js`) - Tests HTTP endpoint performance
2. **Database Performance Benchmarks** (`scripts/db-performance-benchmark.js`) - Tests database operation performance
3. **Benchmark Runner** (`scripts/benchmark-runner.sh`) - Orchestrates tests and manages results

## Quick Start

### Prerequisites

- Node.js 20 or 22 installed (use nvm to switch between versions)
- Database configured and accessible
- All dependencies installed (`npm install`)

### Running Benchmarks

```bash
# Run all benchmarks (API + Database)
npm run benchmark

# Run only API benchmarks
npm run benchmark:api

# Run only database benchmarks
npm run benchmark:db

# Generate comparison reports
npm run benchmark:compare

# View results summary
npm run benchmark:results

# Clean old results
npm run benchmark:clean
```

## Detailed Usage

### Comparing Node.js Versions

To compare performance between Node.js 20 and 22:

```bash
# First, run benchmarks with Node.js 20
nvm use 20
npm run benchmark

# Then, run benchmarks with Node.js 22
nvm use 22
npm run benchmark

# Generate comparison report
npm run benchmark:compare
```

### Environment Configuration

Set these environment variables to customize benchmarking:

```bash
# Server configuration (for API tests)
export BENCHMARK_HOST=localhost
export BENCHMARK_PORT=3000
export BENCHMARK_PROTOCOL=http

# Database configuration (inherits from your .env file)
export DB_HOST=localhost
export DB_USER=your_db_user
export DB_PASSWORD=your_db_password
export DB_NAME=your_db_name

# Test configuration
export JWT_SECRET="your_jwt_secret_for_benchmarking"
```

## API Performance Tests

The API benchmark tests the following endpoints with various concurrent user loads:

### Tested Endpoints

1. **Health Check** (`GET /`)
   - Simple endpoint to test basic server response
   - Used for warmup and connectivity testing

2. **User Registration** (`POST /api/auth/register`)
   - Tests user creation performance
   - Includes validation and password hashing

3. **User Login** (`POST /api/auth/login`)
   - Tests authentication performance
   - Includes password verification and JWT generation

4. **Get User Profile** (`GET /api/users/profile`)
   - Tests authenticated endpoint performance
   - Requires JWT token validation

5. **Get User Bookings** (`GET /api/bookings/my`)
   - Tests database query performance with authentication
   - Includes JOIN operations

6. **Get Availability** (`GET /api/availability`)
   - Tests complex availability calculation logic
   - Includes multiple database queries

### Concurrent User Testing

Tests are run with different concurrent user loads:
- 1 user (baseline)
- 5 users
- 10 users
- 25 users
- 50 users

### Metrics Collected

For each test, the following metrics are collected:

- **Response Times**: min, max, average, p50, p95, p99
- **Throughput**: Requests per second
- **Success Rate**: Percentage of successful requests
- **Error Analysis**: Types and frequency of errors
- **System Metrics**: Memory usage (RSS, heap), CPU usage
- **Status Code Distribution**: HTTP response codes

## Database Performance Tests

The database benchmark tests various database operations:

### Connection Performance
- Connection establishment time
- Connection pool behavior
- Connection reliability

### CRUD Operations
- **CREATE**: User record insertion
- **READ**: Single record retrieval by primary key
- **UPDATE**: Record modification
- **DELETE**: Record removal

### Complex Queries
- JOIN operations (User with UserSettings)
- Aggregate queries (COUNT, SUM, etc.)
- Filtered queries with WHERE clauses

### Transaction Performance
- Transaction creation and commit time
- Rollback performance
- Nested transaction handling

### Bulk Operations
- Bulk INSERT performance
- Bulk UPDATE performance
- Bulk DELETE performance

### Database Metrics

- **Query Times**: Execution time for each operation type
- **Memory Usage**: Memory consumption during operations
- **Connection Pool Stats**: Active connections, wait times
- **Transaction Stats**: Commit/rollback ratios and times

## Results and Reports

### File Structure

Results are saved in the `benchmark-results/` directory:

```
benchmark-results/
├── benchmark-node-v20.x.x-{timestamp}.json    # API results for Node 20
├── benchmark-node-v22.x.x-{timestamp}.json    # API results for Node 22
├── comparison-report-{timestamp}.json          # Comparison data
├── comparison-report-{timestamp}.html          # HTML report
└── database/
    ├── db-benchmark-node-v20.x.x-{timestamp}.json
    └── db-benchmark-node-v22.x.x-{timestamp}.json
```

### HTML Reports

The system generates comprehensive HTML reports that include:

- **Summary Statistics**: Overall performance comparison
- **Detailed Metrics**: Endpoint-by-endpoint analysis
- **Performance Charts**: Visual representation of improvements/regressions
- **Memory Analysis**: Memory usage patterns and growth
- **Recommendations**: Suggested actions based on results

### JSON Results

Raw JSON results contain detailed metrics for:

- Test configuration and environment
- Per-endpoint performance data
- System resource usage
- Error logs and debugging information
- Statistical analysis (percentiles, averages, etc.)

## Interpreting Results

### Key Performance Indicators

1. **Requests per Second (RPS)**
   - Higher is better
   - Indicates overall throughput improvement

2. **Average Response Time**
   - Lower is better
   - Indicates faster response to users

3. **95th Percentile Response Time**
   - Lower is better
   - Indicates consistent performance for most users

4. **Memory Usage**
   - Lower growth is better
   - Indicates efficient memory management

5. **Success Rate**
   - Should be 100% or very close
   - Lower rates indicate reliability issues

### Performance Comparison Analysis

When comparing Node.js versions, look for:

- **Throughput improvements**: Higher RPS in newer versions
- **Latency reductions**: Lower response times
- **Memory efficiency**: Better memory usage patterns
- **Stability improvements**: Fewer errors, more consistent performance

### Regression Detection

Watch for:
- Significant increases in response time (>10%)
- Reduced throughput (>5% drop in RPS)
- Memory leaks (continuously growing memory usage)
- Increased error rates

## Troubleshooting

### Common Issues

1. **Server Won't Start**
   - Check port availability
   - Verify environment variables
   - Check database connectivity

2. **Database Connection Errors**
   - Verify database is running
   - Check connection credentials
   - Ensure database exists and is accessible

3. **Authentication Failures**
   - Check JWT_SECRET is set
   - Verify demo user creation
   - Check for rate limiting

4. **Memory Issues**
   - Increase Node.js memory limit: `--max-old-space-size=4096`
   - Monitor system resources during tests
   - Check for memory leaks in application code

### Debug Mode

Enable detailed logging:

```bash
DEBUG=benchmark:* npm run benchmark
```

### Manual Testing

Test individual components:

```bash
# Test API benchmark directly
node scripts/performance-benchmark.js

# Test database benchmark directly
node scripts/db-performance-benchmark.js

# Generate comparison only
node scripts/performance-benchmark.js compare
```

## Best Practices

### Before Running Benchmarks

1. **Stable Environment**
   - Close other applications
   - Ensure consistent system load
   - Use dedicated testing machine if possible

2. **Database State**
   - Use consistent database state
   - Consider using a dedicated test database
   - Clear cache before tests

3. **Network Conditions**
   - Use localhost for consistency
   - Avoid network-intensive operations during tests

### Running Multiple Tests

1. **Consistency**
   - Run tests multiple times
   - Average results for more reliable data
   - Test at different times of day

2. **Environment Isolation**
   - Use Docker containers for consistency
   - Isolate test databases
   - Control system resources

## Advanced Configuration

### Custom Test Scenarios

Modify `CONFIG` object in benchmark scripts:

```javascript
const CONFIG = {
  test: {
    warmupRequests: 10,        // Warmup iterations
    concurrentUsers: [1, 5, 10, 25, 50], // User loads to test
    requestsPerTest: 100,      // Requests per test
    testDuration: 30000,       // Test duration (ms)
  },
  // ... other settings
};
```

### Custom Endpoints

Add endpoints to test in `performance-benchmark.js`:

```javascript
endpoints: [
  {
    name: 'Custom Endpoint',
    path: '/api/custom/endpoint',
    method: 'GET',
    auth: true,
    body: { /* request body */ }
  }
]
```

### Database Test Customization

Modify database tests in `db-performance-benchmark.js`:

```javascript
const DB_CONFIG = {
  test: {
    connectionTests: 10,     // Connection test iterations
    queryIterations: 100,    // Query test iterations
    bulkInsertSize: 1000,    // Bulk operation size
    concurrentQueries: [1, 5, 10, 25], // Concurrent query loads
  }
};
```

## Continuous Integration

### Automated Benchmarking

Set up automated benchmarks in CI/CD:

```yaml
# .github/workflows/benchmark.yml
name: Performance Benchmark
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm install
      - run: npm run benchmark
      - uses: actions/upload-artifact@v3
        with:
          name: benchmark-results-node-${{ matrix.node-version }}
          path: benchmark-results/
```

### Performance Monitoring

Set up alerts for performance regressions:

1. **Threshold Monitoring**: Alert on >10% performance regression
2. **Trend Analysis**: Monitor performance trends over time
3. **Automated Reports**: Generate weekly performance reports

## Contributing

When adding new benchmarks:

1. Follow existing patterns and naming conventions
2. Include comprehensive error handling
3. Add appropriate logging and metrics collection
4. Update documentation
5. Test with multiple Node.js versions

## Support

For issues with the benchmarking system:

1. Check this documentation
2. Review existing GitHub issues
3. Run benchmarks in debug mode
4. Provide detailed error logs and system information

---

**Note**: Performance results can vary based on hardware, system load, and configuration. Always run multiple iterations and compare relative improvements rather than absolute numbers.