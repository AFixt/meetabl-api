'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Update AuditLogs table
      await queryInterface.changeColumn('AuditLogs', 'id', {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      }, { transaction });
      
      await queryInterface.changeColumn('AuditLogs', 'userId', {
        type: Sequelize.STRING(36),
        allowNull: false
      }, { transaction });

      // Update Notifications table
      await queryInterface.changeColumn('Notifications', 'id', {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      }, { transaction });
      
      await queryInterface.changeColumn('Notifications', 'bookingId', {
        type: Sequelize.STRING(36),
        allowNull: false
      }, { transaction });

      // Update UserSettings table
      await queryInterface.changeColumn('UserSettings', 'id', {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      }, { transaction });
      
      await queryInterface.changeColumn('UserSettings', 'userId', {
        type: Sequelize.STRING(36),
        allowNull: false
      }, { transaction });

      // Update availability_rules table
      await queryInterface.changeColumn('availability_rules', 'id', {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      }, { transaction });
      
      await queryInterface.changeColumn('availability_rules', 'userId', {
        type: Sequelize.STRING(36),
        allowNull: false
      }, { transaction });

      // Update CalendarTokens table
      await queryInterface.changeColumn('CalendarTokens', 'id', {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      }, { transaction });
      
      await queryInterface.changeColumn('CalendarTokens', 'userId', {
        type: Sequelize.STRING(36),
        allowNull: false
      }, { transaction });

      // Update jwtBlacklist table
      await queryInterface.changeColumn('jwtBlacklist', 'inc', {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      }, { transaction });
      
      await queryInterface.changeColumn('jwtBlacklist', 'userId', {
        type: Sequelize.STRING(36),
        allowNull: false
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
      // Revert AuditLogs table
      await queryInterface.changeColumn('AuditLogs', 'id', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      }, { transaction });
      
      await queryInterface.changeColumn('AuditLogs', 'userId', {
        type: Sequelize.INTEGER,
        allowNull: false
      }, { transaction });

      // Revert Notifications table
      await queryInterface.changeColumn('Notifications', 'id', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      }, { transaction });
      
      await queryInterface.changeColumn('Notifications', 'bookingId', {
        type: Sequelize.INTEGER,
        allowNull: false
      }, { transaction });

      // Revert UserSettings table
      await queryInterface.changeColumn('UserSettings', 'id', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      }, { transaction });
      
      await queryInterface.changeColumn('UserSettings', 'userId', {
        type: Sequelize.INTEGER,
        allowNull: false
      }, { transaction });

      // Revert availability_rules table
      await queryInterface.changeColumn('availability_rules', 'id', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      }, { transaction });
      
      await queryInterface.changeColumn('availability_rules', 'userId', {
        type: Sequelize.INTEGER,
        allowNull: false
      }, { transaction });

      // Revert CalendarTokens table
      await queryInterface.changeColumn('CalendarTokens', 'id', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      }, { transaction });
      
      await queryInterface.changeColumn('CalendarTokens', 'userId', {
        type: Sequelize.INTEGER,
        allowNull: false
      }, { transaction });

      // Revert jwtBlacklist table
      await queryInterface.changeColumn('jwtBlacklist', 'inc', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      }, { transaction });
      
      await queryInterface.changeColumn('jwtBlacklist', 'userId', {
        type: Sequelize.INTEGER,
        allowNull: false
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};