'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, check if plan_type column exists and has the right enum values
    const tableDescription = await queryInterface.describeTable('users');
    
    // Update plan_type ENUM if it exists but with wrong values
    if (tableDescription.plan_type) {
      // MySQL requires special handling for ENUM changes
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        MODIFY COLUMN plan_type ENUM('free', 'basic', 'professional') 
        NOT NULL DEFAULT 'free'
      `);
    } else {
      // Add plan_type if it doesn't exist
      await queryInterface.addColumn('users', 'plan_type', {
        type: Sequelize.ENUM('free', 'basic', 'professional'),
        allowNull: false,
        defaultValue: 'free'
      });
    }

    // Add stripe_price_id if it doesn't exist
    if (!tableDescription.stripe_price_id) {
      await queryInterface.addColumn('users', 'stripe_price_id', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }

    // Add billing_period if it doesn't exist
    if (!tableDescription.billing_period) {
      await queryInterface.addColumn('users', 'billing_period', {
        type: Sequelize.ENUM('monthly', 'annual'),
        allowNull: true
      });
    }

    // Add can_remove_branding if it doesn't exist
    if (!tableDescription.can_remove_branding) {
      await queryInterface.addColumn('users', 'can_remove_branding', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    // Add can_customize_avatar if it doesn't exist
    if (!tableDescription.can_customize_avatar) {
      await queryInterface.addColumn('users', 'can_customize_avatar', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    // Add can_customize_booking_page if it doesn't exist
    if (!tableDescription.can_customize_booking_page) {
      await queryInterface.addColumn('users', 'can_customize_booking_page', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    // Add can_use_meeting_polls if it doesn't exist
    if (!tableDescription.can_use_meeting_polls) {
      await queryInterface.addColumn('users', 'can_use_meeting_polls', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    // Update existing 'paid' users to 'basic' plan
    await queryInterface.sequelize.query(`
      UPDATE users 
      SET plan_type = 'basic',
          max_calendars = 5,
          max_event_types = 999,
          can_remove_branding = true,
          can_customize_avatar = true,
          can_customize_booking_page = true,
          can_use_meeting_polls = false
      WHERE subscription_plan = 'paid' 
         OR stripe_subscription_status = 'active'
    `);

    // Update free users to ensure proper limits
    await queryInterface.sequelize.query(`
      UPDATE users 
      SET plan_type = 'free',
          max_calendars = 1,
          max_event_types = 1,
          can_remove_branding = false,
          can_customize_avatar = false,
          can_customize_booking_page = false,
          can_use_meeting_polls = false
      WHERE (plan_type IS NULL OR plan_type = 'free')
        AND (subscription_plan IS NULL OR subscription_plan = 'free' OR subscription_plan = '')
        AND (stripe_subscription_status IS NULL OR stripe_subscription_status != 'active')
    `);

    // Create index on plan_type for better query performance
    await queryInterface.addIndex('users', ['plan_type']);
    
    // Create index on stripe_price_id for webhook lookups
    await queryInterface.addIndex('users', ['stripe_price_id']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('users', ['plan_type']);
    await queryInterface.removeIndex('users', ['stripe_price_id']);

    // Revert plan_type back to basic enum
    await queryInterface.sequelize.query(`
      UPDATE users SET plan_type = 'free' WHERE plan_type IN ('basic', 'professional')
    `);
    
    // Note: We're not removing the columns in the down migration
    // as that could cause data loss. The columns can stay with 
    // default values if we need to roll back.
  }
};