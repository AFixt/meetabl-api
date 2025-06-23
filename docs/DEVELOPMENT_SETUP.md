# Development Environment Setup

This guide provides step-by-step instructions for setting up a local development environment for the meetabl API.

## Prerequisites

### Required Software

#### Node.js 22 LTS
meetabl API requires Node.js 22 LTS for optimal performance and security features.

```bash
# Using Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc  # or ~/.zshrc

# Install and use Node.js 22 LTS
nvm install 22
nvm use 22
nvm alias default 22

# Verify installation
node --version  # Should show v22.x.x
npm --version   # Should show 10.x.x or higher
```

#### Database (MySQL/MariaDB)
```bash
# macOS (using Homebrew)
brew install mysql
brew services start mysql

# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# Windows (using Chocolatey)
choco install mysql
```

#### Redis (Optional, for sessions and caching)
```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Windows (using Chocolatey)
choco install redis-64
```

#### Git
```bash
# macOS (using Homebrew)
brew install git

# Ubuntu/Debian
sudo apt install git

# Windows
# Download from https://git-scm.com/download/win
```

### Recommended Tools

#### Docker (for containerized development)
```bash
# macOS
brew install --cask docker

# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Windows
# Download Docker Desktop from https://www.docker.com/products/docker-desktop
```

#### VS Code (recommended editor)
```bash
# macOS
brew install --cask visual-studio-code

# Ubuntu/Debian
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
sudo apt update
sudo apt install code
```

#### PM2 (for process management)
```bash
npm install -g pm2
```

## Project Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/AFixt/meetabl-api.git
cd meetabl-api

# Verify you're in the correct directory
pwd  # Should show /path/to/meetabl-api
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Environment Configuration

#### Create Environment File
```bash
# Copy the example environment file
cp .env.example .env

# Edit the environment file
nano .env  # or use your preferred editor
```

#### Required Environment Variables
```bash
# Application Configuration
NODE_ENV=development
PORT=3000

# Security Keys (generate secure random strings)
JWT_SECRET=your-jwt-secret-minimum-32-characters-long
SESSION_SECRET=your-session-secret-minimum-32-characters

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=meetabl_dev
DB_USER=root
DB_PASSWORD=your-mysql-password

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_URL=redis://localhost:6379

# Logging Configuration
LOG_LEVEL=debug
LOG_FORMAT=pretty
ENABLE_CONSOLE_LOGGING=true
ENABLE_FILE_LOGGING=true
ENABLE_AUDIT_LOGGING=true

# Monitoring Configuration
ENABLE_TELEMETRY=true
METRICS_PORT=9090

# PWA Configuration
PWA_ENABLE_SW=true
PWA_ENABLE_PUSH=false
```

#### Generate Secure Keys
```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Database Setup

#### Create Database
```bash
# Connect to MySQL
mysql -u root -p

# Create development database
CREATE DATABASE meetabl_dev;
CREATE DATABASE meetabl_test;  -- for testing

# Create user (optional, more secure)
CREATE USER 'meetabl_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON meetabl_dev.* TO 'meetabl_user'@'localhost';
GRANT ALL PRIVILEGES ON meetabl_test.* TO 'meetabl_user'@'localhost';
FLUSH PRIVILEGES;

EXIT;
```

#### Run Database Migrations
```bash
# Run development migrations
npm run db:migrate:dev

# Verify migration success
mysql -u root -p meetabl_dev -e "SHOW TABLES;"
```

#### Seed Database (Optional)
```bash
# Add sample data for development
npm run db:seed
```

### 5. Redis Setup (Optional)

#### Start Redis Server
```bash
# Start Redis
redis-server

# Test Redis connection
redis-cli ping  # Should return PONG
```

#### Configure Redis for Sessions
```bash
# Add to .env file
REDIS_URL=redis://localhost:6379
```

## Development Workflow

### 1. Start Development Server

```bash
# Start with hot reload
npm run dev

# Start with debugger
npm run dev:debug

# Start with PM2
npm run pm2:dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### 2. Verify Installation

#### Health Check
```bash
# Test basic health endpoint
curl http://localhost:3000/health

# Test comprehensive health check
curl http://localhost:3000/api/monitoring/health
```

#### API Documentation
Visit `http://localhost:3000/api/docs` for interactive API documentation.

#### Monitoring Dashboard
Visit `http://localhost:3000/status` for real-time monitoring dashboard.

### 3. Testing Setup

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

### 4. Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:js -- --fix

# Check security
npm run security:check
```

## Docker Development Setup

### 1. Using Docker Compose

```bash
# Start all services (API, MySQL, Redis)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### 2. Docker Compose Configuration

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
      - "9090:9090"  # Metrics port
    environment:
      - NODE_ENV=development
      - DB_HOST=db
      - REDIS_URL=redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - db
      - redis
    command: npm run dev

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=meetabl_dev
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  db_data:
  redis_data:
```

### 3. Development Container

Create `.devcontainer/devcontainer.json` for VS Code:
```json
{
  "name": "meetabl API Development",
  "dockerComposeFile": "../docker-compose.yml",
  "service": "api",
  "workspaceFolder": "/app",
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-vscode.vscode-json",
        "bradlc.vscode-tailwindcss",
        "esbenp.prettier-vscode",
        "dbaeumer.vscode-eslint",
        "ms-vscode.vscode-typescript-next"
      ],
      "settings": {
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.formatOnSave": true
      }
    }
  },
  "postCreateCommand": "npm install",
  "forwardPorts": [3000, 9090],
  "remoteUser": "node"
}
```

## IDE Configuration

### VS Code Setup

#### Recommended Extensions
```bash
# Install recommended extensions
code --install-extension ms-vscode.vscode-json
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss
code --install-extension humao.rest-client
```

#### VS Code Settings (`.vscode/settings.json`)
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": ["./"],
  "files.exclude": {
    "**/node_modules": true,
    "**/logs": true,
    "**/coverage": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/logs": true,
    "**/coverage": true
  }
}
```

#### Launch Configuration (`.vscode/launch.json`)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug meetabl API",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.js",
      "env": {
        "NODE_ENV": "development"
      },
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "node",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "env": {
        "NODE_ENV": "test"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Environment Scripts

Create development scripts in `scripts/dev-setup.sh`:
```bash
#!/bin/bash

# Development environment setup script
echo "🚀 Setting up meetabl API development environment..."

# Check Node.js version
NODE_VERSION=$(node --version)
if [[ ! "$NODE_VERSION" =~ ^v22\. ]]; then
    echo "❌ Node.js 22 is required. Current version: $NODE_VERSION"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check for .env file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
fi

# Check database connection
echo "🗄️  Checking database connection..."
npm run db:migrate:dev --silent || {
    echo "❌ Database migration failed. Please check your database configuration."
    exit 1
}

# Run tests
echo "🧪 Running tests..."
npm test --silent || {
    echo "⚠️  Some tests failed. Check the output above."
}

echo "✅ Development environment setup complete!"
echo "🎯 Run 'npm run dev' to start the development server"
```

Make the script executable:
```bash
chmod +x scripts/dev-setup.sh
```

## External Services Setup (Optional)

### 1. Google Calendar Integration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials
5. Add credentials to `.env`:

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Microsoft Calendar Integration

1. Go to [Azure Portal](https://portal.azure.com/)
2. Register a new application
3. Configure API permissions for Microsoft Graph
4. Add credentials to `.env`:

```bash
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

### 3. Stripe Payment Integration

1. Create account at [Stripe](https://stripe.com/)
2. Get test API keys from dashboard
3. Add to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
```

### 4. Twilio SMS Integration

1. Create account at [Twilio](https://www.twilio.com/)
2. Get Account SID and Auth Token
3. Add to `.env`:

```bash
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
```

## Monitoring Setup

### 1. Prometheus Metrics

Access metrics at `http://localhost:9090/metrics` when the server is running.

### 2. Logs

Development logs are written to:
- Console (formatted for readability)
- `logs/application-YYYY-MM-DD.log`
- `logs/errors/error-YYYY-MM-DD.log`

### 3. Health Checks

Monitor application health:
```bash
# Basic health check
curl http://localhost:3000/health

# Comprehensive health check
curl http://localhost:3000/api/monitoring/health

# Individual component checks
curl http://localhost:3000/api/monitoring/health/database
curl http://localhost:3000/api/monitoring/health/memory
```

## Common Development Tasks

### Database Operations

```bash
# Reset database
npm run db:migrate:dev -- --undo-all
npm run db:migrate:dev

# Create new migration
npx sequelize-cli migration:generate --name add-new-feature

# Create new model
npx sequelize-cli model:generate --name ModelName --attributes field1:string,field2:integer
```

### Testing

```bash
# Run specific test file
npm test -- tests/unit/models/user.model.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should create user"

# Run tests in watch mode
npm run test:watch

# Debug tests
npm run test:debug
```

### Performance Testing

```bash
# Benchmark API performance
npm run benchmark

# Load testing
npm run load-test

# Database benchmarks
npm run benchmark:db
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)
```

#### Database Connection Issues
```bash
# Check MySQL service
brew services list | grep mysql  # macOS
sudo systemctl status mysql     # Linux

# Reset MySQL password
sudo mysql_secure_installation
```

#### Node Modules Issues
```bash
# Clear npm cache
npm cache clean --force

# Remove and reinstall node_modules
rm -rf node_modules package-lock.json
npm install
```

#### Redis Connection Issues
```bash
# Check Redis service
brew services list | grep redis  # macOS
sudo systemctl status redis     # Linux

# Test Redis connection
redis-cli ping
```

### Environment Debugging

```bash
# Check environment variables
npm run env:check

# Validate configuration
npm run config:validate

# Test all external services
npm run services:test
```

### Log Analysis

```bash
# View application logs
tail -f logs/application-$(date +%Y-%m-%d).log

# View error logs
tail -f logs/errors/error-$(date +%Y-%m-%d).log

# Search logs
grep "error" logs/application-*.log
```

## Development Tips

### 1. Hot Reloading

The development server uses nodemon for automatic restarts on file changes. Configure in `nodemon.json`:

```json
{
  "watch": ["src"],
  "ext": "js,json",
  "ignore": ["tests/", "logs/", "coverage/"],
  "exec": "node src/index.js"
}
```

### 2. Debugging

```bash
# Start with debugger
npm run dev:debug

# Debug specific test
npm run test:debug -- --testNamePattern="specific test"
```

Connect to debugger at `chrome://inspect` in Chrome.

### 3. Environment Switching

```bash
# Development
NODE_ENV=development npm run dev

# Testing
NODE_ENV=test npm test

# Production simulation
NODE_ENV=production npm start
```

### 4. Database Inspection

```bash
# Connect to development database
mysql -u root -p meetabl_dev

# View table structure
DESCRIBE users;

# Check recent entries
SELECT * FROM users ORDER BY created DESC LIMIT 5;
```

### 5. API Testing

Use the provided REST client files in `.vscode/requests/`:

```http
### Health Check
GET http://localhost:3000/health

### Authentication
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123"
}
```

## Next Steps

After completing the development setup:

1. **Read the Documentation**: Review all documentation in the `docs/` folder
2. **Run Tests**: Ensure all tests pass with `npm test`
3. **Explore the API**: Use the interactive documentation at `/api/docs`
4. **Set up External Services**: Configure optional integrations as needed
5. **Join the Team**: Review the contributing guidelines and team workflows

## Getting Help

- **Documentation**: Check the `docs/` folder for detailed guides
- **Issues**: Report problems on the project's issue tracker
- **Slack/Discord**: Join the team communication channels
- **Code Review**: Submit pull requests for code review

Happy coding! 🚀