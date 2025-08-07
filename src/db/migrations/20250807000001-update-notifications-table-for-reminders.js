/**
 * Migration to update notifications table to support reminder notifications
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns
    await queryInterface.addColumn('notifications', 'channel', {
      type: Sequelize.ENUM('email', 'sms'),
      allowNull: false,
      defaultValue: 'email'
    });

    await queryInterface.addColumn('notifications', 'recipient', {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: ''
    });

    await queryInterface.addColumn('notifications', 'content', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('notifications', 'scheduled_for', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('notifications', 'error_details', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Update existing records to have recipient set to booking customer email
    await queryInterface.sequelize.query(`
      UPDATE notifications n 
      JOIN bookings b ON n.bookingId = b.id 
      SET n.recipient = b.customer_email 
      WHERE n.recipient = ''
    `);

    // Update type enum to include reminder types
    await queryInterface.changeColumn('notifications', 'type', {
      type: Sequelize.ENUM('booking_created', 'booking_updated', 'booking_cancelled', 'reminder', 'email', 'sms'),
      allowNull: false
    });

    // Rename error_message column if it exists with different name
    const tableDescription = await queryInterface.describeTable('notifications');
    if (tableDescription.errorMessage && !tableDescription.error_message) {
      await queryInterface.renameColumn('notifications', 'errorMessage', 'error_message');
    }

    // First, update legacy type values and set channel before changing ENUM
    await queryInterface.sequelize.query(`
      UPDATE notifications 
      SET channel = CASE 
        WHEN type = 'email' THEN 'email'
        WHEN type = 'sms' THEN 'sms'
        ELSE 'email'
      END
      WHERE channel IS NULL OR channel = ''
    `);

    await queryInterface.sequelize.query(`
      UPDATE notifications 
      SET type = CASE 
        WHEN type = 'email' THEN 'booking_created'
        WHEN type = 'sms' THEN 'booking_created'
        ELSE type 
      END
    `);

    // Now change the ENUM after data has been updated
    await queryInterface.changeColumn('notifications', 'type', {
      type: Sequelize.ENUM('booking_created', 'booking_updated', 'booking_cancelled', 'reminder'),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('notifications', 'channel');
    await queryInterface.removeColumn('notifications', 'recipient');
    await queryInterface.removeColumn('notifications', 'content');
    await queryInterface.removeColumn('notifications', 'scheduled_for');
    await queryInterface.removeColumn('notifications', 'error_details');
    
    // Revert type enum
    await queryInterface.changeColumn('notifications', 'type', {
      type: Sequelize.ENUM('email', 'sms'),
      allowNull: false
    });
  }
};