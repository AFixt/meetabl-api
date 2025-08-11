# Production Setup Guide

This guide explains how to configure meetabl for production deployment.

## Environment Configuration

### 1. Create Production Environment Files

Copy the example environment files and update with production values:

```bash
# API
cp .env.example .env.production

# UI
cd ../meetabl-ui
cp .env.example .env.production
```

### 2. Required Environment Variables

#### API (.env.production)

**Server Configuration:**
- `PORT`: API server port (default: 3001)
- `NODE_ENV`: Must be set to "production"

**Security:**
- `JWT_SECRET`: Strong random string for JWT signing
- `SESSION_SECRET`: Strong random string for session encryption

**Database:**
- `DB_HOST`: Production database host
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name (default: meetabl)

**Email (MailerSend):**
- `EMAIL_HOST`: SMTP server hostname
- `EMAIL_PORT`: SMTP port (typically 587 for TLS)
- `EMAIL_USER`: SMTP username
- `EMAIL_PASSWORD`: SMTP password
- `EMAIL_FROM`: From email address
- `EMAIL_FROM_NAME`: From display name

**Stripe:**
- `STRIPE_API_KEY`: Live secret key from Stripe Dashboard
- `STRIPE_SECRET_KEY`: Same as STRIPE_API_KEY
- `STRIPE_PUBLISHABLE_KEY`: Live publishable key
- `STRIPE_WEBHOOK_SECRET`: Webhook endpoint secret

#### UI (.env.production)

- `VITE_API_URL`: Production API URL (e.g., https://api.meetabl.com)
- `VITE_STRIPE_PUBLISHABLE_KEY`: Live publishable key from Stripe
- `VITE_STRIPE_TEST_MODE`: Set to "false" for production

### 3. Security Best Practices

1. **Never commit .env.production files to version control**
   - Both `.env.production` files are listed in `.gitignore`
   - Verify with: `git check-ignore .env.production`

2. **Use strong secrets**
   - Generate secure random strings for JWT_SECRET and SESSION_SECRET
   - Example: `openssl rand -base64 32`

3. **Rotate credentials regularly**
   - Update database passwords periodically
   - Rotate API keys and webhook secrets

4. **Secure credential storage**
   - Use a secure credential management system (e.g., AWS Secrets Manager, HashiCorp Vault)
   - Limit access to production credentials

5. **Environment isolation**
   - Never use production credentials in development
   - Maintain separate credentials for each environment

### 4. Deployment Checklist

- [ ] All production environment files created
- [ ] Strong secrets generated for JWT and sessions
- [ ] Database credentials configured
- [ ] Email service configured and tested
- [ ] Stripe production keys configured
- [ ] Frontend URL points to production API
- [ ] All credentials stored securely
- [ ] Environment files are NOT in version control

### 5. Testing Production Configuration

Before deploying:

1. Test email sending:
   ```bash
   NODE_ENV=production npm run test:email
   ```

2. Test Stripe integration:
   ```bash
   NODE_ENV=production npm run test:stripe
   ```

3. Verify database connection:
   ```bash
   NODE_ENV=production npm run db:test-connection
   ```

## Important Notes

- Production credentials should only be accessible to authorized personnel
- Use environment-specific configuration management tools in production
- Monitor logs for any credential exposure
- Implement proper access controls and audit logging