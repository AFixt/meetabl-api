#!/usr/bin/env node

/**
 * Database Reset Script
 * 
 * This script resets the database for local or test installations.
 * It will:
 * 1. Drop all tables
 * 2. Run migrations to recreate the schema
 * 3. Optionally seed the database with demo data
 * 
 * CAUTION: This will DELETE ALL DATA in the database!
 * Only use this in development or test environments.
 * 
 * Usage:
 *   node scripts/reset-database.js [options]
 * 
 * Options:
 *   --force           Skip confirmation prompt
 *   --seed            Seed database with demo data after reset
 *   --env=<env>       Environment to use (development, test) - defaults to NODE_ENV or development
 *   --help            Show this help message
 * 
 * Examples:
 *   node scripts/reset-database.js
 *   node scripts/reset-database.js --force --seed
 *   node scripts/reset-database.js --env=test --force
 */

const readline = require('readline');
const { sequelize } = require('../src/config/database');
const logger = require('../src/config/logger');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  force: args.includes('--force'),
  seed: args.includes('--seed'),
  help: args.includes('--help'),
  env: process.env.NODE_ENV || 'development'
};

// Parse --env=<value> argument
const envArg = args.find(arg => arg.startsWith('--env='));
if (envArg) {
  options.env = envArg.split('=')[1];
}

// Set NODE_ENV
process.env.NODE_ENV = options.env;

// Show help if requested
if (options.help) {
  console.log(`
Database Reset Script

This script resets the database for local or test installations.

Usage:
  node scripts/reset-database.js [options]

Options:
  --force           Skip confirmation prompt
  --seed            Seed database with demo data after reset
  --env=<env>       Environment to use (development, test) - defaults to NODE_ENV or development
  --help            Show this help message

Examples:
  node scripts/reset-database.js
  node scripts/reset-database.js --force --seed
  node scripts/reset-database.js --env=test --force

CAUTION: This will DELETE ALL DATA in the database!
Only use this in development or test environments.
  `);
  process.exit(0);
}

// Safety check - prevent running in production
if (options.env === 'production') {
  console.error('\n❌ ERROR: Cannot reset production database!');
  console.error('This script is only for development and test environments.\n');
  process.exit(1);
}

// Function to prompt for confirmation
function promptConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Function to get table count and record count
async function getDatabaseStats() {
  try {
    const [tables] = await sequelize.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    
    let recordCount = 0;
    const [tableList] = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    
    for (const table of tableList) {
      try {
        const tableName = table.table_name || table.TABLE_NAME;
        if (tableName) {
          const [[{ count }]] = await sequelize.query(
            `SELECT COUNT(*) as count FROM \`${tableName}\``
          );
          recordCount += count;
        }
      } catch (err) {
        // Ignore errors for system tables or views
      }
    }
    
    return {
      tableCount: tables[0].count,
      recordCount
    };
  } catch (error) {
    return {
      tableCount: 0,
      recordCount: 0
    };
  }
}

// Function to drop all tables
async function dropAllTables() {
  try {
    console.log('📦 Dropping all tables...');
    
    // Disable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Get all table names
    const [tables] = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    
    // Drop each table
    for (const table of tables) {
      const tableName = table.table_name || table.TABLE_NAME;
      if (tableName) {
        console.log(`  - Dropping table: ${tableName}`);
        await sequelize.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      }
    }
    
    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('✅ All tables dropped successfully\n');
  } catch (error) {
    console.error('❌ Error dropping tables:', error.message);
    throw error;
  }
}

// Function to run migrations
async function runMigrations() {
  try {
    console.log('🔄 Running migrations...');
    
    // Map environment names to npm script suffixes
    const envMap = {
      'development': 'dev',
      'test': 'test',
      'production': 'prod'
    };
    
    const envSuffix = envMap[options.env] || options.env;
    const migrationCommand = `npm run db:migrate:${envSuffix}`;
    console.log(`  - Executing: ${migrationCommand}`);
    
    const { stdout, stderr } = await execPromise(migrationCommand);
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr && !stderr.includes('warning')) {
      console.error('Migration warnings:', stderr);
    }
    
    console.log('✅ Migrations completed successfully\n');
  } catch (error) {
    console.error('❌ Error running migrations:', error.message);
    if (error.stdout) console.error(error.stdout);
    if (error.stderr) console.error(error.stderr);
    throw error;
  }
}

// Function to seed database
async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...');
    
    const seedCommand = 'npm run db:seed';
    console.log(`  - Executing: ${seedCommand}`);
    
    const { stdout, stderr } = await execPromise(seedCommand);
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr && !stderr.includes('warning')) {
      console.error('Seed warnings:', stderr);
    }
    
    console.log('✅ Database seeded successfully\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    if (error.stdout) console.error(error.stdout);
    if (error.stderr) console.error(error.stderr);
    // Don't throw here - seeding is optional
  }
}

// Main function
async function resetDatabase() {
  try {
    console.log('\n=================================');
    console.log('    DATABASE RESET SCRIPT');
    console.log('=================================\n');
    
    console.log(`Environment: ${options.env}`);
    console.log(`Database: ${sequelize.config.database}`);
    console.log(`Host: ${sequelize.config.host}`);
    console.log(`Seed after reset: ${options.seed ? 'Yes' : 'No'}\n`);
    
    // Test database connection
    console.log('🔌 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Get current database stats
    const stats = await getDatabaseStats();
    console.log(`📊 Current database statistics:`);
    console.log(`  - Tables: ${stats.tableCount}`);
    console.log(`  - Total records: ${stats.recordCount}\n`);
    
    // Confirm action if not forced
    if (!options.force) {
      console.log('⚠️  WARNING: This will DELETE ALL DATA in the database!');
      console.log('⚠️  Database:', sequelize.config.database);
      
      const confirmed = await promptConfirmation('\nAre you sure you want to continue? (yes/no): ');
      
      if (!confirmed) {
        console.log('\n❌ Database reset cancelled by user\n');
        process.exit(0);
      }
    }
    
    console.log('\n🚀 Starting database reset...\n');
    
    // Step 1: Drop all tables
    await dropAllTables();
    
    // Step 2: Run migrations
    await runMigrations();
    
    // Step 3: Seed database (if requested)
    if (options.seed) {
      await seedDatabase();
    }
    
    // Get new database stats
    const newStats = await getDatabaseStats();
    console.log(`📊 New database statistics:`);
    console.log(`  - Tables: ${newStats.tableCount}`);
    console.log(`  - Total records: ${newStats.recordCount}\n`);
    
    console.log('=================================');
    console.log('✅ DATABASE RESET COMPLETE!');
    console.log('=================================\n');
    
    // Close database connection
    await sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Database reset failed:', error.message);
    logger.error('Database reset error:', error);
    
    // Close database connection
    try {
      await sequelize.close();
    } catch (closeError) {
      // Ignore close errors
    }
    
    process.exit(1);
  }
}

// Run the reset
resetDatabase();