/**
 * Add performance indexes for frequently queried columns
 * 
 * This migration adds database indexes to improve query performance
 * for common lookup patterns identified in the application.
 */

'use strict';

module.exports = {
  async up(queryInterface) {
    // Bookings table indexes
    await queryInterface.addIndex('bookings', {
      fields: ['user_id'],
      name: 'idx_bookings_user_id'
    });

    await queryInterface.addIndex('bookings', {
      fields: ['start_time'],
      name: 'idx_bookings_start_time'
    });

    await queryInterface.addIndex('bookings', {
      fields: ['end_time'],
      name: 'idx_bookings_end_time'
    });

    await queryInterface.addIndex('bookings', {
      fields: ['status'],
      name: 'idx_bookings_status'
    });

    // Composite index for common booking queries (user + time range)
    await queryInterface.addIndex('bookings', {
      fields: ['user_id', 'start_time'],
      name: 'idx_bookings_user_start_time'
    });

    // Composite index for time range queries
    await queryInterface.addIndex('bookings', {
      fields: ['start_time', 'end_time'],
      name: 'idx_bookings_time_range'
    });

    // Index for customer email lookups in bookings
    await queryInterface.addIndex('bookings', {
      fields: ['customer_email'],
      name: 'idx_bookings_customer_email'
    });

    // Index for created timestamps (useful for pagination and recent records)
    await queryInterface.addIndex('bookings', {
      fields: ['created'],
      name: 'idx_bookings_created'
    });

    // Index for external calendar event ID lookups
    await queryInterface.addIndex('bookings', {
      fields: ['calendar_event_id'],
      name: 'idx_bookings_calendar_event_id'
    });

    // AvailabilityRules table indexes (if exists)
    try {
      await queryInterface.addIndex('availability_rules', {
        fields: ['user_id'],
        name: 'idx_availability_rules_user_id'
      });

      await queryInterface.addIndex('availability_rules', {
        fields: ['day_of_week'],
        name: 'idx_availability_rules_day_of_week'
      });

      // Composite index for user availability lookups (most common query)
      await queryInterface.addIndex('availability_rules', {
        fields: ['user_id', 'day_of_week'],
        name: 'idx_availability_rules_user_day'
      });
    } catch (error) {
      console.log('AvailabilityRules table does not exist, skipping indexes');
    }

    // CalendarTokens table indexes
    try {
      await queryInterface.addIndex('calendar_tokens', {
        fields: ['user_id'],
        name: 'idx_calendar_tokens_user_id'
      });

      await queryInterface.addIndex('calendar_tokens', {
        fields: ['provider'],
        name: 'idx_calendar_tokens_provider'
      });

      await queryInterface.addIndex('calendar_tokens', {
        fields: ['expires_at'],
        name: 'idx_calendar_tokens_expires_at'
      });

      // Composite index for token lookups
      await queryInterface.addIndex('calendar_tokens', {
        fields: ['user_id', 'provider'],
        name: 'idx_calendar_tokens_user_provider'
      });
    } catch (error) {
      console.log('CalendarTokens table does not exist, skipping indexes');
    }

    // Notifications table indexes (if exists)
    try {
      await queryInterface.addIndex('notifications', {
        fields: ['user_id'],
        name: 'idx_notifications_user_id'
      });

      await queryInterface.addIndex('notifications', {
        fields: ['booking_id'],
        name: 'idx_notifications_booking_id'
      });

      await queryInterface.addIndex('notifications', {
        fields: ['status'],
        name: 'idx_notifications_status'
      });

      await queryInterface.addIndex('notifications', {
        fields: ['recipient'],
        name: 'idx_notifications_recipient'
      });

      await queryInterface.addIndex('notifications', {
        fields: ['created'],
        name: 'idx_notifications_created'
      });
    } catch (error) {
      console.log('Notifications table does not exist, skipping indexes');
    }

    // AuditLogs table indexes (if exists)
    try {
      await queryInterface.addIndex('audit_logs', {
        fields: ['user_id'],
        name: 'idx_audit_logs_user_id'
      });

      await queryInterface.addIndex('audit_logs', {
        fields: ['entity'],
        name: 'idx_audit_logs_entity'
      });

      await queryInterface.addIndex('audit_logs', {
        fields: ['entity_id'],
        name: 'idx_audit_logs_entity_id'
      });

      await queryInterface.addIndex('audit_logs', {
        fields: ['created'],
        name: 'idx_audit_logs_created'
      });
    } catch (error) {
      console.log('AuditLogs table does not exist, skipping indexes');
    }
  },

  async down(queryInterface) {
    // Remove all indexes
    const indexes = [
      { table: 'bookings', name: 'idx_bookings_calendar_event_id' },
      { table: 'bookings', name: 'idx_bookings_created' },
      { table: 'bookings', name: 'idx_bookings_customer_email' },
      { table: 'bookings', name: 'idx_bookings_time_range' },
      { table: 'bookings', name: 'idx_bookings_user_start_time' },
      { table: 'bookings', name: 'idx_bookings_status' },
      { table: 'bookings', name: 'idx_bookings_end_time' },
      { table: 'bookings', name: 'idx_bookings_start_time' },
      { table: 'bookings', name: 'idx_bookings_user_id' },
      { table: 'availability_rules', name: 'idx_availability_rules_user_day' },
      { table: 'availability_rules', name: 'idx_availability_rules_day_of_week' },
      { table: 'availability_rules', name: 'idx_availability_rules_user_id' },
      { table: 'calendar_tokens', name: 'idx_calendar_tokens_user_provider' },
      { table: 'calendar_tokens', name: 'idx_calendar_tokens_expires_at' },
      { table: 'calendar_tokens', name: 'idx_calendar_tokens_provider' },
      { table: 'calendar_tokens', name: 'idx_calendar_tokens_user_id' },
      { table: 'notifications', name: 'idx_notifications_created' },
      { table: 'notifications', name: 'idx_notifications_recipient' },
      { table: 'notifications', name: 'idx_notifications_status' },
      { table: 'notifications', name: 'idx_notifications_booking_id' },
      { table: 'notifications', name: 'idx_notifications_user_id' },
      { table: 'audit_logs', name: 'idx_audit_logs_created' },
      { table: 'audit_logs', name: 'idx_audit_logs_entity_id' },
      { table: 'audit_logs', name: 'idx_audit_logs_entity' },
      { table: 'audit_logs', name: 'idx_audit_logs_user_id' }
    ];

    for (const index of indexes) {
      try {
        await queryInterface.removeIndex(index.table, index.name);
      } catch (error) {
        // Index might not exist, continue
      }
    }
  }
};