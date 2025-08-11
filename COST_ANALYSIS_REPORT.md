# meetabl-api Cost Analysis Report

## Executive Summary

This report analyzes the cost factors contributing to API request costs for the meetabl-api platform. The analysis covers database operations, external API calls, compute-intensive operations, and middleware overhead to identify the most expensive endpoints and provide cost optimization recommendations.

## Cost Categories Breakdown

### 1. Database Operations

#### High-Cost Operations
- **Complex Queries with Joins**: Multiple queries include model associations (joins)
- **Transactions**: Heavy use of database transactions for data consistency
- **Analytics Queries**: Complex aggregations with GROUP BY, COUNT, AVG operations
- **Bulk Operations**: Bulk insert/update operations in some endpoints

#### Cost Impact by Endpoint

##### Most Expensive Database Operations:
1. **Analytics Endpoints** (`/api/analytics/*`)
   - Multiple aggregation queries per request
   - Historical data scanning (12 months default)
   - GROUP BY operations with date functions
   - Cost estimate: **$0.005-0.010 per request**

2. **Booking Creation** (`POST /api/bookings`)
   - Transaction with 3-4 table writes
   - Overlap checking queries
   - Availability rule lookups
   - Cost estimate: **$0.003-0.005 per request**

3. **Public Booking Slots** (`GET /api/bookings/public/:username`)
   - Complex availability calculation
   - Multiple time slot generation loops
   - Booking conflict checks
   - Cost estimate: **$0.002-0.004 per request**

### 2. External API Calls

#### Service Integration Costs

##### Stripe API (Payment Processing)
- **Payment Intent Creation**: ~$0.03 per transaction (Stripe fee)
- **Refund Processing**: ~$0.25 per refund
- **Webhook Processing**: Minimal cost
- Used in: `/api/payments/*` endpoints

##### Google Calendar API
- **Event Creation**: Free up to quota, then $0.00001 per request
- **Token Refresh**: Minimal cost
- Used in: All booking creation/update endpoints

##### Microsoft Graph API
- **Event Creation**: Free up to quota
- **Token Refresh**: Minimal cost
- Used in: All booking creation/update endpoints

##### Twilio SMS
- **SMS Sending**: ~$0.0075 per SMS (US)
- Currently mocked in implementation
- Potential cost if enabled

##### AWS S3
- **File Upload**: ~$0.005 per 1000 PUT requests
- **File Retrieval**: ~$0.0004 per 1000 GET requests
- **Storage**: ~$0.023 per GB/month
- Used in: File upload endpoints

##### Email Services (Nodemailer/SMTP)
- **Using Gmail SMTP**: Free up to daily limits
- **Using AWS SES**: ~$0.10 per 1000 emails
- Used in: All notification endpoints

### 3. Compute-Intensive Operations

#### Cryptographic Operations
1. **bcrypt Password Hashing**
   - Salt rounds: 10 (balanced security/performance)
   - Cost: ~100ms CPU time per hash
   - Used in: Registration, password reset

2. **JWT Token Generation/Verification**
   - Multiple tokens per auth operation
   - Minimal CPU impact (~1-2ms per operation)

3. **UUID Generation**
   - Used extensively (every record creation)
   - Minimal impact (~0.1ms per generation)

#### Data Processing
1. **Date/Time Calculations**
   - Heavy use of date-fns for slot generation
   - Significant in availability calculations
   - Cost: Variable based on date range

2. **CSV Export Generation**
   - In-memory processing of booking data
   - CPU intensive for large datasets

### 4. Middleware Overhead

#### Per-Request Overhead
1. **Rate Limiting**
   - Redis lookups (if Redis enabled)
   - Memory-based counting (current implementation)
   - Cost: ~0.5-1ms per request

2. **Authentication Middleware**
   - JWT verification on every protected route
   - Database user lookup (could be cached)
   - Cost: ~5-10ms per request

3. **Request Logging**
   - Bunyan structured logging
   - File I/O operations
   - Cost: ~1-2ms per request

4. **Validation Middleware**
   - express-validator processing
   - Cost: ~1-3ms per request

5. **CORS/Security Headers**
   - Helmet middleware
   - Minimal impact: ~0.5ms per request

### 5. Background Jobs

#### Notification Processor
- Runs every 5 minutes
- Queries pending notifications
- Sends emails via SMTP
- Cost: ~$0.001 per job run

## Cost Analysis by Endpoint Category

### Most Expensive Endpoints (per request)

1. **Analytics Endpoints** - $0.005-0.015
   - `/api/analytics/bookings` - Heavy aggregations
   - `/api/analytics/revenue` - Complex calculations
   - `/api/analytics/export` - Large data processing

2. **Payment Endpoints** - $0.030-0.250
   - `/api/payments/process` - Stripe API + DB ops
   - `/api/payments/refund` - Stripe refund API

3. **Booking Creation** - $0.003-0.008
   - `/api/bookings` (POST) - Multiple DB writes + calendar API
   - `/api/bookings/public/:username` (POST) - Same + notifications

4. **Bulk Operations** - $0.005-0.050
   - `/api/bookings/bulk-cancel` - Multiple updates + notifications

### Moderate Cost Endpoints ($0.001-0.003)

- User registration (bcrypt + multiple DB writes)
- Calendar sync operations
- Team management operations
- File uploads (S3 costs)

### Low Cost Endpoints (<$0.001)

- Simple GET requests (single table queries)
- Authentication token refresh
- User profile updates
- Static configuration endpoints

## Cost Optimization Recommendations

### 1. Database Optimization
- **Implement query result caching** for analytics endpoints (Redis)
- **Add database indexes** for frequently queried fields:
  - `bookings.start_time`, `bookings.user_id`
  - `availability_rules.user_id`, `availability_rules.day_of_week`
- **Optimize N+1 queries** by eager loading associations
- **Batch database operations** where possible

### 2. External API Optimization
- **Implement webhook queuing** for calendar updates
- **Batch notification sending** to reduce API calls
- **Cache calendar tokens** aggressively
- **Use bulk SMS APIs** if implementing SMS

### 3. Compute Optimization
- **Cache bcrypt results** for recently authenticated users
- **Implement JWT token caching** to avoid repeated verification
- **Pre-calculate availability slots** and cache for popular users
- **Use streaming for large CSV exports**

### 4. Middleware Optimization
- **Implement Redis-based rate limiting** for better performance
- **Cache user authentication** data in memory/Redis
- **Reduce logging verbosity** in production
- **Implement conditional middleware** loading

### 5. Architecture Recommendations
- **Implement API response caching** (CDN or Redis)
- **Move analytics to read replicas** to reduce main DB load
- **Implement request coalescing** for duplicate requests
- **Use queue-based processing** for expensive operations

## Estimated Monthly Costs (10M requests/month)

### Current Implementation
- Database operations: ~$500-800
- External APIs: ~$1,000-2,000 (depends on usage patterns)
- Compute (Lambda/EC2): ~$200-400
- Storage & Transfer: ~$100-200
- **Total: ~$1,800-3,400/month**

### After Optimization
- Database operations: ~$300-500 (with caching)
- External APIs: ~$800-1,500 (with batching)
- Compute: ~$150-300 (with optimizations)
- Storage & Transfer: ~$100-200
- **Total: ~$1,350-2,500/month**

**Potential savings: 25-30%**

## Conclusion

The most significant cost drivers are:
1. External API calls (especially payment processing)
2. Complex analytics queries
3. Multiple database writes in transactions
4. Background notification processing

Implementing the recommended optimizations could reduce costs by 25-30% while improving performance and user experience.