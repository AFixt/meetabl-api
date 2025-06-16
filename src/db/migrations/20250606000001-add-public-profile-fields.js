/**
 * Migration: Add public profile fields to user_settings table
 * 
 * Adds fields needed for public profile customization
 * 
 * @author meetabl Team
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_settings', 'public_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Public display name for booking page'
    });

    await queryInterface.addColumn('user_settings', 'public_bio', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Public bio/description for booking page'
    });

    await queryInterface.addColumn('user_settings', 'public_avatar_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'URL to public avatar image'
    });

    await queryInterface.addColumn('user_settings', 'booking_page_title', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Custom title for public booking page'
    });

    await queryInterface.addColumn('user_settings', 'booking_page_description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Custom description for public booking page'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('user_settings', 'public_name');
    await queryInterface.removeColumn('user_settings', 'public_bio');
    await queryInterface.removeColumn('user_settings', 'public_avatar_url');
    await queryInterface.removeColumn('user_settings', 'booking_page_title');
    await queryInterface.removeColumn('user_settings', 'booking_page_description');
  }
};