/**
 * Add two-factor authentication fields to users table
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'two_factor_enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('users', 'two_factor_secret', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('users', 'two_factor_backup_codes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'JSON array of hashed backup codes'
    });

    await queryInterface.addColumn('users', 'two_factor_enabled_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add index for 2FA lookups
    await queryInterface.addIndex('users', ['two_factor_enabled'], {
      name: 'idx_users_two_factor_enabled'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('users', 'idx_users_two_factor_enabled');
    await queryInterface.removeColumn('users', 'two_factor_enabled_at');
    await queryInterface.removeColumn('users', 'two_factor_backup_codes');
    await queryInterface.removeColumn('users', 'two_factor_secret');
    await queryInterface.removeColumn('users', 'two_factor_enabled');
  }
};