#!/usr/bin/env node

/**
 * Test Benchmark Setup Script
 * 
 * This script tests the benchmarking system to ensure all components
 * are working correctly before running full benchmarks.
 * 
 * @author meetabl Team
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Test configuration
const TEST_CONFIG = {
  scriptsDir: path.join(__dirname),
  projectDir: path.join(__dirname, '..'),
  benchmarkScript: path.join(__dirname, 'performance-benchmark.js'),
  dbBenchmarkScript: path.join(__dirname, 'db-performance-benchmark.js'),
  runnerScript: path.join(__dirname, 'benchmark-runner.sh')
};

/**
 * Logger utility
 */
class Logger {
  static info(message) {
    console.log(`[INFO] ${message}`);
  }
  
  static success(message) {
    console.log(`[SUCCESS] ${message}`);
  }
  
  static error(message) {
    console.error(`[ERROR] ${message}`);
  }
  
  static warn(message) {
    console.warn(`[WARN] ${message}`);
  }
}

/**
 * Test runner class
 */
class BenchmarkTestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Add a test to the suite
   */
  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    Logger.info(`Running ${this.tests.length} benchmark setup tests...`);
    
    for (const test of this.tests) {
      try {
        Logger.info(`Running test: ${test.name}`);
        await test.testFn();
        this.results.passed++;
        Logger.success(`✓ ${test.name}`);
      } catch (error) {
        this.results.failed++;
        this.results.errors.push({ test: test.name, error: error.message });
        Logger.error(`✗ ${test.name}: ${error.message}`);
      }
    }

    this.printSummary();
    return this.results.failed === 0;
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n=== Benchmark Setup Test Summary ===');
    console.log(`Total tests: ${this.tests.length}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    
    if (this.results.failed > 0) {
      console.log('\nFailures:');
      this.results.errors.forEach(({ test, error }) => {
        console.log(`  - ${test}: ${error}`);
      });
    }
  }
}

/**
 * Test functions
 */
async function testFileExistence() {
  const requiredFiles = [
    TEST_CONFIG.benchmarkScript,
    TEST_CONFIG.dbBenchmarkScript,
    TEST_CONFIG.runnerScript,
    path.join(TEST_CONFIG.projectDir, 'package.json'),
    path.join(TEST_CONFIG.projectDir, 'src', 'app.js'),
    path.join(TEST_CONFIG.projectDir, 'src', 'config', 'database.js')
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(file);
    } catch (error) {
      throw new Error(`Required file missing: ${file}`);
    }
  }
}

async function testScriptPermissions() {
  try {
    const stats = await fs.stat(TEST_CONFIG.runnerScript);
    if (!(stats.mode & 0o111)) {
      throw new Error('Benchmark runner script is not executable');
    }
  } catch (error) {
    throw new Error(`Cannot check permissions for runner script: ${error.message}`);
  }
}

async function testPackageJsonScripts() {
  try {
    const packageJsonPath = path.join(TEST_CONFIG.projectDir, 'package.json');
    const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    const requiredScripts = [
      'benchmark',
      'benchmark:api',
      'benchmark:db',
      'benchmark:compare'
    ];

    for (const script of requiredScripts) {
      if (!packageData.scripts[script]) {
        throw new Error(`Missing package.json script: ${script}`);
      }
    }
  } catch (error) {
    throw new Error(`Package.json script check failed: ${error.message}`);
  }
}

async function testEnvironmentVariables() {
  const requiredEnvVars = ['NODE_ENV'];
  const recommendedEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'];

  // Check required
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable missing: ${envVar}`);
    }
  }

  // Warn about recommended
  for (const envVar of recommendedEnvVars) {
    if (!process.env[envVar]) {
      Logger.warn(`Recommended environment variable missing: ${envVar}`);
    }
  }
}

async function testNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    throw new Error(`Node.js version ${nodeVersion} is too old. Requires Node.js 18+`);
  }
  
  if (majorVersion !== 20 && majorVersion !== 22) {
    Logger.warn(`Node.js version ${nodeVersion} is not 20 or 22. Results may not be comparable.`);
  }
}

async function testBasicScriptSyntax() {
  // Test if scripts can be required without syntax errors
  try {
    const { CONFIG } = require(TEST_CONFIG.benchmarkScript);
    if (!CONFIG || typeof CONFIG !== 'object') {
      throw new Error('Performance benchmark script CONFIG is invalid');
    }
  } catch (error) {
    throw new Error(`Performance benchmark script syntax error: ${error.message}`);
  }

  try {
    const { DB_CONFIG } = require(TEST_CONFIG.dbBenchmarkScript);
    if (!DB_CONFIG || typeof DB_CONFIG !== 'object') {
      throw new Error('Database benchmark script DB_CONFIG is invalid');
    }
  } catch (error) {
    throw new Error(`Database benchmark script syntax error: ${error.message}`);
  }
}

async function testDatabaseConnection() {
  try {
    // Try to require database config to test if it's properly set up
    const { sequelize } = require(path.join(TEST_CONFIG.projectDir, 'src', 'config', 'database'));
    
    // Test authentication (but don't fail if DB is not actually running)
    try {
      await sequelize.authenticate();
      Logger.success('Database connection test passed');
    } catch (dbError) {
      Logger.warn(`Database connection failed (this may be expected): ${dbError.message}`);
    }
    
    // Close connection if it was opened
    try {
      await sequelize.close();
    } catch (closeError) {
      // Ignore close errors
    }
  } catch (error) {
    throw new Error(`Database configuration test failed: ${error.message}`);
  }
}

async function testOutputDirectoryCreation() {
  const testDir = path.join(TEST_CONFIG.projectDir, 'benchmark-results-test');
  
  try {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'test.json'), '{"test": true}');
    await fs.unlink(path.join(testDir, 'test.json'));
    await fs.rmdir(testDir);
  } catch (error) {
    throw new Error(`Output directory test failed: ${error.message}`);
  }
}

async function testDependencies() {
  try {
    const packageJsonPath = path.join(TEST_CONFIG.projectDir, 'package.json');
    const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    const criticalDeps = ['express', 'sequelize', 'mysql2'];
    
    for (const dep of criticalDeps) {
      if (!packageData.dependencies[dep] && !packageData.devDependencies[dep]) {
        throw new Error(`Critical dependency missing: ${dep}`);
      }
    }

    // Check if node_modules exists
    try {
      await fs.access(path.join(TEST_CONFIG.projectDir, 'node_modules'));
    } catch (error) {
      throw new Error('node_modules directory not found. Run npm install first.');
    }
  } catch (error) {
    throw new Error(`Dependency check failed: ${error.message}`);
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log('Benchmark Setup Test Tool');
  console.log('=========================\n');
  
  const runner = new BenchmarkTestRunner();
  
  // Add all tests
  runner.addTest('File Existence Check', testFileExistence);
  runner.addTest('Script Permissions Check', testScriptPermissions);
  runner.addTest('Package.json Scripts Check', testPackageJsonScripts);
  runner.addTest('Environment Variables Check', testEnvironmentVariables);
  runner.addTest('Node.js Version Check', testNodeVersion);
  runner.addTest('Script Syntax Check', testBasicScriptSyntax);
  runner.addTest('Database Configuration Check', testDatabaseConnection);
  runner.addTest('Output Directory Test', testOutputDirectoryCreation);
  runner.addTest('Dependencies Check', testDependencies);
  
  // Run all tests
  const success = await runner.runAllTests();
  
  console.log('\n=== Next Steps ===');
  
  if (success) {
    console.log('✓ All tests passed! Your benchmark setup is ready.');
    console.log('\nTo run benchmarks:');
    console.log('  npm run benchmark          # Run all benchmarks');
    console.log('  npm run benchmark:api      # Run API benchmarks only');
    console.log('  npm run benchmark:db       # Run database benchmarks only');
    console.log('\nFor Node.js version comparison:');
    console.log('  nvm use 20 && npm run benchmark');
    console.log('  nvm use 22 && npm run benchmark');
    console.log('  npm run benchmark:compare');
  } else {
    console.log('✗ Some tests failed. Please fix the issues above before running benchmarks.');
    console.log('\nCommon fixes:');
    console.log('  - Run: npm install');
    console.log('  - Set required environment variables');
    console.log('  - Make sure scripts are executable: chmod +x scripts/*.sh');
    console.log('  - Check database configuration');
  }
  
  process.exit(success ? 0 : 1);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    Logger.error(`Test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  BenchmarkTestRunner,
  TEST_CONFIG
};