#!/usr/bin/env node

/**
 * Outseta Migration Verification Script
 * 
 * Verifies the integrity of user migration to Outseta
 * 
 * Usage:
 *   node scripts/verify-outseta-migration.js [options]
 * 
 * Options:
 *   --detailed     : Show detailed verification results
 *   --fix-issues   : Attempt to fix found issues
 *   --email        : Verify specific email address
 * 
 * @author meetabl Team
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { User } = require('../src/models');
const outsetaService = require('../src/services/outseta.service');
const { createLogger } = require('../src/config/logger');

const logger = createLogger('migration-verification');

class MigrationVerifier {
  constructor(options = {}) {
    this.detailed = options.detailed || false;
    this.fixIssues = options.fixIssues || false;
    this.emailFilter = options.email || null;
    this.issues = [];
    this.stats = {
      totalUsers: 0,
      migratedUsers: 0,
      verifiedUsers: 0,
      issuesFound: 0,
      issuesFixed: 0
    };
  }

  /**
   * Run complete migration verification
   */
  async verify() {
    try {
      logger.info('Starting migration verification', {
        detailed: this.detailed,
        fixIssues: this.fixIssues,
        emailFilter: this.emailFilter
      });

      // Get users to verify
      const users = await this.getUsersToVerify();
      this.stats.totalUsers = users.length;

      logger.info(`Verifying ${users.length} users`);

      // Verify each user
      for (const user of users) {
        await this.verifyUser(user);
      }

      // Print verification summary
      this.printSummary();

      return {
        stats: this.stats,
        issues: this.issues
      };
    } catch (error) {
      logger.error('Verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get users to verify
   */
  async getUsersToVerify() {
    const where = {};

    if (this.emailFilter) {
      where.email = this.emailFilter;
    }

    return await User.findAll({
      where,
      order: [['created', 'ASC']],
      attributes: [
        'id', 'email', 'firstName', 'lastName', 
        'outseta_uid', 'subscription_plan', 'subscription_status',
        'emailVerified', 'created'
      ]
    });
  }

  /**
   * Verify a single user
   */
  async verifyUser(user) {
    try {
      this.stats.totalUsers++;

      if (user.outseta_uid) {
        this.stats.migratedUsers++;
        await this.verifyMigratedUser(user);
      } else {
        this.addIssue({
          type: 'NOT_MIGRATED',
          severity: 'warning',
          user: user.email,
          message: 'User has not been migrated to Outseta',
          data: { userId: user.id }
        });
      }
    } catch (error) {
      this.addIssue({
        type: 'VERIFICATION_ERROR',
        severity: 'error',
        user: user.email,
        message: `Verification failed: ${error.message}`,
        data: { userId: user.id, error: error.message }
      });
    }
  }

  /**
   * Verify a migrated user
   */
  async verifyMigratedUser(user) {
    const checks = [
      this.checkOutsetaUserExists.bind(this),
      this.checkEmailMatches.bind(this),
      this.checkSubscriptionSync.bind(this),
      this.checkProfileDataSync.bind(this)
    ];

    let verified = true;

    for (const check of checks) {
      try {
        const result = await check(user);
        if (!result.passed) {
          verified = false;
        }
      } catch (error) {
        verified = false;
        this.addIssue({
          type: 'CHECK_FAILED',
          severity: 'error',
          user: user.email,
          message: `Verification check failed: ${error.message}`,
          data: { userId: user.id, check: check.name }
        });
      }
    }

    if (verified) {
      this.stats.verifiedUsers++;
    }
  }

  /**
   * Check if user exists in Outseta
   */
  async checkOutsetaUserExists(user) {
    try {
      const outsetaUser = await outsetaService.getUser(user.outseta_uid);
      
      if (!outsetaUser) {
        this.addIssue({
          type: 'USER_NOT_IN_OUTSETA',
          severity: 'error',
          user: user.email,
          message: 'User not found in Outseta despite having outseta_uid',
          data: { userId: user.id, outsetaUid: user.outseta_uid },
          fixable: false
        });
        return { passed: false };
      }

      return { passed: true, data: outsetaUser };
    } catch (error) {
      this.addIssue({
        type: 'OUTSETA_API_ERROR',
        severity: 'error',
        user: user.email,
        message: `Failed to fetch user from Outseta: ${error.message}`,
        data: { userId: user.id, outsetaUid: user.outseta_uid },
        fixable: false
      });
      return { passed: false };
    }
  }

  /**
   * Check if email addresses match
   */
  async checkEmailMatches(user) {
    try {
      const outsetaUser = await outsetaService.getUser(user.outseta_uid);
      
      if (outsetaUser.email !== user.email) {
        this.addIssue({
          type: 'EMAIL_MISMATCH',
          severity: 'warning',
          user: user.email,
          message: 'Email address mismatch between local and Outseta',
          data: { 
            userId: user.id,
            localEmail: user.email,
            outsetaEmail: outsetaUser.email
          },
          fixable: true
        });
        return { passed: false };
      }

      return { passed: true };
    } catch (error) {
      return { passed: false };
    }
  }

  /**
   * Check if subscription data is synchronized
   */
  async checkSubscriptionSync(user) {
    try {
      const subscription = await outsetaService.getUserSubscription(user.outseta_uid);
      
      if (subscription && user.subscription_plan !== subscription.plan?.name) {
        this.addIssue({
          type: 'SUBSCRIPTION_MISMATCH',
          severity: 'warning',
          user: user.email,
          message: 'Subscription plan mismatch between local and Outseta',
          data: { 
            userId: user.id,
            localPlan: user.subscription_plan,
            outsetaPlan: subscription.plan?.name
          },
          fixable: true
        });
        return { passed: false };
      }

      return { passed: true };
    } catch (error) {
      // Subscription might not exist, which is okay
      return { passed: true };
    }
  }

  /**
   * Check if profile data is synchronized
   */
  async checkProfileDataSync(user) {
    try {
      const outsetaUser = await outsetaService.getUser(user.outseta_uid);
      
      const mismatches = [];
      
      if (outsetaUser.firstName !== user.firstName) {
        mismatches.push(`firstName: '${user.firstName}' vs '${outsetaUser.firstName}'`);
      }
      
      if (outsetaUser.lastName !== user.lastName) {
        mismatches.push(`lastName: '${user.lastName}' vs '${outsetaUser.lastName}'`);
      }

      if (mismatches.length > 0) {
        this.addIssue({
          type: 'PROFILE_MISMATCH',
          severity: 'info',
          user: user.email,
          message: `Profile data mismatch: ${mismatches.join(', ')}`,
          data: { 
            userId: user.id,
            mismatches
          },
          fixable: true
        });
        return { passed: false };
      }

      return { passed: true };
    } catch (error) {
      return { passed: false };
    }
  }

  /**
   * Add an issue to the issues list
   */
  addIssue(issue) {
    this.issues.push(issue);
    this.stats.issuesFound++;

    if (this.detailed) {
      logger.info('Issue found', issue);
    }

    // Attempt to fix the issue if requested
    if (this.fixIssues && issue.fixable) {
      this.attemptFix(issue);
    }
  }

  /**
   * Attempt to fix an issue
   */
  async attemptFix(issue) {
    try {
      switch (issue.type) {
        case 'EMAIL_MISMATCH':
          await this.fixEmailMismatch(issue);
          break;
        case 'SUBSCRIPTION_MISMATCH':
          await this.fixSubscriptionMismatch(issue);
          break;
        case 'PROFILE_MISMATCH':
          await this.fixProfileMismatch(issue);
          break;
        default:
          logger.warn('No fix available for issue type', { type: issue.type });
      }
    } catch (error) {
      logger.error('Failed to fix issue', { 
        issue: issue.type,
        error: error.message 
      });
    }
  }

  /**
   * Fix email mismatch
   */
  async fixEmailMismatch(issue) {
    // Update local email to match Outseta
    const user = await User.findByPk(issue.data.userId);
    await user.update({ email: issue.data.outsetaEmail });
    
    logger.info('Fixed email mismatch', {
      userId: issue.data.userId,
      newEmail: issue.data.outsetaEmail
    });
    
    this.stats.issuesFixed++;
  }

  /**
   * Fix subscription mismatch
   */
  async fixSubscriptionMismatch(issue) {
    // Update local subscription to match Outseta
    const user = await User.findByPk(issue.data.userId);
    await user.update({ subscription_plan: issue.data.outsetaPlan });
    
    logger.info('Fixed subscription mismatch', {
      userId: issue.data.userId,
      newPlan: issue.data.outsetaPlan
    });
    
    this.stats.issuesFixed++;
  }

  /**
   * Fix profile mismatch
   */
  async fixProfileMismatch(issue) {
    // For profile mismatches, we typically want to keep the local data
    // as the source of truth, but this could be configurable
    logger.info('Profile mismatch noted but not auto-fixed', {
      userId: issue.data.userId,
      mismatches: issue.data.mismatches
    });
  }

  /**
   * Print verification summary
   */
  printSummary() {
    logger.info('Verification completed', this.stats);

    console.log('\n=== Migration Verification Summary ===');
    console.log(`Total users:          ${this.stats.totalUsers}`);
    console.log(`Migrated users:       ${this.stats.migratedUsers}`);
    console.log(`Verified users:       ${this.stats.verifiedUsers}`);
    console.log(`Issues found:         ${this.stats.issuesFound}`);
    console.log(`Issues fixed:         ${this.stats.issuesFixed}`);
    
    if (this.stats.migratedUsers > 0) {
      const verificationRate = Math.round((this.stats.verifiedUsers / this.stats.migratedUsers) * 100);
      console.log(`Verification rate:    ${verificationRate}%`);
    }
    
    console.log('=======================================\n');

    // Group issues by type
    const issuesByType = this.issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {});

    if (Object.keys(issuesByType).length > 0) {
      console.log('Issues by type:');
      Object.entries(issuesByType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
      console.log('');
    }

    if (this.fixIssues && this.stats.issuesFixed > 0) {
      console.log(`✅ Fixed ${this.stats.issuesFixed} issues automatically`);
    }

    if (this.stats.issuesFound > this.stats.issuesFixed) {
      console.log(`⚠️  ${this.stats.issuesFound - this.stats.issuesFixed} issues require manual attention`);
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
      case '--detailed':
        options.detailed = true;
        break;
      case '--fix-issues':
        options.fixIssues = true;
        break;
      case '--email':
        options.email = args[++i];
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
Migration Verification Script

Usage: node scripts/verify-outseta-migration.js [options]

Options:
  --detailed       Show detailed verification results
  --fix-issues     Attempt to fix found issues automatically
  --email EMAIL    Verify specific email address only
  --help           Show this help message

Examples:
  # Basic verification
  node scripts/verify-outseta-migration.js

  # Detailed verification with issue fixing
  node scripts/verify-outseta-migration.js --detailed --fix-issues

  # Verify specific user
  node scripts/verify-outseta-migration.js --email user@example.com
`);
}

/**
 * Main execution
 */
async function main() {
  try {
    const options = parseArgs();
    const verifier = new MigrationVerifier(options);
    
    const result = await verifier.verify();
    
    process.exit(result.stats.issuesFound > 0 ? 1 : 0);
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  }
}

// Run verification if script is executed directly
if (require.main === module) {
  main();
}

module.exports = MigrationVerifier;