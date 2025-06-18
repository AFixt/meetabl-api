# Performance Benchmarking Quick Start

## Overview

This repository now includes a comprehensive performance benchmarking system to compare Node.js 20 vs 22 performance. The system tests both API endpoints and database operations.

## Quick Commands

```bash
# Test that everything is set up correctly
NODE_ENV=development npm run benchmark:test

# Run all benchmarks (API + Database)
npm run benchmark

# Run specific benchmark types
npm run benchmark:api    # API endpoints only
npm run benchmark:db     # Database operations only

# Compare results between Node.js versions
npm run benchmark:compare

# View results summary
npm run benchmark:results

# Clean old results
npm run benchmark:clean
```

## Node.js Version Comparison Workflow

```bash
# Step 1: Run with Node.js 20
nvm use 20
npm run benchmark

# Step 2: Run with Node.js 22  
nvm use 22
npm run benchmark

# Step 3: Generate comparison report
npm run benchmark:compare
```

## What Gets Tested

### API Performance Tests
- Health check endpoint
- User registration and login
- Authenticated endpoints (profile, bookings, availability)
- Concurrent user loads (1, 5, 10, 25, 50 users)
- Response times, throughput, memory usage

### Database Performance Tests
- Connection establishment
- CRUD operations (Create, Read, Update, Delete)
- Complex queries with JOINs
- Transaction performance
- Bulk operations
- Memory usage during DB operations

## Results

Results are saved in `benchmark-results/` directory:
- JSON files with detailed metrics
- HTML reports with visual comparisons
- Performance comparison analysis

## Key Metrics Tracked

- **Requests per second (RPS)** - Higher is better
- **Response time** - Lower is better  
- **Memory usage** - Lower growth is better
- **Success rate** - Should be 100%
- **Database query times** - Lower is better

## Environment Setup

Set these environment variables for optimal testing:

```bash
export NODE_ENV=development
export JWT_SECRET="your_jwt_secret_32_chars_min"
export DB_HOST=localhost
export DB_USER=your_db_user
export DB_PASSWORD=your_db_password
export DB_NAME=your_db_name
```

## Files Created

- `scripts/performance-benchmark.js` - API performance tests
- `scripts/db-performance-benchmark.js` - Database performance tests  
- `scripts/benchmark-runner.sh` - Test orchestration script
- `scripts/test-benchmark-setup.js` - Setup verification script
- `docs/PERFORMANCE_BENCHMARKING.md` - Detailed documentation

## Need Help?

1. Run the setup test: `NODE_ENV=development npm run benchmark:test`
2. Check the detailed guide: `docs/PERFORMANCE_BENCHMARKING.md`
3. Ensure database is running and accessible
4. Verify all dependencies are installed: `npm install`

## Expected Performance Improvements in Node.js 22

Based on Node.js 22 improvements, you should expect to see:
- Faster startup times
- Improved V8 JavaScript engine performance
- Better memory management
- Enhanced async/await performance
- Improved HTTP/2 performance