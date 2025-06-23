# Outseta Integration Guide

This guide explains how to configure and use the Outseta integration for user management and billing in the meetabl API.

## Overview

Outseta is used for:
- User authentication and management
- Subscription billing and management
- Payment processing
- Feature gating based on subscription tiers

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Outseta API Configuration
OUTSETA_API_URL=https://api.outseta.com/v1
OUTSETA_API_KEY=your_api_key_here
OUTSETA_API_SECRET=your_api_secret_here
OUTSETA_DOMAIN=https://yourcompany.outseta.com
OUTSETA_WEBHOOK_SECRET=your_webhook_secret_here
```

### Database Migration

Run the migration to add Outseta fields to the Users table:

```bash
npm run db:migrate
```

## API Endpoints

### Authentication Flow

1. **Login**: `GET /api/outseta/login?redirect=<url>`
   - Redirects to Outseta login page
   - After successful login, redirects back to your app

2. **Signup**: `GET /api/outseta/signup?redirect=<url>&plan=<planId>`
   - Redirects to Outseta signup page
   - Optional `plan` parameter pre-selects a subscription plan

3. **Callback**: `POST /api/outseta/callback`
   - Body: `{ "access_token": "<outseta_token>" }`
   - Validates token and creates local session
   - Returns JWT for API access

### Webhook Endpoints

**Primary Webhook URL**: `POST /api/outseta/webhook`

Configure this URL in your Outseta account to receive events:
- `person.created` - New user registration
- `person.updated` - User profile updates
- `subscription.created` - New subscription
- `subscription.updated` - Subscription changes
- `subscription.cancelled` - Subscription cancellation

**Webhook Management Endpoints**:
- `GET /api/outseta/webhook/stats?range=24h` - Get webhook processing statistics
- `POST /api/outseta/webhook/test` - Test webhook processing (development only)

**Webhook Security**:
- All webhooks are verified using HMAC-SHA256 signatures
- Configure `OUTSETA_WEBHOOK_SECRET` in your environment
- Failed webhooks are retried up to 3 times with exponential backoff
- All webhook events are logged for monitoring and debugging

## Subscription Plans

The following subscription tiers are supported:

1. **Basic**
   - Features: booking, calendar
   
2. **Professional**
   - Features: booking, calendar, teams, analytics
   
3. **Enterprise**
   - Features: booking, calendar, teams, analytics, api, custom-branding

## Feature Gating

Use the `checkFeatureAccess` method in the Outseta service:

```javascript
const hasAccess = await outsetaService.checkFeatureAccess(userId, 'teams');
```

## Migration from Local Auth

For existing users without Outseta accounts:

1. Users can log in with Outseta using the same email
2. The system will automatically link their accounts
3. Local passwords are preserved but not used after linking

## Security Considerations

1. Always validate webhook signatures
2. Keep API credentials secure
3. Use HTTPS for all callbacks
4. Regularly rotate webhook secrets

## Testing

For local development, you can use Outseta's test mode:
1. Create a test account at outseta.com
2. Use test API credentials
3. Test webhooks using ngrok or similar tools

## Troubleshooting

### Common Issues

1. **Token Validation Fails**
   - Check API credentials
   - Ensure token hasn't expired
   - Verify API URL is correct

2. **Webhook Not Received**
   - Verify webhook URL is publicly accessible
   - Check webhook secret matches
   - Review Outseta webhook logs

3. **User Not Created**
   - Check database migration ran successfully
   - Verify email uniqueness
   - Review application logs

### Debug Mode

Enable debug logging for Outseta:

```javascript
const logger = createLogger('outseta-service');
logger.level = 'debug';
```

## Support

For Outseta-specific issues:
- Documentation: https://docs.outseta.com
- Support: support@outseta.com

For meetabl integration issues:
- Check application logs
- Review this documentation
- Contact meetabl support