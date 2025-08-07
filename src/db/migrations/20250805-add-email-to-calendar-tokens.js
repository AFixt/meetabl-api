'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('calendar_tokens', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'provider'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('calendar_tokens', 'email');
  }
};