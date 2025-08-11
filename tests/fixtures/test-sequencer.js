/**
 * Custom Jest Test Sequencer for Optimized Parallel Execution
 * 
 * Orders tests to minimize resource contention and maximize parallelization
 */

const TestSequencer = require('@jest/test-sequencer').default;

class OptimizedTestSequencer extends TestSequencer {
  /**
   * Order tests for optimal parallel execution
   * 
   * Strategy:
   * 1. Unit tests first (fastest, most parallel)
   * 2. Integration tests by resource usage
   * 3. E2E/workflow tests last (slowest, most resource intensive)
   */
  sort(tests) {
    const testCategories = {
      unit: [],
      integration: [],
      workflow: [],
      other: []
    };

    // Categorize tests based on path and patterns
    tests.forEach(test => {
      const testPath = test.path;
      
      if (testPath.includes('/unit/')) {
        testCategories.unit.push(test);
      } else if (testPath.includes('/integration/')) {
        testCategories.integration.push(test);
      } else if (testPath.includes('/workflows/')) {
        testCategories.workflow.push(test);
      } else {
        testCategories.other.push(test);
      }
    });

    // Sort within categories for optimal execution
    this.sortByExecutionTime(testCategories.unit);
    this.sortByResourceUsage(testCategories.integration);
    this.sortByDependencies(testCategories.workflow);

    // Return ordered test array
    return [
      ...testCategories.unit,
      ...testCategories.integration,
      ...testCategories.other,
      ...testCategories.workflow
    ];
  }

  /**
   * Sort unit tests by estimated execution time (fastest first)
   */
  sortByExecutionTime(tests) {
    const executionTimeEstimates = {
      'models': 100,
      'utils': 150,
      'services': 200,
      'controllers': 300,
      'middlewares': 250
    };

    tests.sort((testA, testB) => {
      const timeA = this.estimateExecutionTime(testA.path, executionTimeEstimates);
      const timeB = this.estimateExecutionTime(testB.path, executionTimeEstimates);
      return timeA - timeB;
    });
  }

  /**
   * Sort integration tests by resource usage (least resource-intensive first)
   */
  sortByResourceUsage(tests) {
    const resourceUsage = {
      'auth': 1,
      'user': 2,
      'availability': 3,
      'booking': 4,
      'calendar': 5, // Most resource intensive (external APIs)
      'workflows': 6
    };

    tests.sort((testA, testB) => {
      const usageA = this.estimateResourceUsage(testA.path, resourceUsage);
      const usageB = this.estimateResourceUsage(testB.path, resourceUsage);
      return usageA - usageB;
    });
  }

  /**
   * Sort workflow tests by dependencies (independent tests first)
   */
  sortByDependencies(tests) {
    const dependencyOrder = [
      'complete-user-onboarding',
      'user-registration-booking',
      'advanced-booking-scenarios',
      'calendar-integration',
      'payment-booking',
      'team-collaboration',
      'performance-scalability',
      'api-error-handling'
    ];

    tests.sort((testA, testB) => {
      const orderA = this.getDependencyOrder(testA.path, dependencyOrder);
      const orderB = this.getDependencyOrder(testB.path, dependencyOrder);
      return orderA - orderB;
    });
  }

  /**
   * Estimate execution time based on test path
   */
  estimateExecutionTime(testPath, estimates) {
    for (const [pattern, time] of Object.entries(estimates)) {
      if (testPath.includes(pattern)) {
        return time;
      }
    }
    return 500; // Default estimate
  }

  /**
   * Estimate resource usage based on test path
   */
  estimateResourceUsage(testPath, usage) {
    for (const [pattern, level] of Object.entries(usage)) {
      if (testPath.includes(pattern)) {
        return level;
      }
    }
    return 3; // Default level
  }

  /**
   * Get dependency order for workflow tests
   */
  getDependencyOrder(testPath, order) {
    for (let i = 0; i < order.length; i++) {
      if (testPath.includes(order[i])) {
        return i;
      }
    }
    return order.length; // Unknown tests go last
  }

  /**
   * Get cache identifier to invalidate cache when sequencer changes
   */
  getCacheId() {
    return `${super.getCacheId()}-optimized-v1.0.0`;
  }
}

module.exports = OptimizedTestSequencer;