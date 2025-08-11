#!/usr/bin/env node

/**
 * Script to delete all users and related records from the database
 * WARNING: This will permanently delete all user data!
 */

const { sequelize } = require('../src/models');

async function deleteAllUsers() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('Starting deletion of all users and related records...\n');
    
    // Delete in order of dependencies (most dependent first)
    const deletions = [
      { table: 'TeamMembers', name: 'Team Members' },
      { table: 'TeamInvitations', name: 'Team Invitations' },
      { table: 'Teams', name: 'Teams' },
      { table: 'PaymentMethods', name: 'Payment Methods' },
      { table: 'PaymentTransactions', name: 'Payment Transactions' },
      { table: 'Subscriptions', name: 'Subscriptions' },
      { table: 'UsageRecords', name: 'Usage Records' },
      { table: 'BillingHistory', name: 'Billing History' },
      { table: 'BookingRequests', name: 'Booking Requests' },
      { table: 'Bookings', name: 'Bookings' },
      { table: 'Notifications', name: 'Notifications' },
      { table: 'CalendarTokens', name: 'Calendar Tokens' },
      { table: 'AvailabilityRules', name: 'Availability Rules' },
      { table: 'UserSettings', name: 'User Settings' },
      { table: 'EventTypes', name: 'Event Types' },
      { table: 'AuditLogs', name: 'Audit Logs' },
      { table: 'JwtBlacklist', name: 'JWT Blacklist' },
      { table: 'Users', name: 'Users' }
    ];
    
    for (const { table, name } of deletions) {
      try {
        const [result] = await sequelize.query(
          `DELETE FROM \`${table}\``,
          { transaction }
        );
        console.log(`✓ Deleted all records from ${name} (${table})`);
      } catch (error) {
        if (error.original?.code === 'ER_NO_SUCH_TABLE') {
          console.log(`⚠ Table ${table} does not exist, skipping...`);
        } else {
          throw error;
        }
      }
    }
    
    // Reset auto-increment counters for all tables
    console.log('\nResetting auto-increment counters...');
    for (const { table } of deletions) {
      try {
        await sequelize.query(
          `ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`,
          { transaction }
        );
        console.log(`✓ Reset auto-increment for ${table}`);
      } catch (error) {
        if (error.original?.code === 'ER_NO_SUCH_TABLE') {
          // Skip if table doesn't exist
        } else {
          console.log(`⚠ Could not reset auto-increment for ${table}: ${error.message}`);
        }
      }
    }
    
    await transaction.commit();
    console.log('\n✅ Successfully deleted all users and related records!');
    
    // Show current record counts
    console.log('\nVerifying deletion (record counts):');
    const tables = ['Users', 'Bookings', 'CalendarTokens', 'AvailabilityRules', 'UserSettings'];
    for (const table of tables) {
      try {
        const [results] = await sequelize.query(`SELECT COUNT(*) as count FROM \`${table}\``);
        console.log(`  ${table}: ${results[0].count} records`);
      } catch (error) {
        // Skip if table doesn't exist
      }
    }
    
  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Error deleting users:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Check for --force flag to skip confirmation
const forceFlag = process.argv.includes('--force');

if (forceFlag) {
  console.log('⚠️  WARNING: Running with --force flag, skipping confirmation...\n');
  deleteAllUsers().then(() => {
    process.exit(0);
  }).catch(() => {
    process.exit(1);
  });
} else {
  // Prompt for confirmation
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('⚠️  WARNING: This will permanently delete ALL users and their related data!');
  console.log('This action cannot be undone.\n');

  rl.question('Are you sure you want to continue? Type "yes" to confirm: ', async (answer) => {
    if (answer.toLowerCase() === 'yes') {
      try {
        await deleteAllUsers();
      } catch (error) {
        process.exit(1);
      }
    } else {
      console.log('Operation cancelled.');
    }
    rl.close();
    process.exit(0);
  });
}