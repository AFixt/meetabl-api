'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add createdAt column
    await queryInterface.addColumn('calendar_tokens', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    // Add updatedAt column
    await queryInterface.addColumn('calendar_tokens', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('calendar_tokens', 'createdAt');
    await queryInterface.removeColumn('calendar_tokens', 'updatedAt');
  }
};