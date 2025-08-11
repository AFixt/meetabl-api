#!/usr/bin/env node

/**
 * Performance Benchmarking Script for Node.js Version Comparison
 * 
 * This script tests various performance metrics of the meetabl API
 * to compare performance between Node.js 20 and 22.
 * 
 * Features:
 * - API endpoint response times
 * - Database query performance
 * - Memory usage patterns
 * - CPU usage patterns
 * - Concurrent request handling
 * - Generates comparison reports
 * 
 * Usage:
 * - NODE_VERSION=20 npm run benchmark
 * - NODE_VERSION=22 npm run benchmark
 * - npm run benchmark:compare
 * 
 * @author meetabl Team
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { promisify } = require('util');

// Configuration
const CONFIG = {
  // Server configuration
  server: {
    host: process.env.BENCHMARK_HOST || 'localhost',
    port: process.env.BENCHMARK_PORT || 3000,
    protocol: process.env.BENCHMARK_PROTOCOL || 'http'
  },
  
  // Test configuration
  test: {
    warmupRequests: 10,
    concurrentUsers: [1, 5, 10, 25, 50],
    requestsPerTest: 100,
    testDuration: 30000, // 30 seconds
    memoryCheckInterval: 1000, // 1 second
    cpuCheckInterval: 100 // 100ms
  },
  
  // Output directory
  outputDir: path.join(__dirname, '..', 'benchmark-results'),
  
  // Test endpoints
  endpoints: [
    {
      name: 'Health Check',
      path: '/',
      method: 'GET',
      auth: false,
      warmup: true
    },
    {
      name: 'User Registration',
      path: '/api/auth/register',
      method: 'POST',
      auth: false,
      body: {
        firstName: 'Benchmark',
        lastName: 'User',
        email: `benchmark-${Date.now()}@example.com`,
        password: 'BenchmarkPass123!',
        timezone: 'America/New_York'
      }
    },
    {
      name: 'User Login',
      path: '/api/auth/login',
      method: 'POST',
      auth: false,
      body: {
        email: 'demo@example.com',
        password: 'demoPassword123!'
      }
    },
    {
      name: 'Get User Profile',
      path: '/api/users/profile',
      method: 'GET',
      auth: true
    },
    {
      name: 'Get User Bookings',
      path: '/api/bookings/my',
      method: 'GET',
      auth: true
    },
    {
      name: 'Get Availability',
      path: '/api/availability',
      method: 'GET',
      auth: true
    }
  ]
};

/**
 * Logger utility
 */
class Logger {
  static info(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} [INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
  
  static warn(message, data = null) {
    const timestamp = new Date().toISOString();
    console.warn(`${timestamp} [WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
  
  static error(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`${timestamp} [ERROR] ${message}`, error ? error.stack || error : '');
  }
}

/**
 * HTTP Client for making requests
 */
class HttpClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.authToken = null;
  }
  
  setAuthToken(token) {
    this.authToken = token;
  }
  
  async request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'meetabl-benchmark/1.0.0',
          ...headers
        }
      };
      
      if (this.authToken) {
        options.headers.Authorization = `Bearer ${this.authToken}`;
      }
      
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const responseData = data ? JSON.parse(data) : null;
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: responseData
            });
          } catch (err) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: data
            });
          }
        });
      });
      
      req.on('error', reject);
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }
}

/**
 * System metrics collector
 */
class SystemMetrics {
  constructor() {
    this.metrics = {
      memory: [],
      cpu: [],
      timestamps: []
    };
    this.collecting = false;
  }
  
  startCollection() {
    this.collecting = true;
    this.collectMetrics();
  }
  
  stopCollection() {
    this.collecting = false;
  }
  
  collectMetrics() {
    if (!this.collecting) return;
    
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.memory.push({
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external
    });
    
    this.metrics.cpu.push({
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    this.metrics.timestamps.push(Date.now());
    
    setTimeout(() => this.collectMetrics(), CONFIG.test.memoryCheckInterval);
  }
  
  getStats() {
    const memoryStats = this.calculateMemoryStats();
    const cpuStats = this.calculateCpuStats();
    
    return {
      memory: memoryStats,
      cpu: cpuStats,
      duration: this.metrics.timestamps.length > 0 
        ? this.metrics.timestamps[this.metrics.timestamps.length - 1] - this.metrics.timestamps[0]
        : 0
    };
  }
  
  calculateMemoryStats() {
    if (this.metrics.memory.length === 0) return null;
    
    const rssValues = this.metrics.memory.map(m => m.rss);
    const heapUsedValues = this.metrics.memory.map(m => m.heapUsed);
    const heapTotalValues = this.metrics.memory.map(m => m.heapTotal);
    
    return {
      rss: {
        min: Math.min(...rssValues),
        max: Math.max(...rssValues),
        avg: rssValues.reduce((a, b) => a + b, 0) / rssValues.length
      },
      heapUsed: {
        min: Math.min(...heapUsedValues),
        max: Math.max(...heapUsedValues),
        avg: heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length
      },
      heapTotal: {
        min: Math.min(...heapTotalValues),
        max: Math.max(...heapTotalValues),
        avg: heapTotalValues.reduce((a, b) => a + b, 0) / heapTotalValues.length
      }
    };
  }
  
  calculateCpuStats() {
    if (this.metrics.cpu.length === 0) return null;
    
    const userValues = this.metrics.cpu.map(c => c.user);
    const systemValues = this.metrics.cpu.map(c => c.system);
    
    return {
      user: {
        min: Math.min(...userValues),
        max: Math.max(...userValues),
        avg: userValues.reduce((a, b) => a + b, 0) / userValues.length
      },
      system: {
        min: Math.min(...systemValues),
        max: Math.max(...systemValues),
        avg: systemValues.reduce((a, b) => a + b, 0) / systemValues.length
      }
    };
  }
  
  reset() {
    this.metrics = {
      memory: [],
      cpu: [],
      timestamps: []
    };
  }
}

/**
 * Performance test runner
 */
class PerformanceTest {
  constructor() {
    this.client = new HttpClient(`${CONFIG.server.protocol}://${CONFIG.server.host}:${CONFIG.server.port}`);
    this.systemMetrics = new SystemMetrics();
    this.results = {
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      environment: {
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        totalMemory: require('os').totalmem(),
        freeMemory: require('os').freemem()
      },
      tests: []
    };
  }
  
  async waitForServer() {
    Logger.info('Waiting for server to be ready...');
    
    for (let i = 0; i < 30; i++) {
      try {
        await this.client.request('GET', '/');
        Logger.info('Server is ready');
        return;
      } catch (error) {
        if (i === 29) {
          throw new Error('Server did not start within 30 seconds');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  async authenticate() {
    Logger.info('Authenticating for protected endpoints...');
    
    try {
      const response = await this.client.request('POST', '/api/auth/login', {
        email: 'demo@example.com',
        password: 'demoPassword123!'
      });
      
      if (response.statusCode === 200 && response.data && response.data.token) {
        this.client.setAuthToken(response.data.token);
        Logger.info('Authentication successful');
      } else {
        Logger.warn('Authentication failed, creating demo user...');
        await this.createDemoUser();
      }
    } catch (error) {
      Logger.warn('Authentication error, creating demo user...', error.message);
      await this.createDemoUser();
    }
  }
  
  async createDemoUser() {
    try {
      const registerResponse = await this.client.request('POST', '/api/auth/register', {
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@example.com',
        password: 'demoPassword123!',
        timezone: 'America/New_York'
      });
      
      if (registerResponse.statusCode === 201) {
        Logger.info('Demo user created successfully');
        
        const loginResponse = await this.client.request('POST', '/api/auth/login', {
          email: 'demo@example.com',
          password: 'demoPassword123!'
        });
        
        if (loginResponse.statusCode === 200 && loginResponse.data && loginResponse.data.token) {
          this.client.setAuthToken(loginResponse.data.token);
          Logger.info('Demo user authentication successful');
        }
      }
    } catch (error) {
      Logger.error('Failed to create demo user', error);
    }
  }
  
  async warmupEndpoint(endpoint) {
    Logger.info(`Warming up endpoint: ${endpoint.name}`);
    
    for (let i = 0; i < CONFIG.test.warmupRequests; i++) {
      try {
        await this.client.request(endpoint.method, endpoint.path, endpoint.body);
      } catch (error) {
        // Ignore warmup errors
      }
    }
  }
  
  async testEndpoint(endpoint, concurrentUsers = 1) {
    Logger.info(`Testing endpoint: ${endpoint.name} with ${concurrentUsers} concurrent users`);
    
    if (endpoint.warmup) {
      await this.warmupEndpoint(endpoint);
    }
    
    this.systemMetrics.reset();
    this.systemMetrics.startCollection();
    
    const startTime = performance.now();
    const requests = [];
    const results = {
      successful: 0,
      failed: 0,
      responseTimes: [],
      errors: [],
      statusCodes: {}
    };
    
    // Create concurrent requests
    for (let user = 0; user < concurrentUsers; user++) {
      for (let req = 0; req < Math.ceil(CONFIG.test.requestsPerTest / concurrentUsers); req++) {
        requests.push(this.makeRequest(endpoint, results));
      }
    }
    
    // Execute all requests
    await Promise.all(requests);
    
    const endTime = performance.now();
    this.systemMetrics.stopCollection();
    
    const duration = endTime - startTime;
    const systemStats = this.systemMetrics.getStats();
    
    const testResult = {
      endpoint: endpoint.name,
      method: endpoint.method,
      path: endpoint.path,
      concurrentUsers,
      duration,
      totalRequests: CONFIG.test.requestsPerTest,
      successfulRequests: results.successful,
      failedRequests: results.failed,
      requestsPerSecond: (results.successful / duration) * 1000,
      responseTime: this.calculateResponseTimeStats(results.responseTimes),
      statusCodes: results.statusCodes,
      errors: results.errors.slice(0, 10), // Keep only first 10 errors
      systemMetrics: systemStats
    };
    
    Logger.info(`Test completed: ${JSON.stringify({
      endpoint: testResult.endpoint,
      rps: testResult.requestsPerSecond.toFixed(2),
      avgResponseTime: testResult.responseTime.avg.toFixed(2),
      successRate: ((testResult.successfulRequests / testResult.totalRequests) * 100).toFixed(2)
    })}`);
    
    return testResult;
  }
  
  async makeRequest(endpoint, results) {
    const startTime = performance.now();
    
    try {
      const response = await this.client.request(endpoint.method, endpoint.path, endpoint.body);
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      results.responseTimes.push(responseTime);
      results.statusCodes[response.statusCode] = (results.statusCodes[response.statusCode] || 0) + 1;
      
      if (response.statusCode >= 200 && response.statusCode < 400) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          statusCode: response.statusCode,
          message: response.data?.error?.message || 'Unknown error'
        });
      }
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      results.responseTimes.push(responseTime);
      results.failed++;
      results.errors.push({
        message: error.message,
        code: error.code
      });
    }
  }
  
  calculateResponseTimeStats(responseTimes) {
    if (responseTimes.length === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }
    
    const sorted = responseTimes.sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  async runAllTests() {
    Logger.info('Starting performance benchmark tests...');
    
    try {
      await this.waitForServer();
      await this.authenticate();
      
      for (const endpoint of CONFIG.endpoints) {
        for (const concurrentUsers of CONFIG.test.concurrentUsers) {
          const testResult = await this.testEndpoint(endpoint, concurrentUsers);
          this.results.tests.push(testResult);
          
          // Brief pause between tests
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      Logger.info('All tests completed successfully');
      return this.results;
    } catch (error) {
      Logger.error('Benchmark test failed', error);
      throw error;
    }
  }
}

/**
 * Results manager
 */
class ResultsManager {
  static async ensureOutputDir() {
    try {
      await fs.access(CONFIG.outputDir);
    } catch {
      await fs.mkdir(CONFIG.outputDir, { recursive: true });
    }
  }
  
  static async saveResults(results) {
    await this.ensureOutputDir();
    
    const filename = `benchmark-node-${process.version}-${Date.now()}.json`;
    const filepath = path.join(CONFIG.outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    
    Logger.info(`Results saved to: ${filepath}`);
    return filepath;
  }
  
  static async loadResults(filepath) {
    const data = await fs.readFile(filepath, 'utf8');
    return JSON.parse(data);
  }
  
  static async findResultFiles() {
    await this.ensureOutputDir();
    
    const files = await fs.readdir(CONFIG.outputDir);
    return files
      .filter(file => file.startsWith('benchmark-node-') && file.endsWith('.json'))
      .map(file => path.join(CONFIG.outputDir, file));
  }
  
  static async generateComparisonReport() {
    const resultFiles = await this.findResultFiles();
    
    if (resultFiles.length < 2) {
      throw new Error('Need at least 2 benchmark result files to generate comparison');
    }
    
    Logger.info(`Found ${resultFiles.length} result files, generating comparison...`);
    
    const results = [];
    for (const file of resultFiles) {
      try {
        const result = await this.loadResults(file);
        results.push(result);
      } catch (error) {
        Logger.warn(`Failed to load result file: ${file}`, error.message);
      }
    }
    
    if (results.length < 2) {
      throw new Error('Need at least 2 valid result files to generate comparison');
    }
    
    const comparison = this.compareResults(results);
    
    const reportPath = path.join(CONFIG.outputDir, `comparison-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(comparison, null, 2));
    
    const htmlReportPath = path.join(CONFIG.outputDir, `comparison-report-${Date.now()}.html`);
    await fs.writeFile(htmlReportPath, this.generateHtmlReport(comparison));
    
    Logger.info(`Comparison report saved to: ${reportPath}`);
    Logger.info(`HTML report saved to: ${htmlReportPath}`);
    
    return comparison;
  }
  
  static compareResults(results) {
    const comparison = {
      timestamp: new Date().toISOString(),
      results: results.map(r => ({
        nodeVersion: r.nodeVersion,
        timestamp: r.timestamp,
        environment: r.environment,
        summary: this.summarizeResults(r)
      })),
      comparison: {}
    };
    
    // Group tests by endpoint and concurrent users
    const testGroups = {};
    
    results.forEach((result, resultIndex) => {
      result.tests.forEach(test => {
        const key = `${test.endpoint}-${test.concurrentUsers}`;
        if (!testGroups[key]) {
          testGroups[key] = [];
        }
        testGroups[key].push({
          ...test,
          resultIndex,
          nodeVersion: result.nodeVersion
        });
      });
    });
    
    // Compare each test group
    for (const [key, tests] of Object.entries(testGroups)) {
      if (tests.length >= 2) {
        comparison.comparison[key] = this.compareTests(tests);
      }
    }
    
    return comparison;
  }
  
  static summarizeResults(result) {
    const summary = {
      totalTests: result.tests.length,
      averageRps: 0,
      averageResponseTime: 0,
      successRate: 0,
      memoryUsage: {
        avgRss: 0,
        avgHeapUsed: 0
      }
    };
    
    let validTests = 0;
    let totalRps = 0;
    let totalResponseTime = 0;
    let totalSuccessful = 0;
    let totalRequests = 0;
    let totalMemoryRss = 0;
    let totalMemoryHeapUsed = 0;
    
    result.tests.forEach(test => {
      if (test.requestsPerSecond > 0) {
        validTests++;
        totalRps += test.requestsPerSecond;
        totalResponseTime += test.responseTime.avg;
        totalSuccessful += test.successfulRequests;
        totalRequests += test.totalRequests;
        
        if (test.systemMetrics?.memory?.rss?.avg) {
          totalMemoryRss += test.systemMetrics.memory.rss.avg;
        }
        if (test.systemMetrics?.memory?.heapUsed?.avg) {
          totalMemoryHeapUsed += test.systemMetrics.memory.heapUsed.avg;
        }
      }
    });
    
    if (validTests > 0) {
      summary.averageRps = totalRps / validTests;
      summary.averageResponseTime = totalResponseTime / validTests;
      summary.memoryUsage.avgRss = totalMemoryRss / validTests;
      summary.memoryUsage.avgHeapUsed = totalMemoryHeapUsed / validTests;
    }
    
    if (totalRequests > 0) {
      summary.successRate = (totalSuccessful / totalRequests) * 100;
    }
    
    return summary;
  }
  
  static compareTests(tests) {
    if (tests.length < 2) return null;
    
    const baseline = tests[0];
    const comparisons = tests.slice(1).map(test => {
      const rpsChange = ((test.requestsPerSecond - baseline.requestsPerSecond) / baseline.requestsPerSecond) * 100;
      const responseTimeChange = ((test.responseTime.avg - baseline.responseTime.avg) / baseline.responseTime.avg) * 100;
      
      let memoryChange = null;
      if (baseline.systemMetrics?.memory?.rss?.avg && test.systemMetrics?.memory?.rss?.avg) {
        memoryChange = ((test.systemMetrics.memory.rss.avg - baseline.systemMetrics.memory.rss.avg) / baseline.systemMetrics.memory.rss.avg) * 100;
      }
      
      return {
        baseline: {
          nodeVersion: baseline.nodeVersion,
          rps: baseline.requestsPerSecond,
          avgResponseTime: baseline.responseTime.avg,
          memoryRss: baseline.systemMetrics?.memory?.rss?.avg || 0
        },
        comparison: {
          nodeVersion: test.nodeVersion,
          rps: test.requestsPerSecond,
          avgResponseTime: test.responseTime.avg,
          memoryRss: test.systemMetrics?.memory?.rss?.avg || 0
        },
        changes: {
          rps: rpsChange,
          responseTime: responseTimeChange,
          memory: memoryChange
        }
      };
    });
    
    return {
      endpoint: baseline.endpoint,
      concurrentUsers: baseline.concurrentUsers,
      comparisons
    };
  }
  
  static generateHtmlReport(comparison) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Node.js Performance Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .summary { margin: 20px 0; }
        .test-group { margin: 20px 0; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .comparison { margin: 10px 0; }
        .positive { color: green; }
        .negative { color: red; }
        .neutral { color: #666; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Node.js Performance Comparison Report</h1>
        <p>Generated: ${comparison.timestamp}</p>
    </div>
    
    <div class="summary">
        <h2>Test Results Summary</h2>
        ${comparison.results.map(result => `
            <div>
                <h3>Node.js ${result.nodeVersion}</h3>
                <ul>
                    <li>Average RPS: ${result.summary.averageRps.toFixed(2)}</li>
                    <li>Average Response Time: ${result.summary.averageResponseTime.toFixed(2)}ms</li>
                    <li>Success Rate: ${result.summary.successRate.toFixed(2)}%</li>
                    <li>Average Memory RSS: ${(result.summary.memoryUsage.avgRss / 1024 / 1024).toFixed(2)}MB</li>
                </ul>
            </div>
        `).join('')}
    </div>
    
    <div class="comparisons">
        <h2>Detailed Comparisons</h2>
        ${Object.entries(comparison.comparison).map(([key, comp]) => `
            <div class="test-group">
                <h3>${comp.endpoint} (${comp.concurrentUsers} concurrent users)</h3>
                ${comp.comparisons.map(c => `
                    <div class="comparison">
                        <h4>${c.comparison.nodeVersion} vs ${c.baseline.nodeVersion}</h4>
                        <table>
                            <tr>
                                <th>Metric</th>
                                <th>${c.baseline.nodeVersion}</th>
                                <th>${c.comparison.nodeVersion}</th>
                                <th>Change</th>
                            </tr>
                            <tr>
                                <td>Requests/sec</td>
                                <td>${c.baseline.rps.toFixed(2)}</td>
                                <td>${c.comparison.rps.toFixed(2)}</td>
                                <td class="${c.changes.rps > 0 ? 'positive' : c.changes.rps < 0 ? 'negative' : 'neutral'}">
                                    ${c.changes.rps > 0 ? '+' : ''}${c.changes.rps.toFixed(2)}%
                                </td>
                            </tr>
                            <tr>
                                <td>Avg Response Time (ms)</td>
                                <td>${c.baseline.avgResponseTime.toFixed(2)}</td>
                                <td>${c.comparison.avgResponseTime.toFixed(2)}</td>
                                <td class="${c.changes.responseTime < 0 ? 'positive' : c.changes.responseTime > 0 ? 'negative' : 'neutral'}">
                                    ${c.changes.responseTime > 0 ? '+' : ''}${c.changes.responseTime.toFixed(2)}%
                                </td>
                            </tr>
                            ${c.changes.memory !== null ? `
                                <tr>
                                    <td>Memory RSS (MB)</td>
                                    <td>${(c.baseline.memoryRss / 1024 / 1024).toFixed(2)}</td>
                                    <td>${(c.comparison.memoryRss / 1024 / 1024).toFixed(2)}</td>
                                    <td class="${c.changes.memory < 0 ? 'positive' : c.changes.memory > 0 ? 'negative' : 'neutral'}">
                                        ${c.changes.memory > 0 ? '+' : ''}${c.changes.memory.toFixed(2)}%
                                    </td>
                                </tr>
                            ` : ''}
                        </table>
                    </div>
                `).join('')}
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
    
    return html;
  }
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];
  
  try {
    if (command === 'compare') {
      const comparison = await ResultsManager.generateComparisonReport();
      console.log('\n=== Performance Comparison Summary ===');
      
      comparison.results.forEach(result => {
        console.log(`\nNode.js ${result.nodeVersion}:`);
        console.log(`  Average RPS: ${result.summary.averageRps.toFixed(2)}`);
        console.log(`  Average Response Time: ${result.summary.averageResponseTime.toFixed(2)}ms`);
        console.log(`  Success Rate: ${result.summary.successRate.toFixed(2)}%`);
        console.log(`  Average Memory RSS: ${(result.summary.memoryUsage.avgRss / 1024 / 1024).toFixed(2)}MB`);
      });
      
    } else {
      const test = new PerformanceTest();
      const results = await test.runAllTests();
      const savedPath = await ResultsManager.saveResults(results);
      
      console.log('\n=== Performance Test Results ===');
      console.log(`Node.js Version: ${results.nodeVersion}`);
      console.log(`Total Tests: ${results.tests.length}`);
      console.log(`Results saved to: ${savedPath}`);
      
      // Print summary
      const summary = ResultsManager.summarizeResults(results);
      console.log(`Average RPS: ${summary.averageRps.toFixed(2)}`);
      console.log(`Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
      console.log(`Success Rate: ${summary.successRate.toFixed(2)}%`);
      console.log(`Average Memory RSS: ${(summary.memoryUsage.avgRss / 1024 / 1024).toFixed(2)}MB`);
    }
    
  } catch (error) {
    Logger.error('Benchmark failed', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  PerformanceTest,
  ResultsManager,
  CONFIG
};