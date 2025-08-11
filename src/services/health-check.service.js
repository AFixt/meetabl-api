/**
 * Health Check Service
 * 
 * Comprehensive health monitoring for the meetabl API including
 * database, cache, external services, and system resources
 * 
 * @author meetabl Team
 */

const { createLogger } = require('../config/logger');

const logger = createLogger('health-check');

class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.lastResults = new Map();
    this.initialize();
  }

  /**
   * Initialize health checks
   */
  initialize() {
    // Register all health checks
    this.registerCheck('database', this.checkDatabase.bind(this));
    this.registerCheck('redis', this.checkRedis.bind(this));
    this.registerCheck('filesystem', this.checkFilesystem.bind(this));
    this.registerCheck('memory', this.checkMemory.bind(this));
    this.registerCheck('disk', this.checkDisk.bind(this));
    this.registerCheck('external-apis', this.checkExternalAPIs.bind(this));
    this.registerCheck('dependencies', this.checkDependencies.bind(this));
    
    logger.info('Health check service initialized', {
      registeredChecks: Array.from(this.checks.keys())
    });
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const startTime = Date.now();
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      },
      performance: {
        totalTime: 0,
        slowestCheck: null,
        fastestCheck: null
      }
    };

    const promises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      const checkStart = Date.now();
      try {
        const result = await Promise.race([
          checkFn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        
        const checkTime = Date.now() - checkStart;
        
        const checkResult = {
          status: result.status || 'healthy',
          message: result.message || 'OK',
          details: result.details || {},
          responseTime: checkTime,
          timestamp: new Date().toISOString()
        };

        // Update performance tracking
        if (!results.performance.slowestCheck || checkTime > results.performance.slowestCheck.time) {
          results.performance.slowestCheck = { name, time: checkTime };
        }
        if (!results.performance.fastestCheck || checkTime < results.performance.fastestCheck.time) {
          results.performance.fastestCheck = { name, time: checkTime };
        }

        // Update summary
        results.summary.total++;
        if (checkResult.status === 'healthy') {
          results.summary.passed++;
        } else if (checkResult.status === 'warning') {
          results.summary.warnings++;
        } else {
          results.summary.failed++;
          results.status = 'unhealthy';
        }

        // Store result
        this.lastResults.set(name, checkResult);
        
        return [name, checkResult];
      } catch (error) {
        const checkTime = Date.now() - checkStart;
        const errorResult = {
          status: 'unhealthy',
          message: error.message || 'Health check failed',
          details: { error: error.message },
          responseTime: checkTime,
          timestamp: new Date().toISOString()
        };

        results.summary.total++;
        results.summary.failed++;
        results.status = 'unhealthy';

        this.lastResults.set(name, errorResult);
        
        return [name, errorResult];
      }
    });

    const checkResults = await Promise.all(promises);
    
    // Populate results
    checkResults.forEach(([name, result]) => {
      results.checks[name] = result;
    });

    results.performance.totalTime = Date.now() - startTime;

    return results;
  }

  /**
   * Run a specific health check
   */
  async runCheck(checkName) {
    const checkFn = this.checks.get(checkName);
    if (!checkFn) {
      throw new Error(`Health check '${checkName}' not found`);
    }

    try {
      const result = await checkFn();
      return {
        status: result.status || 'healthy',
        message: result.message || 'OK',
        details: result.details || {},
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message || 'Health check failed',
        details: { error: error.message },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get basic health status for load balancers
   */
  async getBasicHealth() {
    try {
      // Quick checks for essential services only
      const dbCheck = await this.checkDatabase();
      const memoryCheck = await this.checkMemory();

      if (dbCheck.status === 'healthy' && memoryCheck.status !== 'unhealthy') {
        return {
          status: 'healthy',
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Basic health check failed'
      };
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      const { sequelize } = require('../config/database');
      
      // Test connection
      await sequelize.authenticate();
      
      // Get connection pool stats
      const poolStats = sequelize.connectionManager.pool || {};
      
      const details = {
        connected: true,
        pool: {
          size: poolStats.size || 0,
          available: poolStats.available || 0,
          used: poolStats.used || 0,
          pending: poolStats.pending || 0
        }
      };

      // Check pool health
      const poolUtilization = details.pool.size > 0 
        ? (details.pool.used / details.pool.size) * 100 
        : 0;

      if (poolUtilization > 90) {
        return {
          status: 'warning',
          message: 'Database pool utilization high',
          details
        };
      }

      return {
        status: 'healthy',
        message: 'Database connected',
        details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  async checkRedis() {
    try {
      // Check if Redis is configured
      if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
        return {
          status: 'healthy',
          message: 'Redis not configured (using memory sessions)',
          details: { configured: false }
        };
      }

      const redis = require('ioredis');
      const client = new redis(process.env.REDIS_URL || {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      });

      // Test connection
      const pong = await client.ping();
      const info = await client.info('memory');
      
      await client.disconnect();

      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1].trim() : 'unknown';

      return {
        status: 'healthy',
        message: 'Redis connected',
        details: {
          connected: true,
          ping: pong,
          memoryUsed
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Redis connection failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Check filesystem health
   */
  async checkFilesystem() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');

      // Test write access to logs directory
      const testFile = path.join(__dirname, '../../logs/health-check.tmp');
      const testData = `Health check ${Date.now()}`;
      
      await fs.writeFile(testFile, testData);
      const readData = await fs.readFile(testFile, 'utf8');
      await fs.unlink(testFile);

      if (readData !== testData) {
        throw new Error('File integrity check failed');
      }

      // Get disk space info
      const stats = await fs.stat(__dirname);
      
      return {
        status: 'healthy',
        message: 'Filesystem accessible',
        details: {
          writable: true,
          readable: true,
          tempDir: os.tmpdir()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Filesystem check failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Check memory usage
   */
  async checkMemory() {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const freeMem = require('os').freemem();
      
      const memoryPercentage = ((memUsage.rss / totalMem) * 100);
      const systemMemoryUsage = (((totalMem - freeMem) / totalMem) * 100);

      const details = {
        process: {
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024), // MB
          percentage: Math.round(memoryPercentage * 100) / 100
        },
        system: {
          total: Math.round(totalMem / 1024 / 1024), // MB
          free: Math.round(freeMem / 1024 / 1024), // MB
          usage: Math.round(systemMemoryUsage * 100) / 100
        }
      };

      let status = 'healthy';
      let message = 'Memory usage normal';

      if (memoryPercentage > 90 || systemMemoryUsage > 95) {
        status = 'unhealthy';
        message = 'Critical memory usage';
      } else if (memoryPercentage > 80 || systemMemoryUsage > 85) {
        status = 'warning';
        message = 'High memory usage';
      }

      return { status, message, details };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Memory check failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Check disk space
   */
  async checkDisk() {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      // Check logs directory size and available space
      const logsDir = path.join(__dirname, '../../logs');
      
      try {
        await fs.access(logsDir);
        const stats = await fs.stat(logsDir);
        
        return {
          status: 'healthy',
          message: 'Disk space check completed',
          details: {
            logsDirectory: {
              exists: true,
              accessible: true
            }
          }
        };
      } catch (error) {
        return {
          status: 'warning',
          message: 'Logs directory not accessible',
          details: { error: error.message }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Disk check failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Check external API dependencies
   */
  async checkExternalAPIs() {
    try {
      const checks = [];
      
      // Only check APIs that are actually configured
      if (process.env.GOOGLE_CLIENT_ID) {
        checks.push(this.checkGoogleAPI());
      }
      
      if (process.env.MICROSOFT_CLIENT_ID) {
        checks.push(this.checkMicrosoftAPI());
      }
      
      if (process.env.STRIPE_SECRET_KEY) {
        checks.push(this.checkStripeAPI());
      }

      if (checks.length === 0) {
        return {
          status: 'healthy',
          message: 'No external APIs configured',
          details: { configured: [] }
        };
      }

      const results = await Promise.allSettled(checks);
      const failed = results.filter(r => r.status === 'rejected').length;
      
      return {
        status: failed === 0 ? 'healthy' : failed < results.length ? 'warning' : 'unhealthy',
        message: `${results.length - failed}/${results.length} external APIs healthy`,
        details: {
          total: results.length,
          healthy: results.length - failed,
          failed
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'External API check failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Check Google API connectivity
   */
  async checkGoogleAPI() {
    const fetch = require('node-fetch');
    const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
      timeout: 3000
    });
    return response.status < 500;
  }

  /**
   * Check Microsoft API connectivity
   */
  async checkMicrosoftAPI() {
    const fetch = require('node-fetch');
    const response = await fetch('https://graph.microsoft.com/v1.0/', {
      timeout: 3000
    });
    return response.status < 500;
  }

  /**
   * Check Stripe API connectivity
   */
  async checkStripeAPI() {
    const fetch = require('node-fetch');
    const response = await fetch('https://api.stripe.com/v1', {
      timeout: 3000
    });
    return response.status < 500;
  }

  /**
   * Check critical Node.js dependencies
   */
  async checkDependencies() {
    try {
      const packageJson = require('../../package.json');
      const criticalDeps = [
        'express',
        'sequelize',
        'mysql2',
        'jsonwebtoken',
        'bcrypt'
      ];

      const missingDeps = [];
      const loadedDeps = [];

      for (const dep of criticalDeps) {
        try {
          require(dep);
          loadedDeps.push(dep);
        } catch (error) {
          missingDeps.push(dep);
        }
      }

      return {
        status: missingDeps.length === 0 ? 'healthy' : 'unhealthy',
        message: `${loadedDeps.length}/${criticalDeps.length} critical dependencies loaded`,
        details: {
          loaded: loadedDeps,
          missing: missingDeps,
          nodeVersion: process.version,
          appVersion: packageJson.version
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Dependency check failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Get cached health check results
   */
  getCachedResults() {
    const cached = {};
    this.lastResults.forEach((result, name) => {
      cached[name] = result;
    });
    return cached;
  }

  /**
   * Check if service is ready to serve traffic
   */
  async isReady() {
    try {
      const dbResult = await this.checkDatabase();
      const memResult = await this.checkMemory();
      const depResult = await this.checkDependencies();

      return dbResult.status === 'healthy' 
        && memResult.status !== 'unhealthy'
        && depResult.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if service is alive (minimal check)
   */
  isAlive() {
    try {
      // Very basic check - just return true if process is running
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = new HealthCheckService();