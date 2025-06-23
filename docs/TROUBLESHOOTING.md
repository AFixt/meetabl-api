# Troubleshooting Guide

This document provides solutions to common issues encountered when developing, deploying, and running the meetabl API. Use this guide to quickly diagnose and resolve problems.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Database Connection Problems](#database-connection-problems)
3. [Authentication & Authorization](#authentication--authorization)
4. [API Errors](#api-errors)
5. [Performance Issues](#performance-issues)
6. [Integration Problems](#integration-problems)
7. [Deployment Issues](#deployment-issues)
8. [Development Environment](#development-environment)
9. [Testing Issues](#testing-issues)
10. [Common Error Messages](#common-error-messages)

## Installation Issues

### Problem: `npm install` fails with permission errors

**Symptoms:**
```bash
npm ERR! code EACCES
npm ERR! syscall access
npm ERR! path /usr/local/lib/node_modules
```

**Solution:**
1. Never use `sudo` with npm. Instead, fix npm permissions:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

2. Or use a Node version manager (recommended):
   ```bash
   # Install nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   # Install Node.js 22
   nvm install 22
   nvm use 22
   ```

### Problem: `node-gyp` rebuild fails

**Symptoms:**
```bash
gyp ERR! build error
gyp ERR! stack Error: `make` failed with exit code: 2
```

**Solution:**
1. Install build tools:
   ```bash
   # macOS
   xcode-select --install
   
   # Ubuntu/Debian
   sudo apt-get install build-essential
   
   # CentOS/RHEL
   sudo yum groupinstall 'Development Tools'
   ```

2. Clear npm cache and reinstall:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

## Database Connection Problems

### Problem: Cannot connect to MySQL database

**Symptoms:**
```
SequelizeConnectionError: Connection lost: The server closed the connection
```

**Solution:**
1. Verify MySQL is running:
   ```bash
   # Check service status
   systemctl status mysql  # Linux
   brew services list      # macOS with Homebrew
   ```

2. Check database credentials in environment:
   ```bash
   # Verify .env file exists and contains:
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=meetabl_dev
   DB_USER=your_user
   DB_PASSWORD=your_password
   ```

3. Test connection manually:
   ```bash
   mysql -h localhost -u your_user -p
   ```

4. Check firewall/security group settings if remote database

### Problem: "Unknown database" error

**Symptoms:**
```
SequelizeDatabaseError: Unknown database 'meetabl_dev'
```

**Solution:**
1. Create the database:
   ```bash
   mysql -u root -p
   CREATE DATABASE meetabl_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE DATABASE meetabl_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Grant permissions:
   ```sql
   GRANT ALL PRIVILEGES ON meetabl_dev.* TO 'your_user'@'localhost';
   GRANT ALL PRIVILEGES ON meetabl_test.* TO 'your_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Problem: Migration fails

**Symptoms:**
```
ERROR: Table already exists
```

**Solution:**
1. Check migration status:
   ```bash
   npm run db:migrate:status
   ```

2. Reset database (development only):
   ```bash
   # Drop and recreate database
   npx sequelize-cli db:drop
   npx sequelize-cli db:create
   npm run db:migrate
   npm run db:seed
   ```

3. For production, create a down migration to fix the issue

## Authentication & Authorization

### Problem: JWT token expired immediately

**Symptoms:**
```json
{
  "error": "Token expired",
  "code": "TOKEN_EXPIRED"
}
```

**Solution:**
1. Check server time synchronization:
   ```bash
   date
   # If time is wrong, sync with NTP
   sudo ntpdate -s time.nist.gov
   ```

2. Verify token expiration settings:
   ```javascript
   // Check JWT_EXPIRY in .env
   JWT_EXPIRY=15m  // Should be 15m for access tokens
   JWT_REFRESH_EXPIRY=7d  // Should be 7d for refresh tokens
   ```

### Problem: "Invalid token" errors

**Symptoms:**
```json
{
  "error": "Invalid token",
  "code": "INVALID_TOKEN"
}
```

**Solution:**
1. Ensure you're sending the token correctly:
   ```javascript
   // Correct header format
   Authorization: Bearer <your-token-here>
   ```

2. Check JWT_SECRET matches between environments
3. Verify token hasn't been blacklisted
4. Clear browser cache/cookies if using web client

### Problem: CORS errors

**Symptoms:**
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solution:**
1. Check allowed origins in `src/app.js`:
   ```javascript
   const allowedOrigins = [
     'http://localhost:3000',  // Add your frontend URL
     'https://yourdomain.com'
   ];
   ```

2. For development, temporarily allow all origins:
   ```javascript
   app.use(cors({
     origin: process.env.NODE_ENV === 'development' ? '*' : allowedOrigins,
     credentials: true
   }));
   ```

## API Errors

### Problem: 429 Too Many Requests

**Symptoms:**
```json
{
  "error": "Too many requests, please try again later"
}
```

**Solution:**
1. Rate limit is 100 requests per 15 minutes per IP
2. Implement exponential backoff in client:
   ```javascript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.status === 429 && i < maxRetries - 1) {
           await new Promise(resolve => 
             setTimeout(resolve, Math.pow(2, i) * 1000)
           );
         } else {
           throw error;
         }
       }
     }
   }
   ```

### Problem: 500 Internal Server Error

**Solution:**
1. Check application logs:
   ```bash
   # View recent logs
   tail -f logs/bunyan.log | bunyan
   
   # Search for errors
   grep "ERROR" logs/error.log
   ```

2. Enable debug mode for detailed errors:
   ```bash
   NODE_ENV=development npm run dev
   ```

3. Check for common issues:
   - Missing environment variables
   - Database connection issues
   - Syntax errors in recent code changes

## Performance Issues

### Problem: Slow API responses

**Solution:**
1. Enable query logging to identify slow queries:
   ```javascript
   // In database config
   logging: console.log
   ```

2. Add database indexes:
   ```javascript
   // Check for missing indexes
   await sequelize.query("SHOW INDEX FROM bookings");
   ```

3. Use query optimization:
   ```javascript
   // Bad: N+1 query problem
   const users = await User.findAll();
   for (const user of users) {
     user.bookings = await user.getBookings();
   }
   
   // Good: Eager loading
   const users = await User.findAll({
     include: [{ model: Booking }]
   });
   ```

4. Enable caching:
   ```bash
   # Install and start Redis
   redis-server
   
   # Set in .env
   REDIS_URL=redis://localhost:6379
   ```

### Problem: High memory usage

**Solution:**
1. Check for memory leaks:
   ```bash
   # Monitor memory usage
   node --inspect src/index.js
   # Open chrome://inspect in Chrome
   ```

2. Limit concurrent operations:
   ```javascript
   // Use p-limit for concurrent operations
   const pLimit = require('p-limit');
   const limit = pLimit(10); // Max 10 concurrent
   
   await Promise.all(
     items.map(item => limit(() => processItem(item)))
   );
   ```

## Integration Problems

### Problem: Google Calendar sync fails

**Symptoms:**
```
Error: Invalid grant: authorization code has expired
```

**Solution:**
1. Refresh OAuth tokens:
   ```javascript
   // Force token refresh
   await CalendarToken.update(
     { accessToken: null },
     { where: { userId, provider: 'google' } }
   );
   ```

2. Re-authenticate user through OAuth flow
3. Check Google API quotas and limits

### Problem: Email notifications not sending

**Solution:**
1. Verify SMTP settings:
   ```bash
   # Test SMTP connection
   npm run test:smtp
   ```

2. Check email service credentials:
   ```bash
   # .env file should contain
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

3. For Gmail, use App Password, not regular password
4. Check spam folder and sender reputation

## Deployment Issues

### Problem: Application won't start in production

**Solution:**
1. Check all environment variables are set:
   ```bash
   # List required variables
   node -e "console.log(require('./src/config/env-schema.js'))"
   ```

2. Verify Node.js version:
   ```bash
   node --version  # Should be 22.x
   ```

3. Check PM2 logs:
   ```bash
   pm2 logs meetabl-api --lines 100
   pm2 describe meetabl-api
   ```

### Problem: Docker container fails to start

**Solution:**
1. Check Docker logs:
   ```bash
   docker logs meetabl-api --tail 100
   ```

2. Verify Dockerfile:
   ```dockerfile
   # Ensure correct Node version
   FROM node:22-alpine
   ```

3. Test build locally:
   ```bash
   docker build -t meetabl-api .
   docker run -p 3000:3000 meetabl-api
   ```

## Development Environment

### Problem: Hot reload not working

**Solution:**
1. Check nodemon configuration:
   ```json
   // nodemon.json
   {
     "watch": ["src"],
     "ext": "js,json",
     "ignore": ["src/**/*.test.js"],
     "exec": "node src/index.js"
   }
   ```

2. For WSL2 users, use polling:
   ```json
   {
     "watch": ["src"],
     "ext": "js",
     "legacyWatch": true,
     "polling": true
   }
   ```

### Problem: VS Code IntelliSense not working

**Solution:**
1. Create jsconfig.json:
   ```json
   {
     "compilerOptions": {
       "module": "commonjs",
       "target": "es2022",
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"]
       }
     },
     "exclude": ["node_modules"]
   }
   ```

2. Restart VS Code language server:
   - Cmd/Ctrl + Shift + P
   - "TypeScript: Restart TS Server"

## Testing Issues

### Problem: Tests fail with "Cannot find module"

**Solution:**
1. Clear Jest cache:
   ```bash
   npx jest --clearCache
   ```

2. Check Jest configuration:
   ```javascript
   // jest.config.js
   module.exports = {
     testEnvironment: 'node',
     setupFilesAfterEnv: ['<rootDir>/tests/fixtures/setup.js'],
     moduleDirectories: ['node_modules', 'src']
   };
   ```

### Problem: Database tests interfering with each other

**Solution:**
1. Use transactions for test isolation:
   ```javascript
   beforeEach(async () => {
     this.transaction = await sequelize.transaction();
   });
   
   afterEach(async () => {
     await this.transaction.rollback();
   });
   ```

2. Use separate test database:
   ```bash
   NODE_ENV=test npm test
   ```

## Common Error Messages

### "EADDRINUSE: address already in use"

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### "Cannot find module 'bcrypt'"

**Solution:**
```bash
# Rebuild native modules
npm rebuild bcrypt
# Or reinstall
npm uninstall bcrypt
npm install bcrypt
```

### "SequelizeValidationError"

**Solution:**
1. Check the error details for field-specific issues
2. Verify data types match model definitions
3. Check for required fields
4. Validate data before sending to API

### "PayloadTooLargeError"

**Solution:**
1. Check request size limits:
   ```javascript
   app.use(express.json({ limit: '10mb' }));
   ```
2. Compress large payloads
3. Use multipart upload for files

## Getting Help

If you can't resolve an issue using this guide:

1. **Check logs** for detailed error messages
2. **Search existing issues** on GitHub
3. **Create a detailed bug report** including:
   - Error messages and stack traces
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)
   - Recent changes made

### Debug Mode

Enable detailed debugging:
```bash
# Debug all
DEBUG=* npm run dev

# Debug specific modules
DEBUG=express:* npm run dev
DEBUG=sequelize:* npm run dev
```

### Support Channels

- GitHub Issues: [github.com/meetabl/meetabl-api/issues](https://github.com/meetabl/meetabl-api/issues)
- Developer Forum: [forum.meetabl.com](https://forum.meetabl.com)
- Stack Overflow: Tag with `meetabl`

## Quick Reference

### Essential Commands

```bash
# Development
npm run dev                    # Start development server
npm run lint                   # Run all linters
npm test                       # Run all tests
npm run test:watch            # Run tests in watch mode

# Database
npm run db:migrate            # Run migrations
npm run db:seed              # Seed database
npm run db:reset             # Reset database (dev only)

# Production
npm start                    # Start production server
pm2 start ecosystem.config.js # Start with PM2
pm2 logs                     # View logs
pm2 restart all             # Restart all processes

# Debugging
node --inspect src/index.js  # Start with debugger
npm run test:debug          # Debug tests
```

### Environment Variables Reference

```bash
# Required
NODE_ENV=development|test|production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=meetabl_dev
DB_USER=dbuser
DB_PASSWORD=dbpass
JWT_SECRET=your-secret-key
JWT_EXPIRY=15m

# Optional
REDIS_URL=redis://localhost:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASS=app-password
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
SENTRY_DSN=your-sentry-dsn
```

Remember: When in doubt, check the logs first!