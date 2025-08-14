/**
 * Script to update user plan
 * Usage: node scripts/update-plan.js <email> <plan>
 */

const { User } = require('../src/models');
const logger = require('../src/config/logger');

async function updatePlan(email, planType) {
  try {
    if (!email || !planType) {
      console.error('Usage: node scripts/update-plan.js <email> <plan>');
      console.error('Plans: free, basic, professional');
      process.exit(1);
    }

    const validPlans = ['free', 'basic', 'professional'];
    if (!validPlans.includes(planType)) {
      console.error(`Invalid plan type. Must be one of: ${validPlans.join(', ')}`);
      process.exit(1);
    }

    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    // Update plan type (limits are computed virtually)
    user.plan_type = planType;
    await user.save();

    console.log(`✅ Plan updated for user: ${email}`);
    console.log(`   - plan_type: ${user.plan_type}`);
    console.log(`   - max_event_types: ${user.max_event_types}`);
    console.log(`   - max_calendars: ${user.max_calendars}`);
    console.log(`   - can_remove_branding: ${user.can_remove_branding}`);
    console.log(`   - can_customize_avatar: ${user.can_customize_avatar}`);
    console.log(`   - can_customize_booking_page: ${user.can_customize_booking_page}`);
    console.log(`   - can_use_meeting_polls: ${user.can_use_meeting_polls}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating plan:', error);
    process.exit(1);
  }
}

// Get arguments from command line
const email = process.argv[2];
const planType = process.argv[3];
updatePlan(email, planType);