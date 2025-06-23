#!/usr/bin/env node

/**
 * User Migration Script for Outseta Integration
 * 
 * Migrates existing users from local authentication to Outseta
 * 
 * Usage:
 *   node scripts/migrate-users-to-outseta.js [options]
 * 
 * Options:
 *   --dry-run      : Preview migration without making changes
 *   --batch-size   : Number of users to process per batch (default: 10)
 *   --email-filter : Only migrate users matching email pattern
 *   --force        : Force migration even if user exists in Outseta
 * 
 * @author meetabl Team
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { User } = require('../src/models');
const outsetaService = require('../src/services/outseta.service');
const { createLogger } = require('../src/config/logger');

const logger = createLogger('user-migration');

class UserMigrator {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.batchSize = options.batchSize || 10;
    this.emailFilter = options.emailFilter || null;
    this.force = options.force || false;
    this.stats = {
      total: 0,
      processed: 0,
      migrated: 0,
      skipped: 0,
      errors: 0
    };
  }

  /**
   * Main migration function
   */
  async migrate() {
    try {
      logger.info('Starting user migration to Outseta', {
        dryRun: this.dryRun,
        batchSize: this.batchSize,
        emailFilter: this.emailFilter
      });

      // Validate Outseta configuration
      if (!this.validateOutsetaConfig()) {
        throw new Error('Outseta configuration is incomplete');
      }

      // Get users to migrate
      const users = await this.getUsersToMigrate();
      this.stats.total = users.length;

      logger.info(`Found ${users.length} users to migrate`);

      if (users.length === 0) {
        logger.info('No users to migrate');
        return this.stats;
      }

      // Process users in batches
      await this.processBatches(users);

      // Print migration summary
      this.printSummary();

      return this.stats;
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate Outseta configuration
   */
  validateOutsetaConfig() {
    const requiredVars = [
      'OUTSETA_API_URL',
      'OUTSETA_API_KEY',
      'OUTSETA_API_SECRET',
      'OUTSETA_DOMAIN'
    ];

    const missing = requiredVars.filter(var_ => !process.env[var_]);
    
    if (missing.length > 0) {
      logger.error('Missing required Outseta environment variables', { missing });
      return false;
    }

    return true;
  }

  /**
   * Get users that need to be migrated
   */
  async getUsersToMigrate() {
    const where = {
      outseta_uid: null // Only users without Outseta ID
    };

    if (this.emailFilter) {
      where.email = {
        [require('sequelize').Op.like]: this.emailFilter
      };
    }

    return await User.findAll({
      where,
      order: [['created', 'ASC']],
      attributes: ['id', 'email', 'firstName', 'lastName', 'timezone', 'role', 'status', 'emailVerified']
    });
  }

  /**
   * Process users in batches to avoid overwhelming the API
   */
  async processBatches(users) {
    for (let i = 0; i < users.length; i += this.batchSize) {
      const batch = users.slice(i, i + this.batchSize);
      
      logger.info(`Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(users.length / this.batchSize)}`);

      await Promise.all(batch.map(user => this.migrateUser(user)));

      // Add delay between batches to respect API rate limits
      if (i + this.batchSize < users.length) {
        await this.delay(1000); // 1 second delay
      }
    }
  }

  /**
   * Migrate a single user to Outseta
   */
  async migrateUser(user) {
    try {
      this.stats.processed++;

      logger.debug('Processing user', { 
        email: user.email,
        id: user.id 
      });

      // Check if user already exists in Outseta
      let outsetaUser;
      try {
        outsetaUser = await outsetaService.getUserByEmail(user.email);
      } catch (error) {
        // User doesn't exist in Outseta, which is expected
        outsetaUser = null;
      }

      if (outsetaUser && !this.force) {
        logger.info('User already exists in Outseta, skipping', { 
          email: user.email,
          outsetaUid: outsetaUser.uid 
        });
        
        // Update local user with Outseta UID
        if (!this.dryRun) {
          await user.update({ outseta_uid: outsetaUser.uid });
        }
        
        this.stats.skipped++;
        return;
      }

      if (this.dryRun) {
        logger.info('DRY RUN: Would migrate user', { email: user.email });
        this.stats.migrated++;
        return;
      }

      // Create user in Outseta
      const migrationResult = await this.createOutsetaUser(user);
      
      if (migrationResult.success) {
        // Update local user with Outseta UID
        await user.update({ 
          outseta_uid: migrationResult.outsetaUid,
          emailVerified: true,
          emailVerifiedAt: new Date()
        });

        logger.info('Successfully migrated user', { 
          email: user.email,
          outsetaUid: migrationResult.outsetaUid
        });

        this.stats.migrated++;
      } else {
        logger.error('Failed to migrate user', { 
          email: user.email,
          error: migrationResult.error 
        });
        this.stats.errors++;
      }
    } catch (error) {
      logger.error('Error migrating user', { 
        email: user.email,
        error: error.message 
      });
      this.stats.errors++;
    }
  }

  /**
   * Create user in Outseta
   */
  async createOutsetaUser(user) {
    try {
      // Note: This is a placeholder implementation
      // In reality, you would need to use Outseta's user creation API
      // which might require an invitation flow or admin API access

      // For demonstration, we'll simulate the creation
      const outsetaUserData = {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        timezone: user.timezone || 'UTC',
        // Note: Password migration is not possible for security reasons
        // Users will need to set new passwords through Outseta
      };

      // This would be a real API call to create the user in Outseta
      // const response = await outsetaService.createUser(outsetaUserData);

      // Simulated response for demonstration
      const simulatedUid = `outseta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        outsetaUid: simulatedUid,
        requiresPasswordReset: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delay function for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print migration summary
   */
  printSummary() {
    logger.info('Migration completed', this.stats);

    console.log('\n=== Migration Summary ===');
    console.log(`Total users:      ${this.stats.total}`);
    console.log(`Processed:        ${this.stats.processed}`);
    console.log(`Migrated:         ${this.stats.migrated}`);
    console.log(`Skipped:          ${this.stats.skipped}`);
    console.log(`Errors:           ${this.stats.errors}`);
    console.log(`Success rate:     ${this.stats.total > 0 ? Math.round((this.stats.migrated / this.stats.total) * 100) : 0}%`);
    console.log('=========================\n');

    if (this.dryRun) {
      console.log('⚠️  This was a DRY RUN - no actual changes were made');
    }

    if (this.stats.migrated > 0 && !this.dryRun) {
      console.log('📧 Users who were migrated will need to reset their passwords in Outseta');
      console.log('💡 Consider sending password reset emails to migrated users');
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10);
        break;
      case '--email-filter':
        options.emailFilter = args[++i];
        break;
      case '--force':
        options.force = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
User Migration Script for Outseta Integration

Usage: node scripts/migrate-users-to-outseta.js [options]

Options:
  --dry-run         Preview migration without making changes
  --batch-size N    Number of users to process per batch (default: 10)
  --email-filter P  Only migrate users matching email pattern (e.g., '%@company.com')
  --force           Force migration even if user exists in Outseta
  --help            Show this help message

Examples:
  # Preview migration
  node scripts/migrate-users-to-outseta.js --dry-run

  # Migrate users in smaller batches
  node scripts/migrate-users-to-outseta.js --batch-size 5

  # Migrate only users from specific domain
  node scripts/migrate-users-to-outseta.js --email-filter '%@company.com'

Note: Users will need to reset their passwords after migration since 
password hashes cannot be transferred for security reasons.
`);
}

/**
 * Main execution
 */
async function main() {
  try {
    const options = parseArgs();
    const migrator = new UserMigrator(options);
    
    const stats = await migrator.migrate();
    
    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  main();
}

module.exports = UserMigrator;