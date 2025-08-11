'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add Outseta-related fields
      await queryInterface.addColumn('Users', 'outseta_uid', {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      }, { transaction });

      await queryInterface.addColumn('Users', 'subscription_plan', {
        type: Sequelize.STRING(100),
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Users', 'subscription_status', {
        type: Sequelize.STRING(50),
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Users', 'subscription_end_date', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      // Make password nullable for Outseta users
      await queryInterface.changeColumn('Users', 'password', {
        type: Sequelize.STRING(255),
        allowNull: true
      }, { transaction });

      // Add index for Outseta UID for faster lookups
      await queryInterface.addIndex('Users', ['outseta_uid'], {
        name: 'users_outseta_uid_idx',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove index
      await queryInterface.removeIndex('Users', 'users_outseta_uid_idx', { transaction });

      // Remove columns
      await queryInterface.removeColumn('Users', 'outseta_uid', { transaction });
      await queryInterface.removeColumn('Users', 'subscription_plan', { transaction });
      await queryInterface.removeColumn('Users', 'subscription_status', { transaction });
      await queryInterface.removeColumn('Users', 'subscription_end_date', { transaction });

      // Make password required again
      await queryInterface.changeColumn('Users', 'password', {
        type: Sequelize.STRING(255),
        allowNull: false
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};