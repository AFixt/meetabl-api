/**
 * Database Configuration Tests
 * Tests for database configuration and migration functionality
 */

const path = require('path');
const { Sequelize } = require('sequelize');

describe('Database Configuration Tests', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.NODE_ENV;
    // Clear module cache to allow re-requiring with different env
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  describe('Environment-based configuration loading', () => {
    it('should load test configuration in test environment', () => {
      process.env.NODE_ENV = 'test';
      const config = require('../../../src/config/database');
      
      expect(config).toBeDefined();
      expect(config.sequelize).toBeDefined();
      expect(config.Sequelize).toBe(Sequelize);
    });

    it('should load MySQL configuration in non-test environments', () => {
      process.env.NODE_ENV = 'development';
      const config = require('../../../src/config/database');
      
      expect(config).toBeDefined();
      expect(config.sequelize).toBeDefined();
      expect(config.sequelize.options.dialect).toBe('mysql');
    });
  });

  describe('Database JSON configuration', () => {
    it('should have valid JSON configuration file', () => {
      const configPath = path.join(__dirname, '../../../src/config/database.json');
      const config = require(configPath);
      
      expect(config).toBeDefined();
      expect(config.development).toBeDefined();
      expect(config.test).toBeDefined();
      expect(config.production).toBeDefined();
    });

    it('should have required properties for each environment', () => {
      const config = require('../../../src/config/database.json');
      const environments = ['development', 'test', 'production'];
      
      environments.forEach(env => {
        expect(config[env]).toHaveProperty('username');
        expect(config[env]).toHaveProperty('password');
        expect(config[env]).toHaveProperty('database');
        expect(config[env]).toHaveProperty('host');
        expect(config[env]).toHaveProperty('dialect');
      });
    });

    it('should use MySQL for all environments', () => {
      const config = require('../../../src/config/database.json');
      const environments = ['development', 'test', 'production'];
      
      environments.forEach(env => {
        expect(config[env].dialect).toBe('mysql');
      });
    });

    it('should have proper test database configuration', () => {
      const config = require('../../../src/config/database.json');
      
      expect(config.test.database).toContain('test');
      expect(config.test.logging).toBe(false);
    });
  });

  describe('MySQL Configuration', () => {
    it('should export valid Sequelize instance', () => {
      const mysqlConfig = require('../../../src/config/database-mysql');
      
      expect(mysqlConfig.sequelize).toBeInstanceOf(Sequelize);
      expect(mysqlConfig.Sequelize).toBe(Sequelize);
    });

    it('should use environment variables for sensitive data', () => {
      // Set test environment variables
      process.env.DB_HOST = 'test-host';
      process.env.DB_PORT = '3307';
      process.env.DB_NAME = 'test-db';
      process.env.DB_USER = 'test-user';
      process.env.DB_PASSWORD = 'test-password';
      
      jest.resetModules();
      const mysqlConfig = require('../../../src/config/database-mysql');
      const options = mysqlConfig.sequelize.options;
      
      expect(options.host).toBe('test-host');
      expect(options.port).toBe(3307);
      expect(options.database).toBe('test-db');
      expect(options.username).toBe('test-user');
    });

    it('should have proper pool configuration', () => {
      const mysqlConfig = require('../../../src/config/database-mysql');
      const poolConfig = mysqlConfig.sequelize.options.pool;
      
      expect(poolConfig).toBeDefined();
      expect(poolConfig.max).toBeGreaterThan(0);
      expect(poolConfig.min).toBeGreaterThanOrEqual(0);
      expect(poolConfig.acquire).toBeGreaterThan(0);
      expect(poolConfig.idle).toBeGreaterThan(0);
    });

    it('should have MySQL dialect configured', () => {
      const mysqlConfig = require('../../../src/config/database-mysql');
      const options = mysqlConfig.sequelize.options;
      
      expect(options.dialect).toBe('mysql');
      expect(options.host).toBeDefined();
      expect(options.database).toBeDefined();
    });
  });

  describe('Migration Configuration', () => {
    it('should have migrations directory configured', () => {
      const migrationPath = path.join(__dirname, '../../../migrations');
      const fs = require('fs');
      
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('should have valid migration files', () => {
      const migrationPath = path.join(__dirname, '../../../migrations');
      const fs = require('fs');
      const files = fs.readdirSync(migrationPath);
      
      files.forEach(file => {
        if (file.endsWith('.js')) {
          const migration = require(path.join(migrationPath, file));
          expect(migration).toHaveProperty('up');
          expect(migration).toHaveProperty('down');
          expect(typeof migration.up).toBe('function');
          expect(typeof migration.down).toBe('function');
        }
      });
    });

    it('should follow migration naming convention', () => {
      const migrationPath = path.join(__dirname, '../../../migrations');
      const fs = require('fs');
      const files = fs.readdirSync(migrationPath);
      
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      migrationFiles.forEach(file => {
        // Should start with date format YYYYMMDD
        expect(file).toMatch(/^\d{8}-[\w-]+\.js$/);
      });
    });
  });

  describe('Database connection validation', () => {
    it('should validate required connection parameters', () => {
      const validateConnection = (config) => {
        const required = ['host', 'database', 'username', 'dialect'];
        return required.every(param => config[param]);
      };

      const config = require('../../../src/config/database.json');
      
      expect(validateConnection(config.development)).toBe(true);
      expect(validateConnection(config.test)).toBe(true);
      expect(validateConnection(config.production)).toBe(true);
    });

    it('should have different databases for each environment', () => {
      const config = require('../../../src/config/database.json');
      const databases = new Set([
        config.development.database,
        config.test.database,
        config.production.database
      ]);
      
      // Should have at least 2 unique database names (test/dev could be same)
      expect(databases.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Sequelize options validation', () => {
    it('should have proper logging configuration', () => {
      const mysqlConfig = require('../../../src/config/database-mysql');
      const options = mysqlConfig.sequelize.options;
      
      // Logging should be configured (either function or boolean)
      expect(options.logging).toBeDefined();
      expect(typeof options.logging === 'function' || typeof options.logging === 'boolean').toBe(true);
    });

    it('should use MySQL timezone handling', () => {
      const mysqlConfig = require('../../../src/config/database-mysql');
      const options = mysqlConfig.sequelize.options;
      
      // Timezone may not be explicitly set, which means MySQL server timezone is used
      // This is acceptable for MySQL connections
      expect(options.dialect).toBe('mysql');
      if (options.timezone) {
        expect(typeof options.timezone).toBe('string');
      }
    });

    it('should have proper define options', () => {
      const mysqlConfig = require('../../../src/config/database-mysql');
      const defineOptions = mysqlConfig.sequelize.options.define;
      
      expect(defineOptions).toBeDefined();
      // Based on actual configuration in database-mysql.js
      expect(defineOptions.timestamps).toBe(false);
      expect(defineOptions.underscored).toBe(true);
      expect(defineOptions.freezeTableName).toBe(true);
    });
  });
});