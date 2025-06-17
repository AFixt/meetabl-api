/**
 * Node.js 22 Database Compatibility Tests
 * 
 * Tests to verify Sequelize and MySQL2 work correctly with Node.js 22
 * 
 * @author meetabl Team
 */

const { sequelize, initializeDatabase } = require('../../src/config/database');
const logger = require('../../src/config/logger');

describe('Database Node.js 22 Compatibility', () => {
  beforeAll(async () => {
    // Override console.error to suppress expected test errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(async () => {
    await sequelize.close();
    console.error.mockRestore();
  });

  describe('Database Connection', () => {
    test('should connect successfully with Node.js 22', async () => {
      const result = await initializeDatabase();
      expect(result).toBe(sequelize);
      expect(sequelize.options.dialect).toBe('mysql');
    });

    test('should use UTF8MB4 charset', () => {
      const dialectOptions = sequelize.options.dialectOptions;
      expect(dialectOptions.charset).toBe('utf8mb4');
    });

    test('should have proper timeout configurations', () => {
      const dialectOptions = sequelize.options.dialectOptions;
      expect(dialectOptions.connectTimeout).toBe(60000);
      expect(dialectOptions.acquireTimeout).toBe(60000);
      expect(dialectOptions.timeout).toBe(60000);
    });

    test('should have proper pool configuration', () => {
      const pool = sequelize.options.pool;
      expect(pool).toBeDefined();
      expect(pool.max).toBeGreaterThan(0);
      expect(pool.acquire).toBeGreaterThan(0);
      expect(pool.idle).toBeGreaterThan(0);
    });

    test('should authenticate successfully', async () => {
      await expect(sequelize.authenticate()).resolves.not.toThrow();
    });
  });

  describe('Query Execution', () => {
    test('should execute simple SELECT query', async () => {
      const [results] = await sequelize.query('SELECT 1 as test_value');
      expect(results).toHaveLength(1);
      expect(results[0].test_value).toBe(1);
    });

    test('should handle database version query', async () => {
      const [results] = await sequelize.query('SELECT VERSION() as version');
      expect(results).toHaveLength(1);
      expect(results[0].version).toBeDefined();
      logger.info(`Database version: ${results[0].version}`);
    });

    test('should handle timezone query', async () => {
      const [results] = await sequelize.query('SELECT @@session.time_zone as timezone');
      expect(results).toHaveLength(1);
      expect(results[0].timezone).toBeDefined();
      logger.info(`Database timezone: ${results[0].timezone}`);
    });

    test('should handle character set query', async () => {
      const [results] = await sequelize.query('SELECT @@character_set_database as charset');
      expect(results).toHaveLength(1);
      expect(results[0].charset).toBeDefined();
      logger.info(`Database charset: ${results[0].charset}`);
    });
  });

  describe('Node.js 22 Specific Tests', () => {
    test('should work with async/await patterns', async () => {
      const testPromise = new Promise((resolve) => {
        setTimeout(() => resolve('test'), 100);
      });
      
      const result = await testPromise;
      expect(result).toBe('test');
    });

    test('should handle Promise.allSettled correctly', async () => {
      const promises = [
        sequelize.query('SELECT 1'),
        sequelize.query('SELECT 2'),
        sequelize.query('SELECT 3')
      ];
      
      const results = await Promise.allSettled(promises);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });

    test('should verify Node.js version is 22+', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
      expect(majorVersion).toBeGreaterThanOrEqual(22);
      logger.info(`Running on Node.js ${nodeVersion}`);
    });
  });
});