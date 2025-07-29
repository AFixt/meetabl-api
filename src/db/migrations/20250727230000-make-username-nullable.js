'use strict';

/**
 * Migration: Make username field nullable
 * 
 * This migration changes the username field to be nullable
 * since username should be optional.
 * 
 * @author meetabl Team
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Make username column nullable
      await queryInterface.changeColumn('Users', 'username', {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      }, { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Make username column NOT NULL again
      await queryInterface.changeColumn('Users', 'username', {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      }, { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};