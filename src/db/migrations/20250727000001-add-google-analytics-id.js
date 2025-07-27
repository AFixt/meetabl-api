'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('UserSettings', 'google_analytics_id', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Google Analytics tracking ID (G-XXXXXXXX, UA-XXXXXXX-X, or GT-XXXXXXXX format)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('UserSettings', 'google_analytics_id');
  }
};