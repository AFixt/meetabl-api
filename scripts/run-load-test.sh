#!/bin/bash

# Load Testing Script for Meetabl API
# Verifies booking system performance under Node.js 22

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
NODE_ENV=${NODE_ENV:-test}
API_HOST=${API_HOST:-localhost}
API_PORT=${API_PORT:-3000}
LOAD_TEST_DURATION=${LOAD_TEST_DURATION:-600}  # 10 minutes
CONCURRENT_USERS=${CONCURRENT_USERS:-50}
RAMP_UP_TIME=${RAMP_UP_TIME:-60}

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/load-test-results"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Node.js is installed and version is 22+
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 22 ]; then
        log_warning "Node.js version is $NODE_VERSION, recommended version is 22+"
    else
        log_success "Node.js version $(node -v) is compatible"
    fi
    
    # Check if Artillery is installed
    if ! command -v artillery &> /dev/null; then
        log "Installing Artillery..."
        npm install -g artillery
        if [ $? -ne 0 ]; then
            log_error "Failed to install Artillery"
            exit 1
        fi
    fi
    log_success "Artillery is available"
    
    # Check if API is running
    if ! curl -s "http://$API_HOST:$API_PORT/" > /dev/null; then
        log_error "API is not running at http://$API_HOST:$API_PORT/"
        log "Please start the API server first with: npm start"
        exit 1
    fi
    log_success "API is running at http://$API_HOST:$API_PORT/"
}

# Function to setup test environment
setup_test_environment() {
    log "Setting up test environment..."
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    
    # Set NODE_ENV to test
    export NODE_ENV=test
    
    # Setup test database if needed
    if [ -f "$PROJECT_ROOT/scripts/setup-test-db.js" ]; then
        log "Setting up test database..."
        cd "$PROJECT_ROOT"
        node scripts/setup-test-db.js
    fi
    
    # Create test users
    log "Creating test users..."
    node -e "
    const { User } = require('./src/models');
    const bcrypt = require('bcrypt');
    
    async function createTestUsers() {
        try {
            // Create demo users for load testing
            const users = [
                { email: 'demo@example.com', password: 'demoPassword123!', firstName: 'Demo', lastName: 'User', username: 'demouser' },
                { email: 'loadtest1@example.com', password: 'LoadTest123!', firstName: 'Load', lastName: 'Test1', username: 'loadtest1' },
                { email: 'loadtest2@example.com', password: 'LoadTest123!', firstName: 'Load', lastName: 'Test2', username: 'loadtest2' },
                { email: 'loadtest3@example.com', password: 'LoadTest123!', firstName: 'Load', lastName: 'Test3', username: 'loadtest3' },
                { email: 'performance1@example.com', password: 'PerfTest123!', firstName: 'Performance', lastName: 'Test1', username: 'perftest1' }
            ];
            
            for (const userData of users) {
                const existingUser = await User.findOne({ where: { email: userData.email } });
                if (!existingUser) {
                    const hashedPassword = await bcrypt.hash(userData.password, 10);
                    await User.create({
                        ...userData,
                        password: hashedPassword,
                        timezone: 'America/New_York'
                    });
                    console.log(\`Created user: \${userData.email}\`);
                }
            }
            console.log('Test users setup complete');
            process.exit(0);
        } catch (error) {
            console.error('Error creating test users:', error);
            process.exit(1);
        }
    }
    
    createTestUsers();
    " || log_warning "Could not create test users (they may already exist)"
    
    log_success "Test environment setup complete"
}

# Function to run load tests
run_load_tests() {
    log "Starting load tests..."
    log "Configuration:"
    log "  - Target: http://$API_HOST:$API_PORT"
    log "  - Duration: ${LOAD_TEST_DURATION}s"
    log "  - Max Concurrent Users: $CONCURRENT_USERS"
    log "  - Ramp-up Time: ${RAMP_UP_TIME}s"
    
    cd "$SCRIPT_DIR"
    
    # Update load test config with current parameters
    sed -i.bak "s|target: \".*\"|target: \"http://$API_HOST:$API_PORT\"|g" load-test.yml
    
    # Run the load test
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local results_file="$RESULTS_DIR/load-test-results-$timestamp"
    
    artillery run \
        --config load-test.yml \
        --output "$results_file.json" \
        load-test.yml
    
    if [ $? -eq 0 ]; then
        log_success "Load test completed successfully"
        
        # Generate HTML report
        artillery report "$results_file.json" --output "$results_file.html"
        
        if [ $? -eq 0 ]; then
            log_success "HTML report generated: $results_file.html"
        fi
        
        # Parse and display summary
        display_test_summary "$results_file.json"
        
    else
        log_error "Load test failed"
        exit 1
    fi
}

# Function to display test summary
display_test_summary() {
    local results_file="$1"
    
    if [ -f "$results_file" ]; then
        log "Load Test Summary:"
        
        # Extract key metrics using node
        node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$results_file', 'utf8'));
        const aggregate = data.aggregate;
        
        console.log('');
        console.log('📊 Performance Metrics:');
        console.log('  - Total Requests:', aggregate.counters['http.requests'] || 0);
        console.log('  - Successful Requests:', (aggregate.counters['http.requests'] || 0) - (aggregate.counters['http.request_rate'] || 0));
        console.log('  - Failed Requests:', aggregate.counters['http.request_rate'] || 0);
        console.log('  - Requests/sec (avg):', (aggregate.rates['http.request_rate']?.mean || 0).toFixed(2));
        console.log('  - Response Time (avg):', (aggregate.latency?.mean || 0).toFixed(2) + 'ms');
        console.log('  - Response Time (p95):', (aggregate.latency?.p95 || 0).toFixed(2) + 'ms');
        console.log('  - Response Time (p99):', (aggregate.latency?.p99 || 0).toFixed(2) + 'ms');
        console.log('');
        
        if (aggregate.codes) {
            console.log('🔢 HTTP Status Codes:');
            Object.entries(aggregate.codes).forEach(([code, count]) => {
                console.log(\`  - \${code}: \${count}\`);
            });
            console.log('');
        }
        
        if (aggregate.errors) {
            console.log('⚠️  Errors:');
            Object.entries(aggregate.errors).forEach(([error, count]) => {
                console.log(\`  - \${error}: \${count}\`);
            });
            console.log('');
        }
        
        // Success rate calculation
        const totalRequests = aggregate.counters['http.requests'] || 0;
        const errors = Object.values(aggregate.errors || {}).reduce((sum, count) => sum + count, 0);
        const successRate = totalRequests > 0 ? ((totalRequests - errors) / totalRequests * 100).toFixed(2) : 0;
        console.log(\`✅ Success Rate: \${successRate}%\`);
        "
    fi
}

# Function to cleanup test environment
cleanup_test_environment() {
    log "Cleaning up test environment..."
    
    # Remove temporary test data if needed
    if [ "$NODE_ENV" = "test" ]; then
        log "Removing test data..."
        # Add cleanup commands here if needed
    fi
    
    log_success "Cleanup complete"
}

# Function to analyze results
analyze_results() {
    log "Analyzing load test results..."
    
    local latest_result=$(ls -t "$RESULTS_DIR"/load-test-results-*.json 2>/dev/null | head -n1)
    
    if [ -n "$latest_result" ]; then
        log "Latest results file: $latest_result"
        
        # Generate performance analysis
        node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$latest_result', 'utf8'));
        const aggregate = data.aggregate;
        
        console.log('');
        console.log('📈 Performance Analysis:');
        
        // Calculate performance thresholds
        const avgResponseTime = aggregate.latency?.mean || 0;
        const p95ResponseTime = aggregate.latency?.p95 || 0;
        const requestRate = aggregate.rates['http.request_rate']?.mean || 0;
        const totalRequests = aggregate.counters['http.requests'] || 0;
        const errors = Object.values(aggregate.errors || {}).reduce((sum, count) => sum + count, 0);
        const errorRate = totalRequests > 0 ? (errors / totalRequests * 100) : 0;
        
        // Performance assessment
        console.log('');
        console.log('🎯 Performance Assessment:');
        
        if (avgResponseTime < 100) {
            console.log('  ✅ Average Response Time: EXCELLENT (<100ms)');
        } else if (avgResponseTime < 500) {
            console.log('  ✅ Average Response Time: GOOD (<500ms)');
        } else if (avgResponseTime < 1000) {
            console.log('  ⚠️  Average Response Time: ACCEPTABLE (<1000ms)');
        } else {
            console.log('  ❌ Average Response Time: POOR (>1000ms)');
        }
        
        if (p95ResponseTime < 200) {
            console.log('  ✅ P95 Response Time: EXCELLENT (<200ms)');
        } else if (p95ResponseTime < 1000) {
            console.log('  ✅ P95 Response Time: GOOD (<1000ms)');
        } else if (p95ResponseTime < 2000) {
            console.log('  ⚠️  P95 Response Time: ACCEPTABLE (<2000ms)');
        } else {
            console.log('  ❌ P95 Response Time: POOR (>2000ms)');
        }
        
        if (errorRate < 1) {
            console.log('  ✅ Error Rate: EXCELLENT (<1%)');
        } else if (errorRate < 5) {
            console.log('  ✅ Error Rate: GOOD (<5%)');
        } else if (errorRate < 10) {
            console.log('  ⚠️  Error Rate: ACCEPTABLE (<10%)');
        } else {
            console.log('  ❌ Error Rate: POOR (>10%)');
        }
        
        if (requestRate > 100) {
            console.log('  ✅ Throughput: EXCELLENT (>100 req/s)');
        } else if (requestRate > 50) {
            console.log('  ✅ Throughput: GOOD (>50 req/s)');
        } else if (requestRate > 20) {
            console.log('  ⚠️  Throughput: ACCEPTABLE (>20 req/s)');
        } else {
            console.log('  ❌ Throughput: POOR (<20 req/s)');
        }
        
        console.log('');
        console.log('📊 Key Performance Indicators:');
        console.log(\`  - Average Response Time: \${avgResponseTime.toFixed(2)}ms\`);
        console.log(\`  - P95 Response Time: \${p95ResponseTime.toFixed(2)}ms\`);
        console.log(\`  - Throughput: \${requestRate.toFixed(2)} req/s\`);
        console.log(\`  - Error Rate: \${errorRate.toFixed(2)}%\`);
        console.log(\`  - Total Requests: \${totalRequests}\`);
        "
        
    else
        log_warning "No test results found"
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Load testing script for Meetabl API"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -t, --target HOST       API host (default: localhost)"
    echo "  -p, --port PORT         API port (default: 3000)"
    echo "  -d, --duration SECONDS  Test duration (default: 600)"
    echo "  -u, --users NUMBER      Max concurrent users (default: 50)"
    echo "  -r, --ramp SECONDS      Ramp-up time (default: 60)"
    echo "  --setup-only            Only setup test environment"
    echo "  --analyze-only          Only analyze existing results"
    echo "  --cleanup-only          Only cleanup test environment"
    echo ""
    echo "Environment Variables:"
    echo "  NODE_ENV                Node environment (default: test)"
    echo "  DEBUG                   Enable debug output (0 or 1)"
    echo ""
    echo "Examples:"
    echo "  $0                      Run full load test with defaults"
    echo "  $0 -d 300 -u 100       Run 5-minute test with 100 max users"
    echo "  $0 --analyze-only       Analyze last test results"
}

# Main execution
main() {
    local setup_only=false
    local analyze_only=false
    local cleanup_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -t|--target)
                API_HOST="$2"
                shift 2
                ;;
            -p|--port)
                API_PORT="$2"
                shift 2
                ;;
            -d|--duration)
                LOAD_TEST_DURATION="$2"
                shift 2
                ;;
            -u|--users)
                CONCURRENT_USERS="$2"
                shift 2
                ;;
            -r|--ramp)
                RAMP_UP_TIME="$2"
                shift 2
                ;;
            --setup-only)
                setup_only=true
                shift
                ;;
            --analyze-only)
                analyze_only=true
                shift
                ;;
            --cleanup-only)
                cleanup_only=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "🚀 Meetabl API Load Testing Suite"
    echo "================================="
    echo ""
    
    if [ "$cleanup_only" = true ]; then
        cleanup_test_environment
        exit 0
    fi
    
    if [ "$analyze_only" = true ]; then
        analyze_results
        exit 0
    fi
    
    check_prerequisites
    setup_test_environment
    
    if [ "$setup_only" = true ]; then
        log_success "Setup completed successfully"
        exit 0
    fi
    
    # Trap to ensure cleanup happens
    trap cleanup_test_environment EXIT
    
    run_load_tests
    analyze_results
    
    log_success "Load testing completed successfully!"
    log "Results are available in: $RESULTS_DIR"
}

# Run main function
main "$@"