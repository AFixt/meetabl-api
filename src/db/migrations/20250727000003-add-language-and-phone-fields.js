'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add language field
    await queryInterface.addColumn('Users', 'language', {
      type: Sequelize.STRING(10),
      allowNull: true,
      defaultValue: 'en',
      comment: 'User preferred language code'
    });

    // Add phone_number field
    await queryInterface.addColumn('Users', 'phone_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'User phone number'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'language');
    await queryInterface.removeColumn('Users', 'phone_number');
  }
};