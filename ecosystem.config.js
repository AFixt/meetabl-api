/**
 * PM2 Process Configuration for meetabl API
 * 
 * Defines process management for different environments:
 * - development: Uses nodemon for auto-restart on file changes
 * - staging: Production-like setup with clustering
 * - production: Full production setup with clustering and monitoring
 * 
 * @author meetabl Team
 */

module.exports = {
  apps: [
    {
      // Development configuration with nodemon
      name: 'meetabl-api-dev',
      script: './src/index.js',
      watch: true,
      watch_delay: 1000,
      ignore_watch: [
        'node_modules',
        'logs',
        'coverage',
        'tests',
        '*.log',
        '*.test.js'
      ],
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Development-specific options
      log_file: './logs/dev-combined.log',
      out_file: './logs/dev-out.log',
      error_file: './logs/dev-error.log',
      time: true,
      // Node.js options for development
      node_args: '--inspect',
      // Environment variables for development
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        DEBUG: 'meetabl:*'
      }
    },
    {
      // Staging configuration
      name: 'meetabl-api-staging',
      script: './src/index.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'staging',
        PORT: 3001
      },
      // Staging-specific logging
      log_file: './logs/staging-combined.log',
      out_file: './logs/staging-out.log',
      error_file: './logs/staging-error.log',
      time: true,
      // Monitoring
      monitoring: false,
      pmx: true
    },
    {
      // Production configuration
      name: 'meetabl-api-prod',
      script: './src/index.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      watch: false,
      autorestart: true,
      max_restarts: 3,
      min_uptime: '60s',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      // Production logging
      log_file: './logs/prod-combined.log',
      out_file: './logs/prod-out.log',
      error_file: './logs/prod-error.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Production monitoring
      monitoring: true,
      pmx: true,
      // Advanced production options
      kill_timeout: 5000,
      listen_timeout: 8000,
      // Node.js production optimizations
      node_args: '--max-old-space-size=1024'
    }
  ],

  // Deployment configuration
  deploy: {
    development: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/meetabl.git',
      path: '/var/www/meetabl-dev',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run db:migrate:dev && pm2 reload ecosystem.config.js --env development',
      'pre-setup': ''
    },
    staging: {
      user: 'node',
      host: ['staging-server-ip'],
      ref: 'origin/staging',
      repo: 'git@github.com:your-org/meetabl.git',
      path: '/var/www/meetabl-staging',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run db:migrate:staging && pm2 reload ecosystem.config.js --env staging',
      'pre-setup': ''
    },
    production: {
      user: 'node',
      host: ['prod-server-1-ip', 'prod-server-2-ip'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/meetabl.git',
      path: '/var/www/meetabl-prod',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run db:migrate:prod && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};