'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove plan feature columns that should be computed from the plan
    await queryInterface.removeColumn('users', 'can_remove_branding');
    await queryInterface.removeColumn('users', 'can_customize_avatar');
    await queryInterface.removeColumn('users', 'can_customize_booking_page');
    await queryInterface.removeColumn('users', 'can_use_meeting_polls');
    
    // Also remove max columns as these should come from the plan
    await queryInterface.removeColumn('users', 'max_event_types');
    await queryInterface.removeColumn('users', 'max_calendars');
  },

  async down(queryInterface, Sequelize) {
    // Re-add columns if we need to rollback
    await queryInterface.addColumn('users', 'max_event_types', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    });
    
    await queryInterface.addColumn('users', 'max_calendars', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    });
    
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
  }
};