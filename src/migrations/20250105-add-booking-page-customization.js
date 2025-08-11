'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('user_settings');
    
    // Add primary color if it doesn't exist
    if (!tableDescription.booking_page_primary_color) {
      await queryInterface.addColumn('user_settings', 'booking_page_primary_color', {
        type: Sequelize.STRING(7),
        allowNull: true,
        defaultValue: '#003b49'
      });
    }

    // Add secondary color if it doesn't exist
    if (!tableDescription.booking_page_secondary_color) {
      await queryInterface.addColumn('user_settings', 'booking_page_secondary_color', {
        type: Sequelize.STRING(7),
        allowNull: true,
        defaultValue: '#ff6b6b'
      });
    }

    // Add background color if it doesn't exist
    if (!tableDescription.booking_page_background_color) {
      await queryInterface.addColumn('user_settings', 'booking_page_background_color', {
        type: Sequelize.STRING(7),
        allowNull: true,
        defaultValue: '#ffffff'
      });
    }

    // Add text color if it doesn't exist
    if (!tableDescription.booking_page_text_color) {
      await queryInterface.addColumn('user_settings', 'booking_page_text_color', {
        type: Sequelize.STRING(7),
        allowNull: true,
        defaultValue: '#333333'
      });
    }

    // Add font size if it doesn't exist
    if (!tableDescription.booking_page_font_size) {
      await queryInterface.addColumn('user_settings', 'booking_page_font_size', {
        type: Sequelize.ENUM('small', 'medium', 'large'),
        allowNull: true,
        defaultValue: 'medium'
      });
    }

    // Add font family if it doesn't exist
    if (!tableDescription.booking_page_font_family) {
      await queryInterface.addColumn('user_settings', 'booking_page_font_family', {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'Inter, sans-serif'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns in reverse order
    await queryInterface.removeColumn('user_settings', 'booking_page_font_family');
    await queryInterface.removeColumn('user_settings', 'booking_page_font_size');
    await queryInterface.removeColumn('user_settings', 'booking_page_text_color');
    await queryInterface.removeColumn('user_settings', 'booking_page_background_color');
    await queryInterface.removeColumn('user_settings', 'booking_page_secondary_color');
    await queryInterface.removeColumn('user_settings', 'booking_page_primary_color');
  }
};