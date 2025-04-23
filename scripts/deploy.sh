#!/bin/bash

# Deployment script for meetabl API
# This script is executed by CI/CD pipeline

set -e # Exit immediately if a command exits with a non-zero status

echo "Deploying meetabl API..."

# Load environment variables
source .env.production

# Install dependencies if needed
echo "Installing production dependencies..."
npm ci --production

# Run database migrations
echo "Running database migrations..."
NODE_ENV=production npm run db:migrate:prod

# Restart the application
echo "Restarting application..."
pm2 reload all || pm2 start src/index.js --name "meetabl-api" --env production

echo "Deployment completed successfully!"
