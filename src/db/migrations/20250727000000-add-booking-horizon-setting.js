'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('UserSettings', 'booking_horizon', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30, // 1 month default
      comment: 'How many days ahead users can book (7=1 week, 14=2 weeks, 21=3 weeks, 30=1 month)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('UserSettings', 'booking_horizon');
  }
};