/**
 * Add requires_confirmation field to user_settings table
 * 
 * This migration adds a global user preference for requiring
 * manual confirmation for all bookings. This setting can be
 * inherited by event types or overridden at the event type level.
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('user_settings', 'requires_confirmation', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Global user preference for requiring manual confirmation for all bookings'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user_settings', 'requires_confirmation');
  }
};