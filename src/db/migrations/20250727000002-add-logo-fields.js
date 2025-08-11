'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('UserSettings', 'logo_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'URL to user uploaded logo image'
    });

    await queryInterface.addColumn('UserSettings', 'logo_alt_text', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Alt text for accessibility when displaying logo'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('UserSettings', 'logo_url');
    await queryInterface.removeColumn('UserSettings', 'logo_alt_text');
  }
};