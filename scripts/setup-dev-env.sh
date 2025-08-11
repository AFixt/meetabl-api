#!/bin/bash

# meetabl API Development Environment Setup Script
# This script automates the setup of the local development environment

set -e  # Exit on any error

echo "🚀 Setting up meetabl API development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the meetabl-api root directory."
    exit 1
fi

# Check Node.js version
print_status "Checking Node.js version..."
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    if [[ "$NODE_VERSION" =~ ^v22\. ]]; then
        print_success "Node.js $NODE_VERSION is installed"
    else
        print_warning "Node.js 22 is recommended. Current version: $NODE_VERSION"
        echo "Install Node.js 22 LTS from https://nodejs.org/ or use nvm:"
        echo "  nvm install 22 && nvm use 22"
    fi
else
    print_error "Node.js is not installed. Please install Node.js 22 LTS first."
    exit 1
fi

# Check npm version
print_status "Checking npm version..."
NPM_VERSION=$(npm --version)
print_success "npm $NPM_VERSION is installed"

# Install dependencies
print_status "Installing Node.js dependencies..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Check for .env file
print_status "Checking environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_status "Creating .env file from .env.example..."
        cp .env.example .env
        print_warning "Please update .env file with your configuration before starting the server"
        echo "Required variables to update:"
        echo "  - JWT_SECRET (generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
        echo "  - SESSION_SECRET (generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")"
        echo "  - DB_PASSWORD (your MySQL password)"
    else
        print_error ".env.example file not found"
        exit 1
    fi
else
    print_success ".env file already exists"
fi

# Check database configuration
print_status "Checking database configuration..."
if command -v mysql >/dev/null 2>&1; then
    print_success "MySQL client is installed"
    
    # Try to connect to database (will fail gracefully)
    print_status "Testing database connection..."
    if npm run db:migrate:dev --silent >/dev/null 2>&1; then
        print_success "Database connection successful and migrations applied"
    else
        print_warning "Database connection failed or migrations not applied"
        echo "Please ensure:"
        echo "  1. MySQL server is running"
        echo "  2. Database 'meetabl_dev' exists"
        echo "  3. Database credentials in .env are correct"
        echo "  4. Run: npm run db:migrate:dev"
    fi
else
    print_warning "MySQL client not found. Please install MySQL/MariaDB"
fi

# Check Redis (optional)
print_status "Checking Redis configuration..."
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli ping >/dev/null 2>&1; then
        print_success "Redis is running"
    else
        print_warning "Redis is installed but not running"
        echo "Start Redis with: redis-server"
    fi
else
    print_warning "Redis not found (optional). Install with:"
    echo "  macOS: brew install redis"
    echo "  Ubuntu: sudo apt install redis-server"
fi

# Run linting
print_status "Running code quality checks..."
if npm run lint --silent >/dev/null 2>&1; then
    print_success "Code linting passed"
else
    print_warning "Code linting found issues. Run 'npm run lint' to see details"
fi

# Run tests
print_status "Running test suite..."
if npm test --silent >/dev/null 2>&1; then
    print_success "All tests passed"
else
    print_warning "Some tests failed. Run 'npm test' to see details"
fi

# Check external tools
print_status "Checking optional development tools..."

if command -v docker >/dev/null 2>&1; then
    print_success "Docker is installed"
else
    print_warning "Docker not found (optional). Install from https://docker.com"
fi

if command -v pm2 >/dev/null 2>&1; then
    print_success "PM2 is installed"
else
    print_warning "PM2 not found (optional). Install with: npm install -g pm2"
fi

# Create logs directory
print_status "Setting up logs directory..."
mkdir -p logs/audit logs/errors logs/archive
print_success "Logs directories created"

# Final summary
echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env file with your configuration"
echo "  2. Ensure MySQL server is running"
echo "  3. Create database: mysql -u root -p -e \"CREATE DATABASE meetabl_dev;\""
echo "  4. Run migrations: npm run db:migrate:dev"
echo "  5. Start development server: npm run dev"
echo ""
echo "Useful commands:"
echo "  npm run dev          - Start development server"
echo "  npm test            - Run test suite"
echo "  npm run lint        - Check code quality"
echo "  npm run db:migrate:dev - Run database migrations"
echo ""
echo "Documentation:"
echo "  docs/DEVELOPMENT_SETUP.md - Detailed setup guide"
echo "  http://localhost:3000/api/docs - API documentation (when server is running)"
echo "  http://localhost:3000/status - Monitoring dashboard"
echo ""
print_success "Happy coding! 🚀"