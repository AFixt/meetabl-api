/**
 * Migration: Align database schema with model definitions
 * 
 * This migration addresses critical discrepancies between the existing database schema
 * and the current Sequelize model definitions. It standardizes table names, field names,
 * data types, and adds missing fields to ensure consistency.
 * 
 * Major changes:
 * 1. Standardize table names to lowercase (users, user_settings, etc.)
 * 2. Add missing fields to match model definitions
 * 3. Rename fields for consistency with models
 * 4. Add missing tables (jwt_blacklist)
 * 5. Update enum values to match models
 * 
 * @author meetabl Team
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. First, check if tables exist with uppercase names and rename to lowercase
      const tables = await queryInterface.showAllTables();
      
      // Rename Users table to users if it exists
      if (tables.includes('Users') && !tables.includes('users')) {
        await queryInterface.renameTable('Users', 'users', { transaction });
      }
      
      // Rename other tables to lowercase if they exist
      const tableRenames = [
        ['UserSettings', 'user_settings'],
        ['CalendarTokens', 'calendar_tokens'],
        ['AvailabilityRules', 'availability_rules'],
        ['Bookings', 'bookings'],
        ['Notifications', 'notifications'],
        ['AuditLogs', 'audit_logs']
      ];
      
      for (const [oldName, newName] of tableRenames) {
        if (tables.includes(oldName) && !tables.includes(newName)) {
          await queryInterface.renameTable(oldName, newName, { transaction });
        }
      }
      
      // 2. Add missing fields to users table
      const userColumns = await queryInterface.describeTable('users');
      
      if (!userColumns.username) {
        await queryInterface.addColumn('users', 'username', {
          type: Sequelize.STRING(50),
          allowNull: true,
          unique: true
        }, { transaction });
      }
      
      if (!userColumns.name) {
        await queryInterface.addColumn('users', 'name', {
          type: Sequelize.STRING(255),
          allowNull: true
        }, { transaction });
      }
      
      if (!userColumns.timezone) {
        await queryInterface.addColumn('users', 'timezone', {
          type: Sequelize.STRING(100),
          allowNull: true,
          defaultValue: 'UTC'
        }, { transaction });
      }
      
      if (!userColumns.calendar_provider) {
        await queryInterface.addColumn('users', 'calendar_provider', {
          type: Sequelize.ENUM('google', 'microsoft'),
          allowNull: true
        }, { transaction });
      }
      
      if (!userColumns.email_verified) {
        await queryInterface.addColumn('users', 'email_verified', {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }, { transaction });
      }
      
      if (!userColumns.email_verification_token) {
        await queryInterface.addColumn('users', 'email_verification_token', {
          type: Sequelize.STRING(255),
          allowNull: true
        }, { transaction });
      }
      
      if (!userColumns.email_verification_expires) {
        await queryInterface.addColumn('users', 'email_verification_expires', {
          type: Sequelize.DATE,
          allowNull: true
        }, { transaction });
      }
      
      // Rename password to password_hash if password column exists
      if (userColumns.password && !userColumns.password_hash) {
        await queryInterface.renameColumn('users', 'password', 'password_hash', { transaction });
      }
      
      // 3. Update user_settings table structure
      const userSettingsColumns = await queryInterface.describeTable('user_settings');
      
      // Rename userId to user_id if it exists
      if (userSettingsColumns.userId && !userSettingsColumns.user_id) {
        await queryInterface.renameColumn('user_settings', 'userId', 'user_id', { transaction });
      }
      
      // Add accessibility fields if missing
      if (!userSettingsColumns.accessibility_mode) {
        await queryInterface.addColumn('user_settings', 'accessibility_mode', {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }, { transaction });
      }
      
      if (!userSettingsColumns.alt_text_enabled) {
        await queryInterface.addColumn('user_settings', 'alt_text_enabled', {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }, { transaction });
      }
      
      if (!userSettingsColumns.branding_color) {
        await queryInterface.addColumn('user_settings', 'branding_color', {
          type: Sequelize.STRING(7),
          allowNull: true,
          defaultValue: '#0066cc'
        }, { transaction });
      }
      
      if (!userSettingsColumns.confirmation_email_copy) {
        await queryInterface.addColumn('user_settings', 'confirmation_email_copy', {
          type: Sequelize.TEXT,
          allowNull: true
        }, { transaction });
      }
      
      // 4. Update calendar_tokens table
      const calendarTokensColumns = await queryInterface.describeTable('calendar_tokens');
      
      // Rename userId to user_id if it exists
      if (calendarTokensColumns.userId && !calendarTokensColumns.user_id) {
        await queryInterface.renameColumn('calendar_tokens', 'userId', 'user_id', { transaction });
      }
      
      // Rename accessToken to access_token if it exists
      if (calendarTokensColumns.accessToken && !calendarTokensColumns.access_token) {
        await queryInterface.renameColumn('calendar_tokens', 'accessToken', 'access_token', { transaction });
      }
      
      // Rename refreshToken to refresh_token if it exists
      if (calendarTokensColumns.refreshToken && !calendarTokensColumns.refresh_token) {
        await queryInterface.renameColumn('calendar_tokens', 'refreshToken', 'refresh_token', { transaction });
      }
      
      // Rename expiresAt to expires_at if it exists
      if (calendarTokensColumns.expiresAt && !calendarTokensColumns.expires_at) {
        await queryInterface.renameColumn('calendar_tokens', 'expiresAt', 'expires_at', { transaction });
      }
      
      // 5. Update availability_rules table
      const availabilityRulesColumns = await queryInterface.describeTable('availability_rules');
      
      // Rename fields to snake_case
      if (availabilityRulesColumns.userId && !availabilityRulesColumns.user_id) {
        await queryInterface.renameColumn('availability_rules', 'userId', 'user_id', { transaction });
      }
      
      if (availabilityRulesColumns.dayOfWeek && !availabilityRulesColumns.day_of_week) {
        await queryInterface.renameColumn('availability_rules', 'dayOfWeek', 'day_of_week', { transaction });
      }
      
      if (availabilityRulesColumns.startTime && !availabilityRulesColumns.start_time) {
        await queryInterface.renameColumn('availability_rules', 'startTime', 'start_time', { transaction });
      }
      
      if (availabilityRulesColumns.endTime && !availabilityRulesColumns.end_time) {
        await queryInterface.renameColumn('availability_rules', 'endTime', 'end_time', { transaction });
      }
      
      // Add missing fields
      if (!availabilityRulesColumns.buffer_minutes) {
        await queryInterface.addColumn('availability_rules', 'buffer_minutes', {
          type: Sequelize.INTEGER,
          defaultValue: 0
        }, { transaction });
      }
      
      if (!availabilityRulesColumns.max_bookings_per_day) {
        await queryInterface.addColumn('availability_rules', 'max_bookings_per_day', {
          type: Sequelize.INTEGER,
          allowNull: true
        }, { transaction });
      }
      
      // 6. Update bookings table
      const bookingsColumns = await queryInterface.describeTable('bookings');
      
      // Rename fields to snake_case and match model naming
      if (bookingsColumns.userId && !bookingsColumns.user_id) {
        await queryInterface.renameColumn('bookings', 'userId', 'user_id', { transaction });
      }
      
      if (bookingsColumns.guestEmail && !bookingsColumns.customer_email) {
        await queryInterface.renameColumn('bookings', 'guestEmail', 'customer_email', { transaction });
      }
      
      if (bookingsColumns.guestName && !bookingsColumns.customer_name) {
        await queryInterface.renameColumn('bookings', 'guestName', 'customer_name', { transaction });
      }
      
      if (bookingsColumns.startTime && !bookingsColumns.start_time) {
        await queryInterface.renameColumn('bookings', 'startTime', 'start_time', { transaction });
      }
      
      if (bookingsColumns.endTime && !bookingsColumns.end_time) {
        await queryInterface.renameColumn('bookings', 'endTime', 'end_time', { transaction });
      }
      
      if (bookingsColumns.externalCalendarEventId && !bookingsColumns.calendar_event_id) {
        await queryInterface.renameColumn('bookings', 'externalCalendarEventId', 'calendar_event_id', { transaction });
      }
      
      // 7. Update notifications table
      const notificationsColumns = await queryInterface.describeTable('notifications');
      
      // Rename fields to snake_case
      if (notificationsColumns.userId && !notificationsColumns.user_id) {
        await queryInterface.renameColumn('notifications', 'userId', 'user_id', { transaction });
      }
      
      if (notificationsColumns.bookingId && !notificationsColumns.booking_id) {
        await queryInterface.renameColumn('notifications', 'bookingId', 'booking_id', { transaction });
      }
      
      if (notificationsColumns.sentAt && !notificationsColumns.sent_at) {
        await queryInterface.renameColumn('notifications', 'sentAt', 'sent_at', { transaction });
      }
      
      if (notificationsColumns.errorDetails && !notificationsColumns.error_message) {
        await queryInterface.renameColumn('notifications', 'errorDetails', 'error_message', { transaction });
      }
      
      // 8. Update audit_logs table
      const auditLogsColumns = await queryInterface.describeTable('audit_logs');
      
      // Rename userId to user_id if it exists
      if (auditLogsColumns.userId && !auditLogsColumns.user_id) {
        await queryInterface.renameColumn('audit_logs', 'userId', 'user_id', { transaction });
      }
      
      // Add metadata field (combining details, ipAddress, userAgent)
      if (!auditLogsColumns.metadata) {
        await queryInterface.addColumn('audit_logs', 'metadata', {
          type: Sequelize.TEXT,
          allowNull: true
        }, { transaction });
      }
      
      // 9. Create jwt_blacklist table if it doesn't exist
      if (!tables.includes('jwt_blacklist')) {
        await queryInterface.createTable('jwt_blacklist', {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING(36),
            defaultValue: Sequelize.UUIDV4
          },
          token: {
            type: Sequelize.TEXT,
            allowNull: false,
            unique: true
          },
          expires_at: {
            type: Sequelize.DATE,
            allowNull: false
          },
          created: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
          }
        }, { transaction });
        
        // Add index for cleanup performance
        await queryInterface.addIndex('jwt_blacklist', ['expires_at'], { transaction });
      }
      
      // 10. Update foreign key constraints to use lowercase table names
      // This requires dropping and recreating foreign keys with correct references
      
      // Remove old foreign keys and add new ones with correct table references
      try {
        // user_settings foreign key
        await queryInterface.removeConstraint('user_settings', 'user_settings_ibfk_1', { transaction });
      } catch (e) {
        // Constraint might not exist or have different name
      }
      
      await queryInterface.addConstraint('user_settings', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'user_settings_user_id_fkey',
        references: {
          table: 'users',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        transaction
      });
      
      // calendar_tokens foreign key
      try {
        await queryInterface.removeConstraint('calendar_tokens', 'calendar_tokens_ibfk_1', { transaction });
      } catch (e) {
        // Constraint might not exist or have different name
      }
      
      await queryInterface.addConstraint('calendar_tokens', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'calendar_tokens_user_id_fkey',
        references: {
          table: 'users',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        transaction
      });
      
      // availability_rules foreign key
      try {
        await queryInterface.removeConstraint('availability_rules', 'availability_rules_ibfk_1', { transaction });
      } catch (e) {
        // Constraint might not exist or have different name
      }
      
      await queryInterface.addConstraint('availability_rules', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'availability_rules_user_id_fkey',
        references: {
          table: 'users',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        transaction
      });
      
      // bookings foreign key
      try {
        await queryInterface.removeConstraint('bookings', 'bookings_ibfk_1', { transaction });
      } catch (e) {
        // Constraint might not exist or have different name
      }
      
      await queryInterface.addConstraint('bookings', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'bookings_user_id_fkey',
        references: {
          table: 'users',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        transaction
      });
      
      // notifications foreign keys
      try {
        await queryInterface.removeConstraint('notifications', 'notifications_ibfk_1', { transaction });
        await queryInterface.removeConstraint('notifications', 'notifications_ibfk_2', { transaction });
      } catch (e) {
        // Constraints might not exist or have different names
      }
      
      await queryInterface.addConstraint('notifications', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'notifications_user_id_fkey',
        references: {
          table: 'users',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });
      
      await queryInterface.addConstraint('notifications', {
        fields: ['booking_id'],
        type: 'foreign key',
        name: 'notifications_booking_id_fkey',
        references: {
          table: 'bookings',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });
      
      // audit_logs foreign key
      try {
        await queryInterface.removeConstraint('audit_logs', 'audit_logs_ibfk_1', { transaction });
      } catch (e) {
        // Constraint might not exist or have different name
      }
      
      await queryInterface.addConstraint('audit_logs', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'audit_logs_user_id_fkey',
        references: {
          table: 'users',
          field: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        transaction
      });
      
      await transaction.commit();
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // This migration cannot be easily reversed due to the complexity
      // and potential data loss. If rollback is needed, restore from backup.
      console.log('WARNING: This migration cannot be automatically reversed.');
      console.log('Please restore from a database backup if rollback is required.');
      
      await transaction.commit();
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};