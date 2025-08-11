'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Fix any mismatches between plan_type and subscription_plan
    // Plan_type should be the source of truth
    
    // First, update cases where subscription_plan is set but plan_type is not
    await queryInterface.sequelize.query(`
      UPDATE users
      SET plan_type = LOWER(subscription_plan)
      WHERE subscription_plan IS NOT NULL 
      AND (plan_type IS NULL OR plan_type = 'free')
      AND subscription_plan IN ('basic', 'Basic', 'professional', 'Professional')
    `);
    
    // Then ensure subscription_plan matches plan_type for all users
    await queryInterface.sequelize.query(`
      UPDATE users
      SET subscription_plan = plan_type
      WHERE plan_type IS NOT NULL
    `);
    
    // Apply correct limits for basic plan users
    await queryInterface.sequelize.query(`
      UPDATE users
      SET 
        max_event_types = 999,
        max_calendars = 5,
        can_remove_branding = true,
        can_customize_avatar = true,
        can_customize_booking_page = true,
        can_use_meeting_polls = false
      WHERE plan_type = 'basic'
    `);
    
    // Apply correct limits for free plan users
    await queryInterface.sequelize.query(`
      UPDATE users
      SET 
        max_event_types = 1,
        max_calendars = 1,
        can_remove_branding = false,
        can_customize_avatar = false,
        can_customize_booking_page = false,
        can_use_meeting_polls = false
      WHERE plan_type = 'free'
    `);
    
    // Apply correct limits for professional plan users
    await queryInterface.sequelize.query(`
      UPDATE users
      SET 
        max_event_types = 999,
        max_calendars = 999,
        can_remove_branding = true,
        can_customize_avatar = true,
        can_customize_booking_page = true,
        can_use_meeting_polls = true
      WHERE plan_type = 'professional'
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // No rollback needed as this is a data consistency fix
  }
};