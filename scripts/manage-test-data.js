#!/usr/bin/env node

/**
 * Test Data Management Script
 * 
 * Manages test database seeding for consistent E2E testing
 * Provides commands to seed, clean, and manage test data
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { Sequelize } = require('sequelize');
const logger = require('../src/config/logger');
const testDataFactory = require('../src/db/test-data-factory');

// Command line argument parsing
const args = process.argv.slice(2);
const command = args[0];
const environment = process.env.NODE_ENV || 'test';

// Database configuration
const dbConfig = require('../src/config/database').config[environment];

class TestDataManager {
  constructor() {
    this.sequelize = new Sequelize(dbConfig);
  }

  async connect() {
    try {
      await this.sequelize.authenticate();
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Unable to connect to database:', error.message);
      process.exit(1);
    }
  }

  async disconnect() {
    await this.sequelize.close();
  }

  /**
   * Seed the database with E2E test data
   */
  async seedE2EData() {
    try {
      console.log('🌱 Seeding E2E test data...');
      
      // Run the E2E test data seeder
      execSync('npx sequelize-cli db:seed --seed 20250729000000-e2e-test-data.js', {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: environment }
      });
      
      console.log('✅ E2E test data seeded successfully');
    } catch (error) {
      console.error('❌ Failed to seed E2E test data:', error.message);
      throw error;
    }
  }

  /**
   * Seed demo data for development
   */
  async seedDemoData() {
    try {
      console.log('🌱 Seeding demo data...');
      
      // Run the demo data seeder
      execSync('npx sequelize-cli db:seed --seed 20250410000000-demo-data.js', {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: environment }
      });
      
      console.log('✅ Demo data seeded successfully');
    } catch (error) {
      console.error('❌ Failed to seed demo data:', error.message);
      throw error;
    }
  }

  /**
   * Generate and seed dynamic test data using the factory
   */
  async seedFactoryData(scenario = 'standard', count = 10) {
    try {
      console.log(`🏭 Generating ${scenario} test data with factory...`);
      
      // Generate test data using factory
      const data = await testDataFactory.generateCompleteScenario(scenario);
      
      // Insert generated data into database
      const queryInterface = this.sequelize.getQueryInterface();
      
      if (data.user) {
        await queryInterface.bulkInsert('Users', [data.user]);
        console.log(`✅ Generated 1 user`);
      }
      
      if (data.users) {
        await queryInterface.bulkInsert('Users', data.users);
        console.log(`✅ Generated ${data.users.length} users`);
      }
      
      if (data.bookings) {
        await queryInterface.bulkInsert('Bookings', data.bookings);
        console.log(`✅ Generated ${data.bookings.length} bookings`);
      }
      
      if (data.team) {
        await queryInterface.bulkInsert('Teams', [data.team]);
        console.log(`✅ Generated 1 team`);
      }
      
      if (data.teamMembers) {
        await queryInterface.bulkInsert('TeamMembers', data.teamMembers);
        console.log(`✅ Generated ${data.teamMembers.length} team members`);
      }
      
      console.log('✅ Factory data seeded successfully');
    } catch (error) {
      console.error('❌ Failed to seed factory data:', error.message);
      throw error;
    }
  }

  /**
   * Clean all test data from database
   */
  async cleanTestData() {
    try {
      console.log('🧹 Cleaning test data...');
      
      const queryInterface = this.sequelize.getQueryInterface();
      
      // Delete in reverse order to maintain referential integrity
      const tables = [
        'AuditLogs',
        'Notifications',
        'TeamMembers',
        'Teams',
        'CalendarTokens',
        'Bookings',
        'AvailabilityRules',
        'UserSettings',
        'Users'
      ];
      
      for (const table of tables) {
        try {
          await queryInterface.bulkDelete(table, {});
          console.log(`✅ Cleaned ${table}`);
        } catch (error) {
          console.warn(`⚠️  Failed to clean ${table}: ${error.message}`);
        }
      }
      
      console.log('✅ Test data cleaned successfully');
    } catch (error) {
      console.error('❌ Failed to clean test data:', error.message);
      throw error;
    }
  }

  /**
   * Reset the database to a clean state and seed with fresh data
   */
  async resetAndSeed(seedType = 'e2e') {
    try {
      console.log('🔄 Resetting database and seeding fresh data...');
      
      await this.cleanTestData();
      
      switch (seedType) {
        case 'e2e':
          await this.seedE2EData();
          break;
        case 'demo':
          await this.seedDemoData();
          break;
        case 'factory':
          await this.seedFactoryData();
          break;
        default:
          console.warn(`⚠️  Unknown seed type: ${seedType}. Using E2E data.`);
          await this.seedE2EData();
      }
      
      console.log('✅ Database reset and seeded successfully');
    } catch (error) {
      console.error('❌ Failed to reset and seed database:', error.message);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    try {
      console.log('📦 Running database migrations...');
      
      execSync('npx sequelize-cli db:migrate', {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: environment }
      });
      
      console.log('✅ Migrations completed successfully');
    } catch (error) {
      console.error('❌ Failed to run migrations:', error.message);
      throw error;
    }
  }

  /**
   * Check database status and show current data counts
   */
  async checkStatus() {
    try {
      console.log('📊 Checking database status...');
      
      const tables = [
        'Users',
        'UserSettings',
        'AvailabilityRules',
        'Bookings',
        'Teams',
        'TeamMembers',
        'Notifications',
        'CalendarTokens',
        'AuditLogs'
      ];
      
      console.log('\n📈 Current data counts:');
      console.log('┌─────────────────────┬───────┐');
      console.log('│ Table               │ Count │');
      console.log('├─────────────────────┼───────┤');
      
      for (const table of tables) {
        try {
          const [results] = await this.sequelize.query(`SELECT COUNT(*) as count FROM ${table}`);
          const count = results[0].count;
          console.log(`│ ${table.padEnd(19)} │ ${count.toString().padStart(5)} │`);
        } catch (error) {
          console.log(`│ ${table.padEnd(19)} │ ERROR │`);
        }
      }
      
      console.log('└─────────────────────┴───────┘\n');
    } catch (error) {
      console.error('❌ Failed to check database status:', error.message);
      throw error;
    }
  }

  /**
   * Export current test data for sharing or backup
   */
  async exportTestData(outputFile) {
    try {
      console.log('📤 Exporting test data...');
      
      const data = {};
      const tables = ['Users', 'UserSettings', 'AvailabilityRules', 'Bookings'];
      
      for (const table of tables) {
        const [results] = await this.sequelize.query(`SELECT * FROM ${table}`);
        data[table] = results;
      }
      
      const outputPath = path.resolve(outputFile || 'test-data-export.json');
      await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
      
      console.log(`✅ Test data exported to: ${outputPath}`);
    } catch (error) {
      console.error('❌ Failed to export test data:', error.message);
      throw error;
    }
  }

  /**
   * Display help information
   */
  showHelp() {
    console.log(`
📚 Test Data Management Tool

Usage: node scripts/manage-test-data.js <command> [options]

Commands:
  seed-e2e              Seed E2E test data
  seed-demo             Seed demo development data
  seed-factory [type]   Generate data using factory (standard, teamCollaboration, etc.)
  clean                 Clean all test data
  reset [type]          Clean and seed fresh data (e2e, demo, factory)
  migrate               Run database migrations
  status                Check database status and data counts
  export [file]         Export current test data to JSON file
  help                  Show this help message

Environment:
  NODE_ENV=${environment}
  Database: ${dbConfig.database}

Examples:
  node scripts/manage-test-data.js seed-e2e
  node scripts/manage-test-data.js reset e2e
  node scripts/manage-test-data.js seed-factory teamCollaboration
  node scripts/manage-test-data.js export my-test-data.json

🔧 For E2E testing, use 'seed-e2e' or 'reset e2e' commands.
`);
  }
}

// Main execution
async function main() {
  const manager = new TestDataManager();
  
  try {
    // Validate environment
    if (environment === 'production') {
      console.error('❌ Test data management is not allowed in production environment');
      process.exit(1);
    }
    
    if (!command || command === 'help') {
      manager.showHelp();
      return;
    }
    
    await manager.connect();
    
    switch (command) {
      case 'seed-e2e':
        await manager.seedE2EData();
        break;
        
      case 'seed-demo':
        await manager.seedDemoData();
        break;
        
      case 'seed-factory':
        const scenario = args[1] || 'standard';
        await manager.seedFactoryData(scenario);
        break;
        
      case 'clean':
        await manager.cleanTestData();
        break;
        
      case 'reset':
        const seedType = args[1] || 'e2e';
        await manager.resetAndSeed(seedType);
        break;
        
      case 'migrate':
        await manager.runMigrations();
        break;
        
      case 'status':
        await manager.checkStatus();
        break;
        
      case 'export':
        const outputFile = args[1];
        await manager.exportTestData(outputFile);
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        manager.showHelp();
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  } finally {
    await manager.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = TestDataManager;