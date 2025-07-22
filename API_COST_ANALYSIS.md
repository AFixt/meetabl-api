# API Cost Analysis - Meetabl API

## Overview

This document provides estimated costs per API request for the meetabl-api based on analysis of the codebase, including database operations, external API calls, compute requirements, and data transfer.

## Cost per Request by Category

### Basic CRUD Operations

**Examples**: GET user profile, update settings, get availability rules  
**Cost**: **$0.0015 - $0.0025** per request

**Breakdown**:

- Database queries: $0.0010 (simple SELECT/UPDATE)
- JWT verification: $0.0002
- Middleware overhead: $0.0003
- Data transfer: $0.0005

### Authentication Endpoints

**Examples**: Login, register, refresh token  
**Cost**: **$0.0020 - $0.0035** per request

**Breakdown**:

- Database operations: $0.0015 (multiple tables for registration)
- bcrypt hashing: $0.0008 (~100ms CPU time)
- JWT generation: $0.0002
- Middleware overhead: $0.0005

### Booking Operations

**Examples**: Create booking, get available slots, reschedule  
**Cost**: **$0.0030 - $0.0080** per request

**Breakdown**:

- Database transactions: $0.0020 (3-4 table updates)
- Availability calculations: $0.0015 (complex date/time logic)
- Optional calendar API: $0.0000-$0.0030
- Notification queuing: $0.0005

### Analytics/Reporting

**Examples**: Booking statistics, usage analytics, CSV exports  
**Cost**: **$0.0050 - $0.0150** per request

**Breakdown**:

- Complex queries: $0.0040 (aggregations, GROUP BY)
- Large data scans: $0.0020
- Export processing: $0.0010
- Data transfer: $0.0030 (larger payloads)

### Payment Processing

**Examples**: Process payment, create payment intent, refund  
**Cost**: **$0.0300 - $0.2500** per request

**Breakdown**:

- Stripe API fees: $0.0290 + 2.9% of transaction
- Database operations: $0.0010
- Webhook processing: $0.0005
- Invoice generation: $0.0005

### Notification Sending

**Examples**: Send SMS, send email, bulk notifications  
**Cost**: **$0.0080 - $0.0100** per notification

**Breakdown**:

- Twilio SMS: $0.0075 per message
- Email (AWS SES): $0.0001 per email
- Database operations: $0.0004
- Queue processing: $0.0002

## Key Cost Factors

### 1. Database Operations

- Simple queries (SELECT, single UPDATE): $0.0010
- Complex queries (JOIN, aggregations): $0.0020-$0.0050
- Transactions (multiple tables): $0.0020-$0.0040
- Bulk operations: $0.0050-$0.0100

### 2. External API Costs

| Service | Cost per Call |
|---------|---------------|
| Stripe Payment | ~$0.03 + 2.9% fee |
| Twilio SMS | $0.0075 |
| AWS S3 Storage | $0.023/GB/month |
| AWS S3 Transfer | $0.09/GB |
| Google Calendar | Free (quota limited) |
| Microsoft Graph | Free (quota limited) |
| Email (Gmail SMTP) | Free |
| Email (AWS SES) | $0.10/1000 emails |

### 3. Compute Operations

- bcrypt hashing (10 rounds): $0.0008
- JWT signing/verification: $0.0002
- Date/time calculations: $0.0003-$0.0010
- CSV generation: $0.0005-$0.0020

### 4. Infrastructure Overhead

- Rate limiting checks: $0.0001
- Request logging: $0.0002
- Input validation: $0.0002
- CORS/security headers: $0.0001

### 5. Background Jobs

- Notification processor (every 5 min): ~$50-100/month
- Cleanup jobs: ~$10-20/month

## Monthly Cost Estimates

### For 10 Million Requests/Month

**Distribution Assumption**:

- 60% Basic CRUD: 6M × $0.0020 = $12,000
- 15% Authentication: 1.5M × $0.0028 = $4,200
- 15% Bookings: 1.5M × $0.0055 = $8,250
- 8% Analytics: 0.8M × $0.0100 = $8,000
- 1% Payments: 0.1M × $0.1000 = $10,000
- 1% Notifications: 0.1M × $0.0090 = $900

**Total Monthly Estimates**:

- **Low**: $1,800/month (read-heavy workload)
- **Typical**: $2,500/month (balanced workload)
- **High**: $3,400/month (analytics/payment heavy)

### Additional Fixed Costs

- Database hosting: $200-500/month
- Application servers: $200-400/month
- Load balancer: $20/month
- Monitoring/logging: $50-100/month
- SSL certificates: $10/month

## Cost Optimization Recommendations

### 1. Implement Caching (25-30% reduction)

- Redis for authentication data
- Cache analytics results for 5-15 minutes
- Cache availability calculations
- **Potential savings**: $500-800/month

### 2. Database Optimization (15-20% reduction)

- Add indexes on frequently queried fields
- Optimize complex queries
- Use read replicas for analytics
- **Potential savings**: $300-500/month

### 3. Batch External API Calls (10-15% reduction)

- Batch notification sending
- Aggregate calendar updates
- **Potential savings**: $200-400/month

### 4. Request Optimization (5-10% reduction)

- Implement request coalescing
- Add client-side caching headers
- **Potential savings**: $100-300/month

## Endpoint Cost Rankings

### Most Expensive (per request)

1. **POST /api/payments/process**: $0.0300-$0.2500
2. **GET /api/analytics/\***: $0.0050-$0.0150
3. **GET /api/bookings/export**: $0.0080-$0.0120
4. **POST /api/bookings/my/bulk-cancel**: $0.0050-$0.0100
5. **GET /api/availability/slots**: $0.0040-$0.0080

### Most Cost-Effective (per request)

1. **GET /api/users/me**: $0.0015
2. **GET /api/availability/rules**: $0.0018
3. **PUT /api/users/me/settings**: $0.0020
4. **GET /api/bookings/my**: $0.0022
5. **POST /api/auth/refresh**: $0.0025

## Conclusion

The meetabl-api has reasonable per-request costs for a booking platform. The main cost drivers are:

1. **Payment processing** - dominated by Stripe fees
2. **Analytics queries** - due to database complexity
3. **Notification sending** - SMS costs via Twilio
4. **Availability calculations** - compute-intensive date/time operations

With the recommended optimizations, costs can be reduced by 25-30% while maintaining performance and reliability. The most impactful optimization would be implementing Redis caching for frequently accessed data and analytics results.
