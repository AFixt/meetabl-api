'use strict';

/**
 * Migration: Add username field to Users table
 * 
 * This migration adds the username field to the Users table
 * to support custom booking URLs like /book/username
 * 
 * @author meetabl Team
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if username column already exists
      const tableDescription = await queryInterface.describeTable('Users');
      
      if (!tableDescription.username) {
        // Add username column
        await queryInterface.addColumn('Users', 'username', {
          type: Sequelize.STRING(100),
          allowNull: true, // Temporarily allow null for existing users
          unique: true
        }, { transaction });
        
        // Generate usernames for existing users based on firstName-lastName
        await queryInterface.sequelize.query(`
          UPDATE Users 
          SET username = LOWER(CONCAT(
            REPLACE(REPLACE(REPLACE(first_name, ' ', '-'), '.', ''), '''', ''),
            '-',
            REPLACE(REPLACE(REPLACE(last_name, ' ', '-'), '.', ''), '''', '')
          ))
          WHERE username IS NULL
        `, { transaction });
        
        // Handle duplicate usernames by appending numbers
        await queryInterface.sequelize.query(`
          UPDATE Users u1
          INNER JOIN (
            SELECT id, username,
              @row_number := IF(@prev_username = username, @row_number + 1, 1) AS row_num,
              @prev_username := username
            FROM Users,
            (SELECT @row_number := 0, @prev_username := '') AS vars
            ORDER BY username, created
          ) AS numbered
          ON u1.id = numbered.id
          SET u1.username = CASE 
            WHEN numbered.row_num > 1 
            THEN CONCAT(numbered.username, '-', numbered.row_num)
            ELSE numbered.username
          END
          WHERE numbered.row_num > 1
        `, { transaction });
        
        // Now make the column NOT NULL
        await queryInterface.changeColumn('Users', 'username', {
          type: Sequelize.STRING(100),
          allowNull: false,
          unique: true
        }, { transaction });
        
        // Add index for performance
        await queryInterface.addIndex('Users', ['username'], {
          name: 'idx_users_username',
          unique: true,
          transaction
        });
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove index
      await queryInterface.removeIndex('Users', 'idx_users_username', { transaction });
      
      // Remove column
      await queryInterface.removeColumn('Users', 'username', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};