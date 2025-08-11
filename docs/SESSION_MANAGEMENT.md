# Session Management Documentation

## Overview

The meetabl API implements Redis-based session management for scalable, secure session handling across multiple server instances. This replaces the default memory-based sessions with a distributed session store.

## Features

- **Redis-based Storage**: Sessions stored in Redis for scalability and persistence
- **Security Enhancements**: Session hijacking protection, secure cookies, CSRF protection
- **Automatic Cleanup**: Expired sessions automatically removed from Redis
- **Graceful Fallback**: Falls back to memory store if Redis is unavailable
- **Session Security**: User-agent validation, session regeneration helpers

## Configuration

### Environment Variables

Required environment variables for session management:

```bash
# Session configuration
SESSION_SECRET=your-secure-session-secret-min-32-chars
SESSION_TIMEOUT=86400000  # 24 hours in milliseconds (optional)

# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password  # Optional
```

### Redis Configuration

Sessions are stored in Redis with the following configuration:

- **Prefix**: `meetabl:sess:`
- **TTL**: Matches session timeout (24 hours default)
- **Touch Enabled**: Sessions extend on each request

## Session Security Features

### 1. Session Hijacking Protection

The system validates the User-Agent header for each request:

```javascript
// If User-Agent changes, session is destroyed
if (req.session.userAgent !== req.get('User-Agent')) {
  // Session destroyed and 401 returned
}
```

### 2. Secure Cookie Configuration

- **Production**: `secure: true` (HTTPS only)
- **Development**: `secure: false` (HTTP allowed)
- **HttpOnly**: Always `true` (prevents XSS)
- **SameSite**: `strict` in production, `lax` in development

### 3. Session Helpers

Additional session management helpers are available:

```javascript
// Regenerate session (for login/privilege escalation)
req.regenerateSession((err) => {
  if (err) {
    // Handle error
  }
  // Session regenerated with new ID
});

// Destroy session (for logout)
req.destroySession((err) => {
  if (err) {
    // Handle error
  }
  // Session destroyed and cookie cleared
});
```

## Usage Examples

### Basic Session Usage

```javascript
// Store data in session
req.session.userId = user.id;
req.session.role = user.role;

// Read from session
const userId = req.session.userId;

// Check if user is logged in
if (req.session.userId) {
  // User is authenticated
}
```

### Session Regeneration (Login)

```javascript
// After successful login
req.regenerateSession((err) => {
  if (err) {
    return next(err);
  }
  
  req.session.userId = user.id;
  req.session.loginTime = new Date();
  res.json({ success: true });
});
```

### Session Destruction (Logout)

```javascript
// Logout endpoint
req.destroySession((err) => {
  if (err) {
    return next(err);
  }
  
  res.json({ message: 'Logged out successfully' });
});
```

## Monitoring and Troubleshooting

### Redis Connection Monitoring

The system logs Redis connection events:

- **Connected**: Redis client connected successfully
- **Ready**: Redis client ready to receive commands
- **Error**: Connection or command errors
- **Reconnecting**: Attempting to reconnect

### Session Store Fallback

If Redis is unavailable, the system automatically falls back to memory store:

```
WARN: Redis unavailable, falling back to memory session store (not recommended for production)
```

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server is running
   - Verify REDIS_HOST and REDIS_PORT
   - Check network connectivity

2. **Session Not Persisting**
   - Verify Redis is connected
   - Check session timeout configuration
   - Ensure cookies are being sent by client

3. **Session Security Violations**
   - Check for changing User-Agent headers
   - Verify client is maintaining cookies
   - Review session regeneration logic

## Performance Considerations

### Redis Configuration

For production deployments, consider:

- **Persistence**: Configure Redis persistence strategy
- **Memory**: Monitor Redis memory usage
- **Clustering**: Use Redis Cluster for high availability
- **Monitoring**: Implement Redis monitoring and alerting

### Session Data

- Keep session data minimal (avoid storing large objects)
- Use database for complex user data, store only IDs in session
- Consider session data compression for large objects

## Security Best Practices

1. **Secure Environment Variables**
   - Use strong, random SESSION_SECRET (min 32 characters)
   - Rotate session secrets periodically
   - Never commit secrets to version control

2. **Redis Security**
   - Use Redis AUTH (password protection)
   - Configure Redis to bind to localhost only
   - Use Redis over TLS in production

3. **Session Management**
   - Regenerate sessions on privilege changes
   - Implement session timeout warnings
   - Log suspicious session activity

## Migration Guide

### From Memory Sessions

If migrating from memory-based sessions:

1. Install Redis and configure connection
2. Update environment variables
3. Restart application
4. Existing sessions will be lost (users need to re-login)

### Session Data Migration

No data migration is required as session data is temporary by nature. Users will need to log in again after the migration.