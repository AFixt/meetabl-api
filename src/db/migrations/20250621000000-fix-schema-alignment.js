'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // First, check if tables exist before attempting to modify them
      const tableNames = await queryInterface.showAllTables();
      
      // 1. Fix User table structure to match model expectations
      if (tableNames.includes('Users')) {
        // Add missing columns to Users table
        const userColumns = await queryInterface.describeTable('Users');
        
        if (!userColumns.timezone) {
          await queryInterface.addColumn('Users', 'timezone', {
            type: Sequelize.STRING(50),
            defaultValue: 'UTC',
            allowNull: false
          }, { transaction });
        }
        
        if (!userColumns.calendar_provider) {
          await queryInterface.addColumn('Users', 'calendar_provider', {
            type: Sequelize.ENUM('none', 'google', 'microsoft'),
            defaultValue: 'none',
            allowNull: false
          }, { transaction });
        }
        
        if (!userColumns.email_verified) {
          await queryInterface.addColumn('Users', 'email_verified', {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false
          }, { transaction });
        }
        
        if (!userColumns.email_verification_token) {
          await queryInterface.addColumn('Users', 'email_verification_token', {
            type: Sequelize.STRING(64),
            allowNull: true
          }, { transaction });
        }
        
        if (!userColumns.email_verification_expires) {
          await queryInterface.addColumn('Users', 'email_verification_expires', {
            type: Sequelize.DATE,
            allowNull: true
          }, { transaction });
        }
        
        if (!userColumns.password_reset_token) {
          await queryInterface.addColumn('Users', 'password_reset_token', {
            type: Sequelize.STRING(64),
            allowNull: true
          }, { transaction });
        }
        
        if (!userColumns.password_reset_expires) {
          await queryInterface.addColumn('Users', 'password_reset_expires', {
            type: Sequelize.DATE,
            allowNull: true
          }, { transaction });
        }
        
        // Add indexes for performance
        await queryInterface.addIndex('Users', ['email_verification_token'], { 
          transaction,
          name: 'idx_users_email_verification_token'
        });
        
        await queryInterface.addIndex('Users', ['password_reset_token'], { 
          transaction,
          name: 'idx_users_password_reset_token'
        });
      }
      
      // 2. Fix Booking status enum to match model
      if (tableNames.includes('Bookings')) {
        const bookingColumns = await queryInterface.describeTable('Bookings');
        
        // Update booking status enum to remove 'pending' and only include 'confirmed', 'cancelled'
        if (bookingColumns.status) {
          // MySQL specific enum update
          await queryInterface.sequelize.query(
            `ALTER TABLE Bookings MODIFY COLUMN status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed'`,
            { transaction }
          );
        }
      }
      
      // 3. Ensure JWT Blacklist table has correct structure
      if (tableNames.includes('jwt_blacklist')) {
        const jwtColumns = await queryInterface.describeTable('jwt_blacklist');
        
        if (!jwtColumns.user_id) {
          await queryInterface.addColumn('jwt_blacklist', 'user_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
              model: 'Users',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          }, { transaction });
        }
        
        // Add index for performance
        await queryInterface.addIndex('jwt_blacklist', ['user_id'], { 
          transaction,
          name: 'idx_jwt_blacklist_user_id'
        });
      }
      
      // 4. Ensure all foreign key constraints are properly set up
      // Check and fix foreign key references across tables
      const foreignKeyTables = [
        'UserSettings', 'CalendarTokens', 'AvailabilityRules', 
        'Bookings', 'Notifications', 'AuditLogs'
      ];
      
      for (const tableName of foreignKeyTables) {
        if (tableNames.includes(tableName)) {
          const columns = await queryInterface.describeTable(tableName);
          
          // Ensure userId foreign key exists and is properly constrained
          if (columns.userId && !columns.userId.references) {
            try {
              await queryInterface.addConstraint(tableName, {
                fields: ['userId'],
                type: 'foreign key',
                name: `fk_${tableName.toLowerCase()}_user_id`,
                references: {
                  table: 'Users',
                  field: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                transaction
              });
            } catch (error) {
              // Foreign key may already exist, continue
              console.warn(`Foreign key constraint already exists for ${tableName}.userId`);
            }
          }
        }
      }
      
      // 5. Add missing indexes for performance
      const indexesToAdd = [
        { table: 'Bookings', columns: ['startTime'], name: 'idx_bookings_start_time' },
        { table: 'Bookings', columns: ['status'], name: 'idx_bookings_status' },
        { table: 'Bookings', columns: ['userId', 'startTime'], name: 'idx_bookings_user_start_time' },
        { table: 'AvailabilityRules', columns: ['userId', 'dayOfWeek'], name: 'idx_availability_user_day' },
        { table: 'Notifications', columns: ['userId', 'read'], name: 'idx_notifications_user_read' },
        { table: 'CalendarTokens', columns: ['userId', 'provider'], name: 'idx_calendar_tokens_user_provider' }
      ];
      
      for (const indexDef of indexesToAdd) {
        if (tableNames.includes(indexDef.table)) {
          try {
            await queryInterface.addIndex(indexDef.table, indexDef.columns, { 
              transaction,
              name: indexDef.name
            });
          } catch (error) {
            // Index may already exist, continue
            console.warn(`Index ${indexDef.name} may already exist`);
          }
        }
      }
      
      await transaction.commit();
      console.log('Schema alignment migration completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('Schema alignment migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove added columns from Users table
      const userColumns = await queryInterface.describeTable('Users');
      
      const columnsToRemove = [
        'timezone', 'calendar_provider', 'email_verified', 
        'email_verification_token', 'email_verification_expires',
        'password_reset_token', 'password_reset_expires'
      ];
      
      for (const column of columnsToRemove) {
        if (userColumns[column]) {
          await queryInterface.removeColumn('Users', column, { transaction });
        }
      }
      
      // Remove added indexes
      const indexesToRemove = [
        { table: 'Users', name: 'idx_users_email_verification_token' },
        { table: 'Users', name: 'idx_users_password_reset_token' },
        { table: 'jwt_blacklist', name: 'idx_jwt_blacklist_user_id' },
        { table: 'Bookings', name: 'idx_bookings_start_time' },
        { table: 'Bookings', name: 'idx_bookings_status' },
        { table: 'Bookings', name: 'idx_bookings_user_start_time' },
        { table: 'AvailabilityRules', name: 'idx_availability_user_day' },
        { table: 'Notifications', name: 'idx_notifications_user_read' },
        { table: 'CalendarTokens', name: 'idx_calendar_tokens_user_provider' }
      ];
      
      for (const indexDef of indexesToRemove) {
        try {
          await queryInterface.removeIndex(indexDef.table, indexDef.name, { transaction });
        } catch (error) {
          // Index may not exist, continue
          console.warn(`Index ${indexDef.name} may not exist`);
        }
      }
      
      // Revert booking status enum
      await queryInterface.sequelize.query(
        `ALTER TABLE Bookings MODIFY COLUMN status ENUM('confirmed', 'cancelled', 'pending') NOT NULL DEFAULT 'pending'`,
        { transaction }
      );
      
      await transaction.commit();
      console.log('Schema alignment rollback completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('Schema alignment rollback failed:', error);
      throw error;
    }
  }
};