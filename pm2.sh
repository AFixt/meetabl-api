#!/bin/bash

# PM2 Management Script for meetabl API
# Provides convenient commands for managing PM2 processes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

show_usage() {
    echo "PM2 Management Script for meetabl API"
    echo ""
    echo "Usage: $0 [COMMAND] [ENVIRONMENT]"
    echo ""
    echo "Commands:"
    echo "  start [env]     Start the application (default: development)"
    echo "  stop            Stop all processes"
    echo "  restart [env]   Restart processes"
    echo "  reload [env]    Reload processes (zero-downtime)"
    echo "  delete          Delete all processes"
    echo "  status          Show process status"
    echo "  logs            Show real-time logs"
    echo "  monit           Open PM2 monitoring interface"
    echo "  setup           Initial PM2 setup (create logs directory)"
    echo ""
    echo "Environments:"
    echo "  development     Development mode with file watching"
    echo "  staging         Staging mode with clustering"
    echo "  production      Production mode with full clustering"
    echo ""
    echo "Examples:"
    echo "  $0 start                  # Start in development mode"
    echo "  $0 start production       # Start in production mode"
    echo "  $0 restart staging        # Restart staging processes"
    echo "  $0 logs                   # View real-time logs"
}

# Check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 is not installed. Install it with: npm install -g pm2"
        exit 1
    fi
}

# Setup logs directory
setup() {
    print_step "Setting up PM2 environment..."
    
    # Create logs directory
    mkdir -p logs
    print_status "Created logs directory"
    
    # Set PM2 to start on system boot (optional)
    read -p "Do you want PM2 to start on system boot? [y/N]: " setup_startup
    if [[ $setup_startup =~ ^[Yy]$ ]]; then
        pm2 startup
        print_status "PM2 startup configuration generated"
        print_warning "Run the displayed command with sudo to complete setup"
    fi
    
    print_status "PM2 setup completed"
}

# Start processes
start() {
    local env=${1:-development}
    
    print_step "Starting meetabl API in $env mode..."
    
    # Create logs directory if it doesn't exist
    mkdir -p logs
    
    # Start the appropriate environment
    case $env in
        dev|development)
            pm2 start ecosystem.config.js --env development
            print_status "Started in development mode with file watching"
            ;;
        staging)
            pm2 start ecosystem.config.js --env staging
            print_status "Started in staging mode with clustering"
            ;;
        prod|production)
            pm2 start ecosystem.config.js --env production
            print_status "Started in production mode with full clustering"
            ;;
        *)
            print_error "Unknown environment: $env"
            print_warning "Valid environments: development, staging, production"
            exit 1
            ;;
    esac
    
    # Show status
    pm2 status
}

# Stop processes
stop() {
    print_step "Stopping all meetabl API processes..."
    pm2 stop ecosystem.config.js
    print_status "All processes stopped"
}

# Restart processes
restart() {
    local env=${1:-development}
    
    print_step "Restarting meetabl API in $env mode..."
    
    case $env in
        dev|development)
            pm2 restart meetabl-api-dev
            ;;
        staging)
            pm2 restart meetabl-api-staging
            ;;
        prod|production)
            pm2 restart meetabl-api-prod
            ;;
        *)
            pm2 restart ecosystem.config.js
            ;;
    esac
    
    print_status "Processes restarted"
    pm2 status
}

# Reload processes (zero-downtime)
reload() {
    local env=${1:-development}
    
    print_step "Reloading meetabl API in $env mode (zero-downtime)..."
    
    case $env in
        dev|development)
            pm2 reload meetabl-api-dev
            ;;
        staging)
            pm2 reload meetabl-api-staging
            ;;
        prod|production)
            pm2 reload meetabl-api-prod
            ;;
        *)
            pm2 reload ecosystem.config.js
            ;;
    esac
    
    print_status "Processes reloaded"
    pm2 status
}

# Delete all processes
delete() {
    print_step "Deleting all meetabl API processes..."
    pm2 delete ecosystem.config.js 2>/dev/null || print_warning "No processes to delete"
    print_status "All processes deleted"
}

# Show status
status() {
    print_step "Process status:"
    pm2 status
}

# Show logs
logs() {
    print_step "Showing real-time logs (Ctrl+C to exit)..."
    pm2 logs
}

# Open monitoring interface
monit() {
    print_step "Opening PM2 monitoring interface..."
    pm2 monit
}

# Parse command
case "${1:-help}" in
    start)
        check_pm2
        start "$2"
        ;;
    stop)
        check_pm2
        stop
        ;;
    restart)
        check_pm2
        restart "$2"
        ;;
    reload)
        check_pm2
        reload "$2"
        ;;
    delete)
        check_pm2
        delete
        ;;
    status)
        check_pm2
        status
        ;;
    logs)
        check_pm2
        logs
        ;;
    monit)
        check_pm2
        monit
        ;;
    setup)
        check_pm2
        setup
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac