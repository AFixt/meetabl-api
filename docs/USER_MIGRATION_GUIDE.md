# User Migration Guide - Outseta Integration

This guide explains how to migrate existing users from local authentication to Outseta.

## Overview

The migration process involves:
1. Creating users in Outseta (if they don't exist)
2. Linking local user accounts with Outseta user IDs
3. Updating subscription information
4. Notifying users about password reset requirements

## Prerequisites

### Environment Setup

Ensure the following environment variables are configured:

```bash
OUTSETA_API_URL=https://api.outseta.com/v1
OUTSETA_API_KEY=your_api_key
OUTSETA_API_SECRET=your_api_secret
OUTSETA_DOMAIN=https://yourcompany.outseta.com
OUTSETA_WEBHOOK_SECRET=your_webhook_secret
```

### Database Backup

**CRITICAL**: Always backup your database before running migration:

```bash
# MySQL backup
mysqldump -u username -p database_name > backup_before_migration.sql

# Or using npm script if configured
npm run db:backup
```

## Migration Process

### Step 1: Preview Migration (Dry Run)

Always start with a dry run to preview what will be migrated:

```bash
node scripts/migrate-users-to-outseta.js --dry-run
```

This will show you:
- How many users will be migrated
- Which users already exist in Outseta
- Any potential issues

### Step 2: Test with Small Batch

Test with a small batch first:

```bash
node scripts/migrate-users-to-outseta.js --batch-size 5 --email-filter '%@yourdomain.com'
```

### Step 3: Full Migration

Once you're confident, run the full migration:

```bash
node scripts/migrate-users-to-outseta.js --batch-size 10
```

### Step 4: Verify Migration

After migration, verify the results:

```bash
node scripts/verify-outseta-migration.js --detailed
```

## Migration Options

### Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--dry-run` | Preview without making changes | `--dry-run` |
| `--batch-size N` | Process N users at a time | `--batch-size 5` |
| `--email-filter P` | Filter users by email pattern | `--email-filter '%@company.com'` |
| `--force` | Force migration even if user exists | `--force` |

### Filtering Users

You can filter which users to migrate:

```bash
# Migrate only users from specific domain
node scripts/migrate-users-to-outseta.js --email-filter '%@company.com'

# Migrate users with emails containing 'test'
node scripts/migrate-users-to-outseta.js --email-filter '%test%'
```

## Post-Migration Tasks

### 1. Password Reset Notifications

Users will need to reset their passwords since password hashes cannot be migrated for security reasons.

**Option A: Automated Email Campaign**
```bash
# Send password reset emails to all migrated users
node scripts/send-migration-notifications.js --type password-reset
```

**Option B: Manual Communication**
- Send company-wide email explaining the migration
- Include instructions for password reset
- Provide support contact information

### 2. Update Authentication Flows

After successful migration, update your authentication endpoints:

```bash
# Switch auth routes to use Outseta
# This can be done gradually with feature flags
```

### 3. Monitor Integration

```bash
# Check webhook processing
node scripts/verify-outseta-migration.js --detailed

# Monitor Outseta webhook stats
curl -X GET "http://localhost:3000/api/outseta/webhook/stats"
```

## Troubleshooting

### Common Issues

#### Migration Script Fails

**Error**: `OUTSETA_API_KEY not configured`
**Solution**: Verify all environment variables are set correctly

**Error**: `User already exists in Outseta`
**Solution**: Use `--force` flag or verify existing users manually

**Error**: `Rate limit exceeded`
**Solution**: Reduce `--batch-size` or add delays between batches

#### Verification Issues

**Issue**: Email mismatch between local and Outseta
**Solution**: 
```bash
node scripts/verify-outseta-migration.js --fix-issues
```

**Issue**: Subscription data not synchronized
**Solution**: Webhooks will automatically sync this data, or run manual sync

**Issue**: Users can't log in after migration
**Solution**: Ensure users reset their passwords through Outseta

### Recovery Procedures

#### Rollback Migration

If you need to rollback the migration:

```bash
# Remove Outseta UIDs from local users
UPDATE Users SET outseta_uid = NULL WHERE outseta_uid IS NOT NULL;

# Restore from backup if needed
mysql -u username -p database_name < backup_before_migration.sql
```

#### Partial Migration Issues

If some users failed to migrate:

```bash
# Re-run migration for failed users only
node scripts/migrate-users-to-outseta.js --email-filter 'failed_user@example.com'

# Or force re-migration
node scripts/migrate-users-to-outseta.js --force
```

## Migration Validation

### Pre-Migration Checklist

- [ ] Database backup completed
- [ ] Outseta API credentials verified
- [ ] Dry run completed successfully
- [ ] Small batch test completed
- [ ] Support team notified of migration window

### Post-Migration Checklist

- [ ] Migration verification script passed
- [ ] Webhook endpoints are receiving events
- [ ] Sample user login flow tested
- [ ] Password reset flow tested
- [ ] Subscription data synchronized
- [ ] Users notified of password reset requirement

## Monitoring and Maintenance

### Ongoing Monitoring

```bash
# Daily verification (can be added to cron)
node scripts/verify-outseta-migration.js > /var/log/outseta-verification.log

# Monitor webhook health
curl -X GET "http://localhost:3000/api/outseta/webhook/stats?range=24h"
```

### Data Synchronization

The system automatically synchronizes data through webhooks, but you can manually verify:

```bash
# Check specific user
node scripts/verify-outseta-migration.js --email user@example.com

# Fix synchronization issues
node scripts/verify-outseta-migration.js --fix-issues
```

## Security Considerations

### Password Security

- **Never migrate password hashes** - This is a security risk
- Users must reset passwords through Outseta's secure flow
- Consider temporary password policies during migration period

### Data Privacy

- Ensure compliance with GDPR/privacy regulations
- Log migration activities for audit trails
- Implement data retention policies for migration logs

### API Security

- Rotate API keys after migration
- Monitor API usage for anomalies
- Implement rate limiting and error handling

## Support and Communication

### User Communication Template

```
Subject: Important: Account Migration to New Authentication System

Dear [User],

We're upgrading our authentication system to provide better security and user experience. 

What you need to know:
1. Your account has been migrated to our new system
2. You'll need to reset your password on your next login
3. All your data and settings remain unchanged

Next steps:
1. Visit [Login URL]
2. Click "Forgot Password"
3. Enter your email address
4. Follow the reset instructions

If you need help, contact support at [Support Email].

Thank you,
[Company Team]
```

### Support FAQ

**Q: Why do I need to reset my password?**
A: For security reasons, we cannot transfer passwords to the new system. This ensures your account remains secure.

**Q: Will I lose my data?**
A: No, all your bookings, settings, and data remain unchanged.

**Q: What if I can't access my email?**
A: Contact our support team for manual password reset assistance.

## Reference

### Script Exit Codes

- `0`: Success
- `1`: Errors occurred during migration/verification

### Log Levels

- `ERROR`: Critical issues requiring immediate attention
- `WARN`: Issues that should be reviewed but don't stop migration
- `INFO`: General migration progress information
- `DEBUG`: Detailed debugging information

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OUTSETA_API_URL` | Yes | Outseta API base URL | `https://api.outseta.com/v1` |
| `OUTSETA_API_KEY` | Yes | API key for authentication | `pk_...` |
| `OUTSETA_API_SECRET` | Yes | API secret for authentication | `sk_...` |
| `OUTSETA_DOMAIN` | Yes | Your Outseta domain | `https://company.outseta.com` |
| `OUTSETA_WEBHOOK_SECRET` | Yes | Secret for webhook verification | `wh_...` |