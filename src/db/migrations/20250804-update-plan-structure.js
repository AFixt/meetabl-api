'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Update plan_type enum to include new plan types
    await queryInterface.changeColumn('users', 'plan_type', {
      type: Sequelize.ENUM('free', 'basic', 'professional'),
      allowNull: false,
      defaultValue: 'free'
    });

    // Add new columns for plan features
    await queryInterface.addColumn('users', 'can_remove_branding', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('users', 'can_customize_avatar', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('users', 'can_customize_booking_page', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('users', 'can_use_meeting_polls', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Update existing 'paid' users to 'basic' plan
    await queryInterface.sequelize.query(
      "UPDATE users SET plan_type = 'basic' WHERE plan_type = 'paid'"
    );

    // Update limits based on plan type
    await queryInterface.sequelize.query(`
      UPDATE users 
      SET 
        max_event_types = CASE 
          WHEN plan_type = 'free' THEN 1
          ELSE 999 -- unlimited for basic and professional
        END,
        max_calendars = CASE 
          WHEN plan_type = 'free' THEN 1
          WHEN plan_type = 'basic' THEN 5
          ELSE 999 -- unlimited for professional
        END,
        can_remove_branding = CASE 
          WHEN plan_type IN ('basic', 'professional') THEN true
          ELSE false
        END,
        can_customize_avatar = CASE 
          WHEN plan_type IN ('basic', 'professional') THEN true
          ELSE false
        END,
        can_customize_booking_page = CASE 
          WHEN plan_type IN ('basic', 'professional') THEN true
          ELSE false
        END,
        can_use_meeting_polls = CASE 
          WHEN plan_type = 'professional' THEN true
          ELSE false
        END,
        integrations_enabled = true -- All plans can use integrations
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove new columns
    await queryInterface.removeColumn('users', 'can_remove_branding');
    await queryInterface.removeColumn('users', 'can_customize_avatar');
    await queryInterface.removeColumn('users', 'can_customize_booking_page');
    await queryInterface.removeColumn('users', 'can_use_meeting_polls');

    // Revert plan_type enum
    await queryInterface.changeColumn('users', 'plan_type', {
      type: Sequelize.ENUM('free', 'paid'),
      allowNull: false,
      defaultValue: 'free'
    });
  }
};