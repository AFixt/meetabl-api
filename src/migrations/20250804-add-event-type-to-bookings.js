'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add event_type_id to bookings table
    await queryInterface.addColumn('bookings', 'event_type_id', {
      type: Sequelize.STRING(36),
      allowNull: true,
      references: {
        model: 'event_types',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add event_type_id to booking_requests table
    await queryInterface.addColumn('booking_requests', 'event_type_id', {
      type: Sequelize.STRING(36),
      allowNull: true,
      references: {
        model: 'event_types',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('bookings', ['event_type_id']);
    await queryInterface.addIndex('booking_requests', ['event_type_id']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('bookings', ['event_type_id']);
    await queryInterface.removeIndex('booking_requests', ['event_type_id']);

    // Remove columns
    await queryInterface.removeColumn('bookings', 'event_type_id');
    await queryInterface.removeColumn('booking_requests', 'event_type_id');
  }
};