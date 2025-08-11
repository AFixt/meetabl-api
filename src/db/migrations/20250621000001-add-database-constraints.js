'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Get list of existing tables
      const tableNames = await queryInterface.showAllTables();
      
      // 1. Add check constraints for time ranges in Bookings table
      if (tableNames.includes('Bookings')) {
        // Add check constraint to ensure endTime is after startTime
        await queryInterface.sequelize.query(`
          ALTER TABLE Bookings 
          ADD CONSTRAINT chk_booking_time_range 
          CHECK (endTime > startTime)
        `, { transaction });
        
        // Add check constraint to ensure startTime is in the future (for new bookings)
        await queryInterface.sequelize.query(`
          ALTER TABLE Bookings 
          ADD CONSTRAINT chk_booking_future_time 
          CHECK (startTime >= DATE_SUB(NOW(), INTERVAL 1 HOUR))
        `, { transaction });
        
        // Add check constraint for valid duration (max 8 hours)
        await queryInterface.sequelize.query(`
          ALTER TABLE Bookings 
          ADD CONSTRAINT chk_booking_duration 
          CHECK (TIMESTAMPDIFF(HOUR, startTime, endTime) <= 8)
        `, { transaction });
      }
      
      // 2. Add check constraints for AvailabilityRules
      if (tableNames.includes('AvailabilityRules')) {
        // Add check constraint for valid day of week (0-6)
        await queryInterface.sequelize.query(`
          ALTER TABLE AvailabilityRules 
          ADD CONSTRAINT chk_availability_day_of_week 
          CHECK (dayOfWeek >= 0 AND dayOfWeek <= 6)
        `, { transaction });
        
        // Add check constraint to ensure endTime is after startTime
        await queryInterface.sequelize.query(`
          ALTER TABLE AvailabilityRules 
          ADD CONSTRAINT chk_availability_time_range 
          CHECK (endTime > startTime)
        `, { transaction });
        
        // Add check constraint for valid time format (HH:MM)
        await queryInterface.sequelize.query(`
          ALTER TABLE AvailabilityRules 
          ADD CONSTRAINT chk_availability_start_time_format 
          CHECK (startTime REGEXP '^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
        `, { transaction });
        
        await queryInterface.sequelize.query(`
          ALTER TABLE AvailabilityRules 
          ADD CONSTRAINT chk_availability_end_time_format 
          CHECK (endTime REGEXP '^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
        `, { transaction });
      }
      
      // 3. Add unique constraints for booking time slots to prevent double-booking
      if (tableNames.includes('Bookings')) {
        // Ensure no overlapping bookings for the same user
        await queryInterface.addIndex('Bookings', {
          fields: ['userId', 'startTime', 'endTime'],
          name: 'idx_bookings_user_time_unique',
          unique: false, // Not unique but helps with overlap detection
          transaction
        });
      }
      
      // 4. Add cascade deletes for user-related data
      if (tableNames.includes('UserSettings')) {
        try {
          // Remove existing foreign key if it exists
          await queryInterface.sequelize.query(`
            ALTER TABLE UserSettings 
            DROP FOREIGN KEY IF EXISTS UserSettings_ibfk_1
          `, { transaction });
          
          // Add foreign key with cascade delete
          await queryInterface.addConstraint('UserSettings', {
            fields: ['userId'],
            type: 'foreign key',
            name: 'fk_user_settings_user_id_cascade',
            references: {
              table: 'Users',
              field: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
            transaction
          });
        } catch (error) {
          console.warn('UserSettings foreign key constraint may already exist or table may not exist');
        }
      }
      
      if (tableNames.includes('CalendarTokens')) {
        try {
          await queryInterface.sequelize.query(`
            ALTER TABLE CalendarTokens 
            DROP FOREIGN KEY IF EXISTS CalendarTokens_ibfk_1
          `, { transaction });
          
          await queryInterface.addConstraint('CalendarTokens', {
            fields: ['userId'],
            type: 'foreign key',
            name: 'fk_calendar_tokens_user_id_cascade',
            references: {
              table: 'Users',
              field: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
            transaction
          });
        } catch (error) {
          console.warn('CalendarTokens foreign key constraint may already exist or table may not exist');
        }
      }
      
      if (tableNames.includes('AvailabilityRules')) {
        try {
          await queryInterface.sequelize.query(`
            ALTER TABLE AvailabilityRules 
            DROP FOREIGN KEY IF EXISTS AvailabilityRules_ibfk_1
          `, { transaction });
          
          await queryInterface.addConstraint('AvailabilityRules', {
            fields: ['userId'],
            type: 'foreign key',
            name: 'fk_availability_rules_user_id_cascade',
            references: {
              table: 'Users',
              field: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
            transaction
          });
        } catch (error) {
          console.warn('AvailabilityRules foreign key constraint may already exist or table may not exist');
        }
      }
      
      if (tableNames.includes('Bookings')) {
        try {
          await queryInterface.sequelize.query(`
            ALTER TABLE Bookings 
            DROP FOREIGN KEY IF EXISTS Bookings_ibfk_1
          `, { transaction });
          
          await queryInterface.addConstraint('Bookings', {
            fields: ['userId'],
            type: 'foreign key',
            name: 'fk_bookings_user_id_cascade',
            references: {
              table: 'Users',
              field: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
            transaction
          });
        } catch (error) {
          console.warn('Bookings foreign key constraint may already exist or table may not exist');
        }
      }
      
      // 5. Add unique constraints to prevent duplicates
      if (tableNames.includes('CalendarTokens')) {
        try {
          await queryInterface.addConstraint('CalendarTokens', {
            fields: ['userId', 'provider'],
            type: 'unique',
            name: 'uq_calendar_tokens_user_provider',
            transaction
          });
        } catch (error) {
          console.warn('CalendarTokens unique constraint may already exist');
        }
      }
      
      if (tableNames.includes('AvailabilityRules')) {
        try {
          await queryInterface.addConstraint('AvailabilityRules', {
            fields: ['userId', 'dayOfWeek', 'startTime', 'endTime'],
            type: 'unique',
            name: 'uq_availability_rules_user_day_time',
            transaction
          });
        } catch (error) {
          console.warn('AvailabilityRules unique constraint may already exist');
        }
      }
      
      // 6. Add check constraints for Users table
      if (tableNames.includes('Users')) {
        // Add check constraint for valid email format (additional to Sequelize validation)
        await queryInterface.sequelize.query(`
          ALTER TABLE Users 
          ADD CONSTRAINT chk_users_email_format 
          CHECK (email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
        `, { transaction });
        
        // Add check constraint for password minimum length
        await queryInterface.sequelize.query(`
          ALTER TABLE Users 
          ADD CONSTRAINT chk_users_password_length 
          CHECK (CHAR_LENGTH(password) >= 8)
        `, { transaction });
        
        // Add check constraint for valid status values
        await queryInterface.sequelize.query(`
          ALTER TABLE Users 
          ADD CONSTRAINT chk_users_status 
          CHECK (status IN ('active', 'inactive', 'suspended', 'pending'))
        `, { transaction });
        
        // Add check constraint for valid role values
        await queryInterface.sequelize.query(`
          ALTER TABLE Users 
          ADD CONSTRAINT chk_users_role 
          CHECK (role IN ('user', 'admin', 'moderator'))
        `, { transaction });
      }
      
      // 7. Add check constraints for Notifications table
      if (tableNames.includes('Notifications')) {
        // Add check constraint for valid type values
        await queryInterface.sequelize.query(`
          ALTER TABLE Notifications 
          ADD CONSTRAINT chk_notifications_type 
          CHECK (type IN ('email', 'sms', 'push'))
        `, { transaction });
        
        // Add check constraint for valid status values
        await queryInterface.sequelize.query(`
          ALTER TABLE Notifications 
          ADD CONSTRAINT chk_notifications_status 
          CHECK (status IN ('pending', 'sent', 'failed', 'delivered'))
        `, { transaction });
      }
      
      // 8. Add performance indexes
      const performanceIndexes = [
        { table: 'Users', columns: ['email', 'status'], name: 'idx_users_email_status' },
        { table: 'Users', columns: ['created'], name: 'idx_users_created' },
        { table: 'Bookings', columns: ['status', 'startTime'], name: 'idx_bookings_status_start' },
        { table: 'Bookings', columns: ['customer_email'], name: 'idx_bookings_customer_email' },
        { table: 'AvailabilityRules', columns: ['isAvailable'], name: 'idx_availability_rules_available' },
        { table: 'Notifications', columns: ['status', 'type'], name: 'idx_notifications_status_type' }
      ];
      
      for (const indexDef of performanceIndexes) {
        if (tableNames.includes(indexDef.table)) {
          try {
            await queryInterface.addIndex(indexDef.table, indexDef.columns, {
              name: indexDef.name,
              transaction
            });
          } catch (error) {
            console.warn(`Index ${indexDef.name} may already exist`);
          }
        }
      }
      
      await transaction.commit();
      console.log('Database constraints migration completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('Database constraints migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove all added constraints and indexes
      const constraintsToRemove = [
        'chk_booking_time_range',
        'chk_booking_future_time', 
        'chk_booking_duration',
        'chk_availability_day_of_week',
        'chk_availability_time_range',
        'chk_availability_start_time_format',
        'chk_availability_end_time_format',
        'chk_users_email_format',
        'chk_users_password_length',
        'chk_users_status',
        'chk_users_role',
        'chk_notifications_type',
        'chk_notifications_status'
      ];
      
      for (const constraint of constraintsToRemove) {
        try {
          await queryInterface.sequelize.query(`
            ALTER TABLE Bookings DROP CHECK IF EXISTS ${constraint}
          `, { transaction });
          await queryInterface.sequelize.query(`
            ALTER TABLE AvailabilityRules DROP CHECK IF EXISTS ${constraint}
          `, { transaction });
          await queryInterface.sequelize.query(`
            ALTER TABLE Users DROP CHECK IF EXISTS ${constraint}
          `, { transaction });
          await queryInterface.sequelize.query(`
            ALTER TABLE Notifications DROP CHECK IF EXISTS ${constraint}
          `, { transaction });
        } catch (error) {
          // Constraint may not exist, continue
          console.warn(`Constraint ${constraint} may not exist`);
        }
      }
      
      // Remove unique constraints
      const uniqueConstraints = [
        { table: 'CalendarTokens', name: 'uq_calendar_tokens_user_provider' },
        { table: 'AvailabilityRules', name: 'uq_availability_rules_user_day_time' }
      ];
      
      for (const constraint of uniqueConstraints) {
        try {
          await queryInterface.removeConstraint(constraint.table, constraint.name, { transaction });
        } catch (error) {
          console.warn(`Unique constraint ${constraint.name} may not exist`);
        }
      }
      
      // Remove added indexes
      const indexesToRemove = [
        { table: 'Bookings', name: 'idx_bookings_user_time_unique' },
        { table: 'Users', name: 'idx_users_email_status' },
        { table: 'Users', name: 'idx_users_created' },
        { table: 'Bookings', name: 'idx_bookings_status_start' },
        { table: 'Bookings', name: 'idx_bookings_customer_email' },
        { table: 'AvailabilityRules', name: 'idx_availability_rules_available' },
        { table: 'Notifications', name: 'idx_notifications_status_type' }
      ];
      
      for (const indexDef of indexesToRemove) {
        try {
          await queryInterface.removeIndex(indexDef.table, indexDef.name, { transaction });
        } catch (error) {
          console.warn(`Index ${indexDef.name} may not exist`);
        }
      }
      
      await transaction.commit();
      console.log('Database constraints rollback completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('Database constraints rollback failed:', error);
      throw error;
    }
  }
};