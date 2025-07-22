'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if index exists before trying to remove it
      const indexes = await queryInterface.showIndex('Users', { transaction });
      const indexExists = indexes.some(index => index.name === 'users_outseta_uid_idx');
      
      if (indexExists) {
        await queryInterface.removeIndex('Users', 'users_outseta_uid_idx', { transaction });
      }

      // Check if column exists before trying to remove it
      const tableDescription = await queryInterface.describeTable('Users', { transaction });
      
      if (tableDescription.outseta_uid) {
        await queryInterface.removeColumn('Users', 'outseta_uid', { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add Outseta UID column back
      await queryInterface.addColumn('Users', 'outseta_uid', {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      }, { transaction });

      // Add index for Outseta UID
      await queryInterface.addIndex('Users', ['outseta_uid'], {
        name: 'users_outseta_uid_idx',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};