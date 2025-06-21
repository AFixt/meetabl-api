/**
 * Migration: Add missing database constraints
 * 
 * This migration adds essential database constraints for data integrity:
 * 1. Check constraints for time ranges and valid values
 * 2. Unique constraints for business logic
 * 3. Indexes for performance
 * 4. Additional validation constraints
 * 
 * @author meetabl Team
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. Add check constraints for availability_rules
      
      // Ensure day_of_week is between 0-6 (Sunday-Saturday)
      await queryInterface.addConstraint('availability_rules', {
        fields: ['day_of_week'],
        type: 'check',
        name: 'availability_rules_day_of_week_check',
        where: {
          day_of_week: {
            [Sequelize.Op.between]: [0, 6]
          }
        },
        transaction
      });
      
      // Ensure start_time is before end_time
      await queryInterface.sequelize.query(`
        ALTER TABLE availability_rules 
        ADD CONSTRAINT availability_rules_time_range_check 
        CHECK (start_time < end_time)
      `, { transaction });
      
      // Ensure buffer_minutes is non-negative
      await queryInterface.addConstraint('availability_rules', {
        fields: ['buffer_minutes'],
        type: 'check',
        name: 'availability_rules_buffer_minutes_check',
        where: {
          buffer_minutes: {
            [Sequelize.Op.gte]: 0
          }
        },
        transaction
      });
      
      // Ensure max_bookings_per_day is positive when not null
      await queryInterface.sequelize.query(`
        ALTER TABLE availability_rules 
        ADD CONSTRAINT availability_rules_max_bookings_check 
        CHECK (max_bookings_per_day IS NULL OR max_bookings_per_day > 0)
      `, { transaction });
      
      // 2. Add check constraints for bookings
      
      // Ensure start_time is before end_time
      await queryInterface.sequelize.query(`
        ALTER TABLE bookings 
        ADD CONSTRAINT bookings_time_range_check 
        CHECK (start_time < end_time)
      `, { transaction });
      
      // Ensure future bookings (start_time should be in the future when created)
      // Note: This is enforced at application level, not database level due to updates
      
      // 3. Add check constraints for user_settings
      
      // Ensure meeting duration is positive
      await queryInterface.sequelize.query(`
        ALTER TABLE user_settings 
        ADD CONSTRAINT user_settings_meeting_duration_check 
        CHECK (meetingDuration IS NULL OR meetingDuration > 0)
      `, { transaction });
      
      // Ensure buffer time is non-negative
      await queryInterface.sequelize.query(`
        ALTER TABLE user_settings 
        ADD CONSTRAINT user_settings_buffer_time_check 
        CHECK (bufferTime IS NULL OR bufferTime >= 0)
      `, { transaction });
      
      // Ensure branding_color follows hex color format
      await queryInterface.sequelize.query(`
        ALTER TABLE user_settings 
        ADD CONSTRAINT user_settings_branding_color_check 
        CHECK (branding_color IS NULL OR branding_color REGEXP '^#[0-9A-Fa-f]{6}$')
      `, { transaction });
      
      // 4. Add unique constraints
      
      // Ensure unique availability rules per user/day combination
      await queryInterface.addConstraint('availability_rules', {
        fields: ['user_id', 'day_of_week', 'start_time', 'end_time'],
        type: 'unique',
        name: 'availability_rules_user_day_time_unique',
        transaction
      });
      
      // Ensure unique calendar tokens per user/provider combination
      await queryInterface.addConstraint('calendar_tokens', {
        fields: ['user_id', 'provider'],
        type: 'unique',
        name: 'calendar_tokens_user_provider_unique',
        transaction
      });
      
      // Ensure username is unique when not null
      await queryInterface.addConstraint('users', {
        fields: ['username'],
        type: 'unique',
        name: 'users_username_unique',
        where: {
          username: {
            [Sequelize.Op.ne]: null
          }
        },
        transaction
      });
      
      // 5. Add performance indexes
      
      // Index for booking queries by user and time range
      await queryInterface.addIndex('bookings', {
        fields: ['user_id', 'start_time', 'end_time'],
        name: 'bookings_user_time_idx',
        transaction
      });
      
      // Index for booking queries by status
      await queryInterface.addIndex('bookings', {
        fields: ['status', 'start_time'],
        name: 'bookings_status_time_idx',
        transaction
      });
      
      // Index for availability rules queries
      await queryInterface.addIndex('availability_rules', {
        fields: ['user_id', 'day_of_week'],
        name: 'availability_rules_user_day_idx',
        transaction
      });
      
      // Index for notifications queries
      await queryInterface.addIndex('notifications', {
        fields: ['user_id', 'type', 'status'],
        name: 'notifications_user_type_status_idx',
        transaction
      });
      
      // Index for notifications by scheduled time
      await queryInterface.addIndex('notifications', {
        fields: ['scheduledFor', 'status'],
        name: 'notifications_scheduled_status_idx',
        where: {
          scheduledFor: {
            [Sequelize.Op.ne]: null
          }
        },
        transaction
      });
      
      // Index for audit logs queries
      await queryInterface.addIndex('audit_logs', {
        fields: ['user_id', 'action', 'created'],
        name: 'audit_logs_user_action_created_idx',
        transaction
      });
      
      // Index for calendar tokens by expires_at for cleanup
      await queryInterface.addIndex('calendar_tokens', {
        fields: ['expires_at'],
        name: 'calendar_tokens_expires_at_idx',
        transaction
      });
      
      // 6. Add email validation constraint
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ADD CONSTRAINT users_email_format_check 
        CHECK (email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
      `, { transaction });
      
      // 7. Add timezone validation (basic check for common timezone format)
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ADD CONSTRAINT users_timezone_check 
        CHECK (timezone IS NULL OR LENGTH(timezone) > 0)
      `, { transaction });
      
      await queryInterface.sequelize.query(`
        ALTER TABLE user_settings 
        ADD CONSTRAINT user_settings_timezone_check 
        CHECK (timezone IS NULL OR LENGTH(timezone) > 0)
      `, { transaction });
      
      // 8. Add constraint for notification recipient format
      await queryInterface.sequelize.query(`
        ALTER TABLE notifications 
        ADD CONSTRAINT notifications_recipient_format_check 
        CHECK (
          (channel = 'email' AND recipient REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$') OR
          (channel = 'sms' AND recipient REGEXP '^\\+?[1-9]\\d{1,14}$') OR
          (channel = 'push')
        )
      `, { transaction });
      
      // 9. Add constraint for booking customer email format
      await queryInterface.sequelize.query(`
        ALTER TABLE bookings 
        ADD CONSTRAINT bookings_customer_email_format_check 
        CHECK (customer_email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
      `, { transaction });
      
      // 10. Add constraint for password reset token expiry logic
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ADD CONSTRAINT users_password_reset_consistency_check 
        CHECK (
          (password_reset_token IS NULL AND password_reset_expires IS NULL) OR
          (password_reset_token IS NOT NULL AND password_reset_expires IS NOT NULL)
        )
      `, { transaction });
      
      // 11. Add constraint for email verification token expiry logic
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ADD CONSTRAINT users_email_verification_consistency_check 
        CHECK (
          (email_verification_token IS NULL AND email_verification_expires IS NULL) OR
          (email_verification_token IS NOT NULL AND email_verification_expires IS NOT NULL)
        )
      `, { transaction });
      
      await transaction.commit();
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove constraints in reverse order
      
      // Remove check constraints
      const constraints = [
        'users_email_verification_consistency_check',
        'users_password_reset_consistency_check',
        'bookings_customer_email_format_check',
        'notifications_recipient_format_check',
        'user_settings_timezone_check',
        'users_timezone_check',
        'users_email_format_check',
        'user_settings_branding_color_check',
        'user_settings_buffer_time_check',
        'user_settings_meeting_duration_check',
        'bookings_time_range_check',
        'availability_rules_max_bookings_check',
        'availability_rules_time_range_check',
        'availability_rules_buffer_minutes_check',
        'availability_rules_day_of_week_check'
      ];
      
      for (const constraint of constraints) {
        try {
          await queryInterface.removeConstraint('users', constraint, { transaction });
        } catch (e) {
          // Constraint might be on different table, try others
          try {
            await queryInterface.removeConstraint('user_settings', constraint, { transaction });
          } catch (e2) {
            try {
              await queryInterface.removeConstraint('availability_rules', constraint, { transaction });
            } catch (e3) {
              try {
                await queryInterface.removeConstraint('bookings', constraint, { transaction });
              } catch (e4) {
                try {
                  await queryInterface.removeConstraint('notifications', constraint, { transaction });
                } catch (e5) {
                  // Constraint might not exist or have different name
                }
              }
            }
          }
        }
      }
      
      // Remove unique constraints
      try {
        await queryInterface.removeConstraint('users', 'users_username_unique', { transaction });
      } catch (e) {
        // Constraint might not exist
      }
      
      try {
        await queryInterface.removeConstraint('calendar_tokens', 'calendar_tokens_user_provider_unique', { transaction });
      } catch (e) {
        // Constraint might not exist
      }
      
      try {
        await queryInterface.removeConstraint('availability_rules', 'availability_rules_user_day_time_unique', { transaction });
      } catch (e) {
        // Constraint might not exist
      }
      
      // Remove indexes
      const indexes = [
        ['calendar_tokens', 'calendar_tokens_expires_at_idx'],
        ['audit_logs', 'audit_logs_user_action_created_idx'],
        ['notifications', 'notifications_scheduled_status_idx'],
        ['notifications', 'notifications_user_type_status_idx'],
        ['availability_rules', 'availability_rules_user_day_idx'],
        ['bookings', 'bookings_status_time_idx'],
        ['bookings', 'bookings_user_time_idx']
      ];
      
      for (const [table, indexName] of indexes) {
        try {
          await queryInterface.removeIndex(table, indexName, { transaction });
        } catch (e) {
          // Index might not exist
        }
      }
      
      await transaction.commit();
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};