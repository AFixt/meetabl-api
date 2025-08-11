#!/usr/bin/env node

/**
 * Database Performance Benchmarking Script
 * 
 * This script specifically tests database performance to compare
 * Node.js 20 vs 22 impact on database operations.
 * 
 * Tests include:
 * - Connection establishment time
 * - Query execution times for common operations
 * - Transaction performance
 * - Connection pool behavior
 * - Memory usage during DB operations
 * 
 * @author meetabl Team
 */

// Set environment for testing
process.env.NODE_ENV = 'development';
require('dotenv').config();

const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

// Import database configuration and models
const { sequelize } = require('../src/config/database');
const {
  User,
  Booking,
  AvailabilityRule,
  CalendarToken,
  UserSettings,
  Notification,
  AuditLog
} = require('../src/models');

/**
 * Database Performance Test Configuration
 */
const DB_CONFIG = {
  test: {
    connectionTests: 10,
    queryIterations: 100,
    bulkInsertSize: 1000,
    concurrentQueries: [1, 5, 10, 25],
    memoryCheckInterval: 500
  },
  outputDir: path.join(__dirname, '..', 'benchmark-results', 'database')
};

/**
 * Database Performance Test Suite
 */
class DatabasePerformanceTest {
  constructor() {
    this.results = {
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      databaseConfig: {
        dialect: sequelize.getDialect(),
        pool: sequelize.config.pool
      },
      tests: {}
    };
    this.memorySnapshots = [];
  }

  /**
   * Take memory snapshot
   */
  takeMemorySnapshot(label) {
    const memUsage = process.memoryUsage();
    this.memorySnapshots.push({
      label,
      timestamp: Date.now(),
      ...memUsage
    });
  }

  /**
   * Test database connection performance
   */
  async testConnectionPerformance() {
    console.log('Testing database connection performance...');
    
    const connectionTimes = [];
    
    for (let i = 0; i < DB_CONFIG.test.connectionTests; i++) {
      const startTime = performance.now();
      
      try {
        await sequelize.authenticate();
        const endTime = performance.now();
        connectionTimes.push(endTime - startTime);
      } catch (error) {
        console.error(`Connection test ${i + 1} failed:`, error.message);
        connectionTimes.push(null);
      }
    }
    
    const validTimes = connectionTimes.filter(t => t !== null);
    
    this.results.tests.connectionPerformance = {
      iterations: DB_CONFIG.test.connectionTests,
      successful: validTimes.length,
      failed: connectionTimes.length - validTimes.length,
      times: {
        min: Math.min(...validTimes),
        max: Math.max(...validTimes),
        avg: validTimes.reduce((a, b) => a + b, 0) / validTimes.length,
        median: validTimes.sort((a, b) => a - b)[Math.floor(validTimes.length / 2)]
      }
    };
  }

  /**
   * Test basic CRUD operations performance
   */
  async testCrudPerformance() {
    console.log('Testing CRUD operations performance...');
    
    const operations = {
      create: [],
      read: [],
      update: [],
      delete: []
    };

    this.takeMemorySnapshot('Before CRUD tests');

    // Create test data
    const testUsers = [];
    for (let i = 0; i < DB_CONFIG.test.queryIterations; i++) {
      const startTime = performance.now();
      
      try {
        const user = await User.create({
          firstName: `TestUser${i}`,
          lastName: 'Performance',
          email: `perf-test-${i}-${Date.now()}@example.com`,
          password: 'hashedPassword123',
          timezone: 'America/New_York'
        });
        
        const endTime = performance.now();
        operations.create.push(endTime - startTime);
        testUsers.push(user.id);
      } catch (error) {
        console.error(`Create operation ${i + 1} failed:`, error.message);
        operations.create.push(null);
      }
    }

    this.takeMemorySnapshot('After CREATE operations');

    // Read operations
    for (let i = 0; i < Math.min(testUsers.length, DB_CONFIG.test.queryIterations); i++) {
      const startTime = performance.now();
      
      try {
        await User.findByPk(testUsers[i]);
        const endTime = performance.now();
        operations.read.push(endTime - startTime);
      } catch (error) {
        console.error(`Read operation ${i + 1} failed:`, error.message);
        operations.read.push(null);
      }
    }

    this.takeMemorySnapshot('After READ operations');

    // Update operations
    for (let i = 0; i < Math.min(testUsers.length, DB_CONFIG.test.queryIterations / 2); i++) {
      const startTime = performance.now();
      
      try {
        await User.update(
          { firstName: `UpdatedUser${i}` },
          { where: { id: testUsers[i] } }
        );
        const endTime = performance.now();
        operations.update.push(endTime - startTime);
      } catch (error) {
        console.error(`Update operation ${i + 1} failed:`, error.message);
        operations.update.push(null);
      }
    }

    this.takeMemorySnapshot('After UPDATE operations');

    // Delete operations
    for (let i = 0; i < testUsers.length; i++) {
      const startTime = performance.now();
      
      try {
        await User.destroy({ where: { id: testUsers[i] } });
        const endTime = performance.now();
        operations.delete.push(endTime - startTime);
      } catch (error) {
        console.error(`Delete operation ${i + 1} failed:`, error.message);
        operations.delete.push(null);
      }
    }

    this.takeMemorySnapshot('After DELETE operations');

    // Calculate statistics for each operation
    this.results.tests.crudPerformance = {};
    
    for (const [operation, times] of Object.entries(operations)) {
      const validTimes = times.filter(t => t !== null);
      
      if (validTimes.length > 0) {
        this.results.tests.crudPerformance[operation] = {
          iterations: times.length,
          successful: validTimes.length,
          failed: times.length - validTimes.length,
          times: {
            min: Math.min(...validTimes),
            max: Math.max(...validTimes),
            avg: validTimes.reduce((a, b) => a + b, 0) / validTimes.length,
            median: validTimes.sort((a, b) => a - b)[Math.floor(validTimes.length / 2)],
            p95: validTimes.sort((a, b) => a - b)[Math.floor(validTimes.length * 0.95)],
            p99: validTimes.sort((a, b) => a - b)[Math.floor(validTimes.length * 0.99)]
          }
        };
      }
    }
  }

  /**
   * Test complex queries performance
   */
  async testComplexQueryPerformance() {
    console.log('Testing complex queries performance...');
    
    const queries = {
      userWithSettings: [],
      bookingsWithUsers: [],
      availabilityWithRules: [],
      aggregateQueries: []
    };

    this.takeMemorySnapshot('Before complex queries');

    // Create some test data first
    const testUser = await User.create({
      firstName: 'ComplexTest',
      lastName: 'User',
      email: `complex-test-${Date.now()}@example.com`,
      password: 'hashedPassword123',
      timezone: 'America/New_York'
    });

    await UserSettings.create({
      userId: testUser.id,
      theme: 'light',
      language: 'en',
      timezone: 'America/New_York'
    });

    // Test JOIN queries
    for (let i = 0; i < DB_CONFIG.test.queryIterations / 4; i++) {
      const startTime = performance.now();
      
      try {
        await User.findAll({
          include: [
            {
              model: UserSettings,
              as: 'settings'
            }
          ],
          limit: 10
        });
        
        const endTime = performance.now();
        queries.userWithSettings.push(endTime - startTime);
      } catch (error) {
        console.error(`User with settings query ${i + 1} failed:`, error.message);
        queries.userWithSettings.push(null);
      }
    }

    // Test aggregate queries
    for (let i = 0; i < DB_CONFIG.test.queryIterations / 4; i++) {
      const startTime = performance.now();
      
      try {
        await User.count();
        const endTime = performance.now();
        queries.aggregateQueries.push(endTime - startTime);
      } catch (error) {
        console.error(`Aggregate query ${i + 1} failed:`, error.message);
        queries.aggregateQueries.push(null);
      }
    }

    this.takeMemorySnapshot('After complex queries');

    // Calculate statistics
    this.results.tests.complexQueryPerformance = {};
    
    for (const [queryType, times] of Object.entries(queries)) {
      const validTimes = times.filter(t => t !== null);
      
      if (validTimes.length > 0) {
        this.results.tests.complexQueryPerformance[queryType] = {
          iterations: times.length,
          successful: validTimes.length,
          failed: times.length - validTimes.length,
          times: {
            min: Math.min(...validTimes),
            max: Math.max(...validTimes),
            avg: validTimes.reduce((a, b) => a + b, 0) / validTimes.length,
            median: validTimes.sort((a, b) => a - b)[Math.floor(validTimes.length / 2)]
          }
        };
      }
    }

    // Clean up test data
    await UserSettings.destroy({ where: { userId: testUser.id } });
    await User.destroy({ where: { id: testUser.id } });
  }

  /**
   * Test transaction performance
   */
  async testTransactionPerformance() {
    console.log('Testing transaction performance...');
    
    const transactionTimes = [];
    
    this.takeMemorySnapshot('Before transaction tests');

    for (let i = 0; i < DB_CONFIG.test.queryIterations / 4; i++) {
      const startTime = performance.now();
      
      try {
        await sequelize.transaction(async (t) => {
          const user = await User.create({
            firstName: `TransactionTest${i}`,
            lastName: 'User',
            email: `transaction-test-${i}-${Date.now()}@example.com`,
            password: 'hashedPassword123',
            timezone: 'America/New_York'
          }, { transaction: t });

          await UserSettings.create({
            userId: user.id,
            theme: 'light',
            language: 'en',
            timezone: 'America/New_York'
          }, { transaction: t });

          // Cleanup within transaction
          await UserSettings.destroy({ where: { userId: user.id } }, { transaction: t });
          await User.destroy({ where: { id: user.id } }, { transaction: t });
        });
        
        const endTime = performance.now();
        transactionTimes.push(endTime - startTime);
      } catch (error) {
        console.error(`Transaction ${i + 1} failed:`, error.message);
        transactionTimes.push(null);
      }
    }

    this.takeMemorySnapshot('After transaction tests');

    const validTimes = transactionTimes.filter(t => t !== null);
    
    this.results.tests.transactionPerformance = {
      iterations: transactionTimes.length,
      successful: validTimes.length,
      failed: transactionTimes.length - validTimes.length,
      times: {
        min: Math.min(...validTimes),
        max: Math.max(...validTimes),
        avg: validTimes.reduce((a, b) => a + b, 0) / validTimes.length,
        median: validTimes.sort((a, b) => a - b)[Math.floor(validTimes.length / 2)]
      }
    };
  }

  /**
   * Test bulk operations performance
   */
  async testBulkOperationsPerformance() {
    console.log('Testing bulk operations performance...');
    
    const bulkOperations = {
      bulkCreate: [],
      bulkUpdate: [],
      bulkDelete: []
    };

    this.takeMemorySnapshot('Before bulk operations');

    // Bulk create
    const bulkData = Array.from({ length: DB_CONFIG.test.bulkInsertSize }, (_, i) => ({
      firstName: `BulkUser${i}`,
      lastName: 'Test',
      email: `bulk-${i}-${Date.now()}@example.com`,
      password: 'hashedPassword123',
      timezone: 'America/New_York'
    }));

    const startCreateTime = performance.now();
    
    try {
      const createdUsers = await User.bulkCreate(bulkData, { returning: true });
      const endCreateTime = performance.now();
      bulkOperations.bulkCreate.push(endCreateTime - startCreateTime);
      
      this.takeMemorySnapshot('After bulk create');

      // Bulk update
      const userIds = createdUsers.map(u => u.id);
      const startUpdateTime = performance.now();
      
      await User.update(
        { firstName: 'BulkUpdated' },
        { where: { id: userIds } }
      );
      
      const endUpdateTime = performance.now();
      bulkOperations.bulkUpdate.push(endUpdateTime - startUpdateTime);
      
      this.takeMemorySnapshot('After bulk update');

      // Bulk delete
      const startDeleteTime = performance.now();
      
      await User.destroy({ where: { id: userIds } });
      
      const endDeleteTime = performance.now();
      bulkOperations.bulkDelete.push(endDeleteTime - startDeleteTime);
      
      this.takeMemorySnapshot('After bulk delete');
      
    } catch (error) {
      console.error('Bulk operations failed:', error.message);
      bulkOperations.bulkCreate.push(null);
      bulkOperations.bulkUpdate.push(null);
      bulkOperations.bulkDelete.push(null);
    }

    // Calculate statistics
    this.results.tests.bulkOperationsPerformance = {};
    
    for (const [operation, times] of Object.entries(bulkOperations)) {
      const validTimes = times.filter(t => t !== null);
      
      if (validTimes.length > 0) {
        this.results.tests.bulkOperationsPerformance[operation] = {
          recordCount: DB_CONFIG.test.bulkInsertSize,
          successful: validTimes.length,
          failed: times.length - validTimes.length,
          totalTime: validTimes[0] || 0,
          recordsPerSecond: validTimes.length > 0 ? (DB_CONFIG.test.bulkInsertSize / (validTimes[0] / 1000)) : 0
        };
      }
    }
  }

  /**
   * Analyze memory usage throughout tests
   */
  analyzeMemoryUsage() {
    if (this.memorySnapshots.length === 0) return null;

    const memoryAnalysis = {
      snapshots: this.memorySnapshots.length,
      totalDuration: this.memorySnapshots[this.memorySnapshots.length - 1].timestamp - this.memorySnapshots[0].timestamp,
      memoryStats: {
        rss: {
          initial: this.memorySnapshots[0].rss,
          final: this.memorySnapshots[this.memorySnapshots.length - 1].rss,
          peak: Math.max(...this.memorySnapshots.map(s => s.rss)),
          growth: this.memorySnapshots[this.memorySnapshots.length - 1].rss - this.memorySnapshots[0].rss
        },
        heapUsed: {
          initial: this.memorySnapshots[0].heapUsed,
          final: this.memorySnapshots[this.memorySnapshots.length - 1].heapUsed,
          peak: Math.max(...this.memorySnapshots.map(s => s.heapUsed)),
          growth: this.memorySnapshots[this.memorySnapshots.length - 1].heapUsed - this.memorySnapshots[0].heapUsed
        },
        heapTotal: {
          initial: this.memorySnapshots[0].heapTotal,
          final: this.memorySnapshots[this.memorySnapshots.length - 1].heapTotal,
          peak: Math.max(...this.memorySnapshots.map(s => s.heapTotal)),
          growth: this.memorySnapshots[this.memorySnapshots.length - 1].heapTotal - this.memorySnapshots[0].heapTotal
        }
      }
    };

    return memoryAnalysis;
  }

  /**
   * Run all database performance tests
   */
  async runAllTests() {
    console.log('Starting database performance tests...');
    console.log(`Node.js version: ${process.version}`);
    console.log(`Database: ${sequelize.getDialect()}`);
    
    this.takeMemorySnapshot('Test start');

    try {
      // Ensure database connection
      await sequelize.authenticate();
      console.log('Database connection established');

      // Run all test suites
      await this.testConnectionPerformance();
      await this.testCrudPerformance();
      await this.testComplexQueryPerformance();
      await this.testTransactionPerformance();
      await this.testBulkOperationsPerformance();

      this.takeMemorySnapshot('Test end');

      // Analyze memory usage
      this.results.memoryAnalysis = this.analyzeMemoryUsage();

      console.log('All database performance tests completed');
      return this.results;

    } catch (error) {
      console.error('Database performance tests failed:', error);
      throw error;
    } finally {
      // Close database connection
      try {
        await sequelize.close();
        console.log('Database connection closed');
      } catch (error) {
        console.error('Error closing database connection:', error);
      }
    }
  }
}

/**
 * Results manager for database tests
 */
class DatabaseResultsManager {
  static async ensureOutputDir() {
    try {
      await fs.access(DB_CONFIG.outputDir);
    } catch {
      await fs.mkdir(DB_CONFIG.outputDir, { recursive: true });
    }
  }

  static async saveResults(results) {
    await this.ensureOutputDir();
    
    const filename = `db-benchmark-node-${process.version}-${Date.now()}.json`;
    const filepath = path.join(DB_CONFIG.outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    
    console.log(`Database benchmark results saved to: ${filepath}`);
    return filepath;
  }

  static printSummary(results) {
    console.log('\n=== Database Performance Test Summary ===');
    console.log(`Node.js Version: ${results.nodeVersion}`);
    console.log(`Test Date: ${results.timestamp}`);
    
    if (results.tests.connectionPerformance) {
      const conn = results.tests.connectionPerformance;
      console.log(`\nConnection Performance:`);
      console.log(`  Average: ${conn.times.avg.toFixed(2)}ms`);
      console.log(`  Min/Max: ${conn.times.min.toFixed(2)}ms / ${conn.times.max.toFixed(2)}ms`);
    }

    if (results.tests.crudPerformance) {
      console.log(`\nCRUD Performance (avg times):`);
      Object.entries(results.tests.crudPerformance).forEach(([op, stats]) => {
        console.log(`  ${op.toUpperCase()}: ${stats.times.avg.toFixed(2)}ms`);
      });
    }

    if (results.tests.bulkOperationsPerformance) {
      console.log(`\nBulk Operations Performance:`);
      Object.entries(results.tests.bulkOperationsPerformance).forEach(([op, stats]) => {
        console.log(`  ${op}: ${stats.recordsPerSecond.toFixed(0)} records/sec`);
      });
    }

    if (results.memoryAnalysis) {
      const mem = results.memoryAnalysis.memoryStats;
      console.log(`\nMemory Usage:`);
      console.log(`  RSS Growth: ${(mem.rss.growth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap Growth: ${(mem.heapUsed.growth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Peak RSS: ${(mem.rss.peak / 1024 / 1024).toFixed(2)}MB`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const test = new DatabasePerformanceTest();
    const results = await test.runAllTests();
    
    await DatabaseResultsManager.saveResults(results);
    DatabaseResultsManager.printSummary(results);
    
  } catch (error) {
    console.error('Database benchmark failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  DatabasePerformanceTest,
  DatabaseResultsManager,
  DB_CONFIG
};