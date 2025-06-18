#!/bin/bash

# Performance Benchmark Runner Script
# 
# This script helps run performance benchmarks with different Node.js versions
# and manages the process of comparing results.
#
# Usage:
#   ./scripts/benchmark-runner.sh api           # Run API benchmarks
#   ./scripts/benchmark-runner.sh db            # Run database benchmarks
#   ./scripts/benchmark-runner.sh both          # Run both benchmarks
#   ./scripts/benchmark-runner.sh compare       # Generate comparison reports
#   ./scripts/benchmark-runner.sh compare-api   # Compare API results only
#   ./scripts/benchmark-runner.sh compare-db    # Compare DB results only
#   ./scripts/benchmark-runner.sh clean         # Clean old results
#
# Author: meetabl Team

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$PROJECT_DIR/benchmark-results"
PID_FILE="$PROJECT_DIR/.benchmark-server.pid"

# Default configuration
DEFAULT_PORT=3000
DEFAULT_HOST="localhost"
SERVER_START_TIMEOUT=30

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_node_version() {
    local node_version=$(node --version)
    log_info "Current Node.js version: $node_version"
    
    # Check if it's Node.js 20 or 22
    if [[ $node_version == v20.* ]] || [[ $node_version == v22.* ]]; then
        log_success "Node.js version is suitable for benchmarking"
        return 0
    else
        log_warning "Node.js version is not 20 or 22. Results may not be comparable."
        return 0
    fi
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        return 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        return 1
    fi
    
    # Check if package.json exists
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        log_error "package.json not found in project directory"
        return 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "$PROJECT_DIR/node_modules" ]; then
        log_warning "node_modules not found. Running npm install..."
        cd "$PROJECT_DIR"
        npm install
    fi
    
    return 0
}

setup_environment() {
    log_info "Setting up environment..."
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    mkdir -p "$RESULTS_DIR/database"
    
    # Set environment variables for testing
    export NODE_ENV=development
    export BENCHMARK_HOST=${BENCHMARK_HOST:-$DEFAULT_HOST}
    export BENCHMARK_PORT=${BENCHMARK_PORT:-$DEFAULT_PORT}
    export BENCHMARK_PROTOCOL=${BENCHMARK_PROTOCOL:-http}
    
    # Ensure required environment variables are set
    if [ -z "$JWT_SECRET" ]; then
        export JWT_SECRET="BenchmarkJwtSecret123456789012345678901234567890"
        log_warning "JWT_SECRET not set, using default for benchmarking"
    fi
    
    if [ -z "$DB_HOST" ]; then
        export DB_HOST="localhost"
        log_warning "DB_HOST not set, using localhost"
    fi
    
    log_success "Environment setup complete"
}

start_server() {
    log_info "Starting server for API benchmarks..."
    
    cd "$PROJECT_DIR"
    
    # Kill any existing server
    stop_server
    
    # Start server in background
    npm run dev > /dev/null 2>&1 &
    local server_pid=$!
    
    # Save PID
    echo $server_pid > "$PID_FILE"
    
    # Wait for server to start
    local attempts=0
    while [ $attempts -lt $SERVER_START_TIMEOUT ]; do
        if curl -s "http://$BENCHMARK_HOST:$BENCHMARK_PORT/" > /dev/null 2>&1; then
            log_success "Server started successfully (PID: $server_pid)"
            return 0
        fi
        
        # Check if process is still running
        if ! kill -0 $server_pid 2>/dev/null; then
            log_error "Server process died during startup"
            return 1
        fi
        
        sleep 1
        ((attempts++))
    done
    
    log_error "Server failed to start within $SERVER_START_TIMEOUT seconds"
    stop_server
    return 1
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        local server_pid=$(cat "$PID_FILE")
        if kill -0 $server_pid 2>/dev/null; then
            log_info "Stopping server (PID: $server_pid)..."
            kill $server_pid
            
            # Wait for process to die
            local attempts=0
            while kill -0 $server_pid 2>/dev/null && [ $attempts -lt 10 ]; do
                sleep 1
                ((attempts++))
            done
            
            # Force kill if still running
            if kill -0 $server_pid 2>/dev/null; then
                log_warning "Force killing server process"
                kill -9 $server_pid
            fi
            
            log_success "Server stopped"
        fi
        rm -f "$PID_FILE"
    fi
}

run_api_benchmark() {
    log_info "Running API performance benchmarks..."
    
    if ! start_server; then
        log_error "Failed to start server for API benchmarks"
        return 1
    fi
    
    # Give server a moment to fully initialize
    sleep 2
    
    cd "$PROJECT_DIR"
    
    # Run the API benchmark
    if node "$SCRIPT_DIR/performance-benchmark.js"; then
        log_success "API benchmark completed successfully"
        local result=$?
    else
        log_error "API benchmark failed"
        local result=1
    fi
    
    stop_server
    return $result
}

run_db_benchmark() {
    log_info "Running database performance benchmarks..."
    
    cd "$PROJECT_DIR"
    
    # Run the database benchmark
    if node "$SCRIPT_DIR/db-performance-benchmark.js"; then
        log_success "Database benchmark completed successfully"
        return 0
    else
        log_error "Database benchmark failed"
        return 1
    fi
}

generate_comparison() {
    local benchmark_type="$1"
    
    if [ "$benchmark_type" = "api" ] || [ "$benchmark_type" = "both" ]; then
        log_info "Generating API benchmark comparison..."
        cd "$PROJECT_DIR"
        
        if node "$SCRIPT_DIR/performance-benchmark.js" compare; then
            log_success "API comparison report generated"
        else
            log_warning "API comparison failed (may need more result files)"
        fi
    fi
    
    if [ "$benchmark_type" = "db" ] || [ "$benchmark_type" = "both" ]; then
        log_info "Generating database benchmark comparison..."
        
        # Check if we have multiple DB result files
        local db_files=$(find "$RESULTS_DIR/database" -name "db-benchmark-node-*.json" 2>/dev/null | wc -l)
        
        if [ "$db_files" -ge 2 ]; then
            log_info "Found $db_files database result files"
            # Here you could add a comparison script for DB results
            log_success "Database comparison would be generated (script not implemented yet)"
        else
            log_warning "Need at least 2 database result files for comparison (found $db_files)"
        fi
    fi
}

clean_results() {
    log_info "Cleaning old benchmark results..."
    
    if [ -d "$RESULTS_DIR" ]; then
        rm -rf "$RESULTS_DIR"
        log_success "Benchmark results cleaned"
    else
        log_info "No results to clean"
    fi
}

show_usage() {
    echo "Usage: $0 {api|db|both|compare|compare-api|compare-db|clean}"
    echo ""
    echo "Commands:"
    echo "  api           Run API performance benchmarks"
    echo "  db            Run database performance benchmarks"
    echo "  both          Run both API and database benchmarks"
    echo "  compare       Generate comparison reports for all benchmarks"
    echo "  compare-api   Generate comparison report for API benchmarks only"
    echo "  compare-db    Generate comparison report for database benchmarks only"
    echo "  clean         Clean old benchmark results"
    echo ""
    echo "Environment variables:"
    echo "  BENCHMARK_HOST     Server host (default: localhost)"
    echo "  BENCHMARK_PORT     Server port (default: 3000)"
    echo "  BENCHMARK_PROTOCOL Protocol (default: http)"
    echo ""
    echo "Examples:"
    echo "  # Run with Node.js 20"
    echo "  nvm use 20"
    echo "  $0 both"
    echo ""
    echo "  # Run with Node.js 22"
    echo "  nvm use 22"
    echo "  $0 both"
    echo ""
    echo "  # Generate comparison"
    echo "  $0 compare"
}

show_results_summary() {
    log_info "Benchmark Results Summary:"
    
    local api_files=$(find "$RESULTS_DIR" -maxdepth 1 -name "benchmark-node-*.json" 2>/dev/null | wc -l)
    local db_files=$(find "$RESULTS_DIR/database" -name "db-benchmark-node-*.json" 2>/dev/null | wc -l)
    
    echo "  API benchmark files: $api_files"
    echo "  Database benchmark files: $db_files"
    
    if [ -d "$RESULTS_DIR" ]; then
        echo "  Results directory: $RESULTS_DIR"
        echo "  Latest files:"
        find "$RESULTS_DIR" -name "*.json" -type f -exec ls -lt {} + | head -5 | sed 's/^/    /'
    fi
}

# Cleanup function for graceful exit
cleanup() {
    log_info "Cleaning up..."
    stop_server
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main script logic
main() {
    local command="$1"
    
    if [ -z "$command" ]; then
        show_usage
        exit 1
    fi
    
    log_info "Starting benchmark runner..."
    log_info "Command: $command"
    
    # Common setup
    if ! check_dependencies; then
        log_error "Dependency check failed"
        exit 1
    fi
    
    check_node_version
    setup_environment
    
    case "$command" in
        "api")
            run_api_benchmark
            ;;
        "db")
            run_db_benchmark
            ;;
        "both")
            run_api_benchmark && run_db_benchmark
            ;;
        "compare")
            generate_comparison "both"
            ;;
        "compare-api")
            generate_comparison "api"
            ;;
        "compare-db")
            generate_comparison "db"
            ;;
        "clean")
            clean_results
            ;;
        "results")
            show_results_summary
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_success "Benchmark runner completed successfully"
        show_results_summary
    else
        log_error "Benchmark runner failed with exit code $exit_code"
    fi
    
    exit $exit_code
}

# Run main function with all arguments
main "$@"