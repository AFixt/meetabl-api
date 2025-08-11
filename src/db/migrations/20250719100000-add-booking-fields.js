/**
 * Add missing fields to bookings table
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if bookings table exists
      const tableNames = await queryInterface.showAllTables();
      
      if (tableNames.includes('bookings')) {
        const bookingsColumns = await queryInterface.describeTable('bookings');
        
        // Add customer_phone field if it doesn't exist
        if (!bookingsColumns.customer_phone) {
          await queryInterface.addColumn('bookings', 'customer_phone', {
            type: Sequelize.STRING(25),
            allowNull: true
          }, { transaction });
        }
        
        // Add notes field if it doesn't exist
        if (!bookingsColumns.notes) {
          await queryInterface.addColumn('bookings', 'notes', {
            type: Sequelize.TEXT,
            allowNull: true
          }, { transaction });
        }
        
        // Add meeting_url field if it doesn't exist
        if (!bookingsColumns.meeting_url) {
          await queryInterface.addColumn('bookings', 'meeting_url', {
            type: Sequelize.STRING(500),
            allowNull: true
          }, { transaction });
        }
        
        // Add updated field if it doesn't exist
        if (!bookingsColumns.updated) {
          await queryInterface.addColumn('bookings', 'updated', {
            type: Sequelize.DATE,
            allowNull: true
          }, { transaction });
        }
      }
      
      await transaction.commit();
      console.log('Added missing fields to bookings table successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('Failed to add fields to bookings table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      const tableNames = await queryInterface.showAllTables();
      
      if (tableNames.includes('bookings')) {
        const bookingsColumns = await queryInterface.describeTable('bookings');
        
        if (bookingsColumns.customer_phone) {
          await queryInterface.removeColumn('bookings', 'customer_phone', { transaction });
        }
        
        if (bookingsColumns.notes) {
          await queryInterface.removeColumn('bookings', 'notes', { transaction });
        }
        
        if (bookingsColumns.meeting_url) {
          await queryInterface.removeColumn('bookings', 'meeting_url', { transaction });
        }
        
        if (bookingsColumns.updated) {
          await queryInterface.removeColumn('bookings', 'updated', { transaction });
        }
      }
      
      await transaction.commit();
      console.log('Removed added fields from bookings table successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('Failed to remove fields from bookings table:', error);
      throw error;
    }
  }
};