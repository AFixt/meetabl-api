'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('UserSettings', 'google_analytics_id', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('UserSettings', 'google_analytics_id', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
  }
};