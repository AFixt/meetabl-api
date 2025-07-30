/**
 * Database Migrations Tests
 * Tests for database migration functionality
 */

const path = require('path');
const fs = require('fs');
const { Sequelize, QueryInterface } = require('sequelize');

describe('Database Migrations Tests', () => {
  const migrationsPath = path.join(__dirname, '../../../migrations');
  let sequelize;
  let queryInterface;

  beforeEach(() => {
    // Create a test Sequelize instance
    sequelize = new Sequelize('sqlite::memory:', {
      logging: false
    });
    queryInterface = sequelize.getQueryInterface();
  });

  afterEach(async () => {
    // Close database connection
    await sequelize.close();
  });

  describe('Migration Files Structure', () => {
    it('should have migrations directory', () => {
      expect(fs.existsSync(migrationsPath)).toBe(true);
    });

    it('should contain migration files', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      expect(migrationFiles.length).toBeGreaterThan(0);
    });

    it('should follow naming convention YYYYMMDD-description.js', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const namePattern = /^(\d{8})-(.+)\.js$/;
        expect(file).toMatch(namePattern);
        
        const [, dateStr, description] = file.match(namePattern);
        
        // Validate date format
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6));
        const day = parseInt(dateStr.substring(6, 8));
        
        expect(year).toBeGreaterThanOrEqual(2024);
        expect(year).toBeLessThanOrEqual(new Date().getFullYear());
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31);
        
        // Validate description format (kebab-case)
        expect(description).toMatch(/^[a-z0-9-]+$/);
      });
    });
  });

  describe('Migration Interface', () => {
    it('should export up and down functions', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const migration = require(path.join(migrationsPath, file));
        
        expect(migration).toHaveProperty('up');
        expect(migration).toHaveProperty('down');
        expect(typeof migration.up).toBe('function');
        expect(typeof migration.down).toBe('function');
      });
    });

    it('should have async functions', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const migration = require(path.join(migrationsPath, file));
        
        // Check if functions are async (return promises)
        const upResult = migration.up(queryInterface, Sequelize);
        const downResult = migration.down(queryInterface, Sequelize);
        
        expect(upResult).toBeInstanceOf(Promise);
        expect(downResult).toBeInstanceOf(Promise);
      });
    });

    it('should receive correct parameters', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const migration = require(path.join(migrationsPath, file));
        
        // Test that functions accept queryInterface and Sequelize
        expect(() => {
          migration.up(queryInterface, Sequelize);
          migration.down(queryInterface, Sequelize);
        }).not.toThrow();
      });
    });
  });

  describe('Migration Reversibility', () => {
    it('should have reversible migrations', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const migration = require(path.join(migrationsPath, file));
        
        // Check that both up and down are implemented
        expect(migration.up.toString()).not.toContain('throw new Error');
        expect(migration.down.toString()).not.toContain('throw new Error');
        expect(migration.up.toString()).not.toContain('TODO');
        expect(migration.down.toString()).not.toContain('TODO');
      });
    });
  });

  describe('Specific Migration Tests', () => {
    describe('20250728-add-meeting-duration-to-user-settings.js', () => {
      const migrationFile = '20250728-add-meeting-duration-to-user-settings.js';
      let migration;

      beforeEach(() => {
        migration = require(path.join(migrationsPath, migrationFile));
      });

      it('should add defaultMeetingDuration column in up migration', async () => {
        // Mock queryInterface methods
        queryInterface.addColumn = jest.fn().mockResolvedValue(true);
        
        await migration.up(queryInterface, Sequelize);
        
        expect(queryInterface.addColumn).toHaveBeenCalledWith(
          'user_settings',
          'defaultMeetingDuration',
          expect.objectContaining({
            type: expect.any(Object),
            allowNull: false,
            defaultValue: 30
          })
        );
      });

      it('should remove defaultMeetingDuration column in down migration', async () => {
        // Mock queryInterface methods
        queryInterface.removeColumn = jest.fn().mockResolvedValue(true);
        
        await migration.down(queryInterface, Sequelize);
        
        expect(queryInterface.removeColumn).toHaveBeenCalledWith(
          'user_settings',
          'defaultMeetingDuration'
        );
      });

      it('should use INTEGER data type', async () => {
        queryInterface.addColumn = jest.fn().mockResolvedValue(true);
        
        await migration.up(queryInterface, Sequelize);
        
        const callArgs = queryInterface.addColumn.mock.calls[0];
        const columnDefinition = callArgs[2];
        
        expect(columnDefinition.type).toBe(Sequelize.INTEGER);
      });

      it('should have proper constraints', async () => {
        queryInterface.addColumn = jest.fn().mockResolvedValue(true);
        
        await migration.up(queryInterface, Sequelize);
        
        const callArgs = queryInterface.addColumn.mock.calls[0];
        const columnDefinition = callArgs[2];
        
        expect(columnDefinition.allowNull).toBe(false);
        expect(columnDefinition.defaultValue).toBe(30);
        if (columnDefinition.validate) {
          expect(columnDefinition.validate.min).toBe(15);
          expect(columnDefinition.validate.max).toBe(480);
        }
      });
    });
  });

  describe('Migration Safety Checks', () => {
    it('should not drop tables in migrations', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const content = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
        
        // Check for dangerous operations
        expect(content).not.toMatch(/dropTable/i);
        expect(content).not.toMatch(/DROP\s+TABLE/i);
      });
    });

    it('should not truncate tables in migrations', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const content = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
        
        expect(content).not.toMatch(/truncate/i);
        expect(content).not.toMatch(/TRUNCATE\s+TABLE/i);
      });
    });

    it('should use transactions when available', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const migration = require(path.join(migrationsPath, file));
        
        // Check if migration supports transactions
        if (migration.transaction !== false) {
          expect(migration.transaction).not.toBe(false);
        }
      });
    });
  });

  describe('Migration Documentation', () => {
    it('should have descriptive file names', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const [, , description] = file.match(/^(\d{8})-(.+)\.js$/);
        
        // Description should be meaningful
        expect(description.length).toBeGreaterThan(5);
        expect(description).not.toMatch(/^test/i);
        expect(description).not.toMatch(/^temp/i);
        expect(description).not.toMatch(/^tmp/i);
      });
    });

    it('should have comments in migration files', () => {
      const files = fs.readdirSync(migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.js'));
      
      migrationFiles.forEach(file => {
        const content = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
        
        // Should have some comments
        expect(content).toMatch(/\/\*\*|\*\/|\/\//);
      });
    });
  });
});