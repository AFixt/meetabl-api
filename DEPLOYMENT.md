# AccessMeet API Deployment Guide

This document provides detailed instructions for deploying the AccessMeet API to various environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
   - [Local Development](#local-development)
   - [Production Deployment](#production-deployment)
     - [Traditional Server](#traditional-server)
     - [Docker Deployment](#docker-deployment)
     - [Cloud Deployment](#cloud-deployment)
5. [SSL Configuration](#ssl-configuration)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Recovery](#backup--recovery)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying the AccessMeet API, ensure you have:

- Node.js (v16 or later recommended)
- MySQL or MariaDB (v8.0 or later recommended)
- Git
- NPM or Yarn
- A server or cloud environment for production deployment
- Domain name (for production)

## Environment Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-organization/accessmeet-api.git
   cd accessmeet-api
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   Create a `.env` file based on the `.env.example` template:
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**:
   Edit the `.env` file with your specific settings:
   ```
   # Server Configuration
   PORT=4000
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-domain.com
   
   # Database Configuration
   DB_HOST=localhost
   DB_USER=accessmeet_user
   DB_PASSWORD=strong_password_here
   DB_NAME=accessmeet
   DB_PORT=3306
   
   # JWT Configuration
   JWT_SECRET=your_very_strong_secret_key_here
   JWT_EXPIRES_IN=7d
   JWT_REFRESH_EXPIRES_IN=30d
   
   # Google Calendar API
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=https://your-api-domain.com/api/calendar/google/callback
   
   # Microsoft Graph API
   MICROSOFT_CLIENT_ID=your_microsoft_client_id
   MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
   MICROSOFT_REDIRECT_URI=https://your-api-domain.com/api/calendar/microsoft/callback
   ```

## Database Setup

1. **Create the database**:
   ```bash
   mysql -u root -p -e "CREATE DATABASE accessmeet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. **Create a database user**:
   ```bash
   mysql -u root -p -e "CREATE USER 'accessmeet_user'@'localhost' IDENTIFIED BY 'strong_password_here';"
   mysql -u root -p -e "GRANT ALL PRIVILEGES ON accessmeet.* TO 'accessmeet_user'@'localhost';"
   mysql -u root -p -e "FLUSH PRIVILEGES;"
   ```

3. **Import the database schema**:
   ```bash
   mysql -u accessmeet_user -p accessmeet < install.sql
   ```

4. **Run database migrations** (if needed):
   ```bash
   npm run db:migrate
   ```

## Application Deployment

### Local Development

For local development and testing:

```bash
# Start in development mode with hot-reloading
npm run dev

# Start in production mode
npm start
```

### Production Deployment

#### Traditional Server

1. **Set up Node.js on your server**:
   - Ubuntu/Debian:
     ```bash
     curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
     sudo apt-get install -y nodejs
     ```
   - CentOS/RHEL:
     ```bash
     curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
     sudo yum install -y nodejs
     ```

2. **Deploy the application code**:
   ```bash
   git clone https://github.com/your-organization/accessmeet-api.git
   cd accessmeet-api
   npm install --production
   ```

3. **Set up environment variables**:
   Either create the `.env` file or set environment variables in your system.

4. **Use PM2 for process management**:
   ```bash
   # Install PM2 globally
   npm install -g pm2
   
   # Start the application with PM2
   pm2 start src/index.js --name "accessmeet-api"
   
   # Configure PM2 to start on system boot
   pm2 startup
   pm2 save
   
   # Monitor the application
   pm2 monit
   ```

#### Docker Deployment

1. **Create a Dockerfile** in the project root:
   ```dockerfile
   FROM node:16-alpine

   WORKDIR /app

   COPY package*.json ./
   RUN npm ci --only=production

   COPY . .

   EXPOSE 4000

   CMD ["node", "src/index.js"]
   ```

2. **Create a docker-compose.yml file**:
   ```yaml
   version: '3'

   services:
     api:
       build: .
       ports:
         - "4000:4000"
       environment:
         - NODE_ENV=production
         - PORT=4000
         # Add other environment variables here
       restart: always
       depends_on:
         - db
     
     db:
       image: mysql:8.0
       ports:
         - "3306:3306"
       environment:
         - MYSQL_ROOT_PASSWORD=root_password
         - MYSQL_DATABASE=accessmeet
         - MYSQL_USER=accessmeet_user
         - MYSQL_PASSWORD=strong_password_here
       volumes:
         - mysql_data:/var/lib/mysql
         - ./install.sql:/docker-entrypoint-initdb.d/install.sql
       restart: always

   volumes:
     mysql_data:
   ```

3. **Build and run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

#### Cloud Deployment

##### AWS Elastic Beanstalk

1. **Install the EB CLI**:
   ```bash
   pip install awsebcli
   ```

2. **Initialize EB application**:
   ```bash
   eb init
   ```

3. **Create an environment and deploy**:
   ```bash
   eb create
   ```

4. **Configure environment variables**:
   ```bash
   eb setenv NODE_ENV=production PORT=4000 JWT_SECRET=your_secret_key ...
   ```

##### Heroku

1. **Install Heroku CLI**:
   ```bash
   npm install -g heroku
   ```

2. **Login to Heroku**:
   ```bash
   heroku login
   ```

3. **Create a Heroku app**:
   ```bash
   heroku create accessmeet-api
   ```

4. **Add MySQL add-on**:
   ```bash
   heroku addons:create jawsdb:kitefin
   ```

5. **Set environment variables**:
   ```bash
   heroku config:set NODE_ENV=production JWT_SECRET=your_secret_key ...
   ```

6. **Deploy to Heroku**:
   ```bash
   git push heroku main
   ```

7. **Run database migrations**:
   ```bash
   heroku run npm run db:migrate
   ```

## SSL Configuration

For production, always use HTTPS:

### Using Nginx as a reverse proxy:

1. **Install Nginx**:
   ```bash
   sudo apt update
   sudo apt install -y nginx
   ```

2. **Configure Nginx**:
   Create a new site configuration at `/etc/nginx/sites-available/accessmeet-api`:
   ```nginx
   server {
       listen 80;
       server_name api.your-domain.com;
       
       # Redirect HTTP to HTTPS
       location / {
           return 301 https://$host$request_uri;
       }
   }

   server {
       listen 443 ssl;
       server_name api.your-domain.com;
       
       # SSL Certificate Configuration
       ssl_certificate /path/to/fullchain.pem;
       ssl_certificate_key /path/to/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_prefer_server_ciphers on;
       
       # Proxy to Node.js application
       location / {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Enable the site and restart Nginx**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/accessmeet-api /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Set up Let's Encrypt for free SSL**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d api.your-domain.com
   ```

## Monitoring & Logging

### Logging

The application uses Bunyan for logging. In production, logs are stored in the `logs` directory.

To view structured logs:
```bash
npx bunyan logs/accessmeet-api.log
```

### Monitoring

1. **Setup basic monitoring with PM2**:
   ```bash
   pm2 monit
   ```

2. **Enable remote PM2 monitoring with PM2 Plus**:
   ```bash
   pm2 plus
   ```

3. **Set up application performance monitoring with New Relic or similar**:
   Add this to your `.env` file:
   ```
   NEW_RELIC_LICENSE_KEY=your_license_key
   NEW_RELIC_APP_NAME=AccessMeet API
   ```

   And install the dependency:
   ```bash
   npm install newrelic
   ```

## Backup & Recovery

### Database Backup

1. **Set up automated MySQL backups**:
   Create a backup script `backup.sh`:
   ```bash
   #!/bin/bash
   BACKUP_DIR="/path/to/backups"
   MYSQL_USER="accessmeet_user"
   MYSQL_PASSWORD="your_password"
   MYSQL_DATABASE="accessmeet"
   DATE=$(date +%Y-%m-%d-%H%M%S)
   
   # Create backup
   mysqldump -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE | gzip > $BACKUP_DIR/accessmeet-backup-$DATE.sql.gz
   
   # Keep only the last 7 days of backups
   find $BACKUP_DIR -name "accessmeet-backup-*.sql.gz" -mtime +7 -delete
   ```

2. **Make it executable and schedule with cron**:
   ```bash
   chmod +x backup.sh
   crontab -e
   ```
   
   Add this line to run the backup daily at 2 AM:
   ```
   0 2 * * * /path/to/backup.sh
   ```

### Database Recovery

To restore from a backup:
```bash
gunzip -c backup-file.sql.gz | mysql -u accessmeet_user -p accessmeet
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check if MySQL is running: `sudo systemctl status mysql`
   - Verify database credentials in `.env` file
   - Ensure the database exists: `mysql -u root -p -e "SHOW DATABASES;"`
   - Check network connectivity if using a remote database

2. **Application Won't Start**:
   - Check for syntax errors: `node -c src/index.js`
   - Review logs: `cat logs/accessmeet-api.log | npx bunyan`
   - Verify that all required environment variables are set
   - Check if the port is already in use: `lsof -i :4000`

3. **SSL/HTTPS Issues**:
   - Verify certificate paths in Nginx configuration
   - Check certificate expiration: `openssl x509 -enddate -noout -in /path/to/fullchain.pem`
   - Ensure firewall allows HTTPS traffic: `sudo ufw status`

4. **Performance Issues**:
   - Check server resources: `top`, `free -m`, `df -h`
   - Review database indexing
   - Consider scaling options (more memory, CPU, or horizontal scaling)

### Getting Help

If you encounter issues not covered in this guide:

1. Check the project's GitHub Issues for similar problems
2. Review the code documentation in the `docs/` directory
3. Contact the development team via [contact information]

---

This deployment guide should be periodically updated as the project evolves.