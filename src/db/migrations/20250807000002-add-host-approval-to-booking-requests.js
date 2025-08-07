'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new status to enum
    await queryInterface.sequelize.query(
      "ALTER TYPE enum_booking_requests_status ADD VALUE 'pending_host_approval'"
    );

    // Add new columns for host approval workflow
    await queryInterface.addColumn('booking_requests', 'host_approval_token', {
      type: Sequelize.STRING(255),
      allowNull: true,
      unique: true
    });

    await queryInterface.addColumn('booking_requests', 'host_approval_token_expires_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('booking_requests', 'host_decision_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add index for host approval token
    await queryInterface.addIndex('booking_requests', ['host_approval_token']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns
    await queryInterface.removeColumn('booking_requests', 'host_decision_at');
    await queryInterface.removeColumn('booking_requests', 'host_approval_token_expires_at');
    await queryInterface.removeColumn('booking_requests', 'host_approval_token');

    // Note: Removing enum values is more complex and risky in production
    // We'll leave the enum value in place for safety
  }
};