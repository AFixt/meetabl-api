/**
 * Migration to add reminder_time field to user_settings table
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_settings', 'reminder_time', {
      type: Sequelize.ENUM('none', '15_minutes', '30_minutes', '1_hour', '2_hours', '24_hours'),
      allowNull: false,
      defaultValue: '30_minutes'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('user_settings', 'reminder_time');
    // Note: ENUM types need to be dropped manually if they are no longer used
    // This migration doesn't handle dropping the ENUM type to avoid conflicts
  }
};