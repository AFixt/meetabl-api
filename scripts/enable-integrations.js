/**
 * Script to enable integrations for a user
 * Usage: node scripts/enable-integrations.js <email>
 */

const { User } = require('../src/models');
const logger = require('../src/config/logger');

async function enableIntegrations(email) {
  try {
    if (!email) {
      console.error('Please provide an email address');
      process.exit(1);
    }

    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    // Enable integrations for the user
    user.integrations_enabled = true;
    user.max_calendars = 5; // Allow multiple calendars for testing
    await user.save();

    console.log(`✅ Integrations enabled for user: ${email}`);
    console.log(`   - integrations_enabled: ${user.integrations_enabled}`);
    console.log(`   - max_calendars: ${user.max_calendars}`);
    console.log(`   - plan_type: ${user.plan_type}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error enabling integrations:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2] || 'karlgroves@gmail.com';
enableIntegrations(email);