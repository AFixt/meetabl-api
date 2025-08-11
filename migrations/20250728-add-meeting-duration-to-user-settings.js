/**
 * Migration to add meeting_duration column to UserSettings table
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('UserSettings', 'meeting_duration', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 60,
      validate: {
        min: 15,
        max: 240
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('UserSettings', 'meeting_duration');
  }
};