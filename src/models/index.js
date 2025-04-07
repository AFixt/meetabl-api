/**
 * Models index file
 *
 * Exports all models and establishes relationships
 *
 * @author AccessMeet Team
 */

const User = require('./user.model');
const CalendarToken = require('./calendar-token.model');
const AvailabilityRule = require('./availability-rule.model');
const Booking = require('./booking.model');
const Notification = require('./notification.model');
const UserSettings = require('./user-settings.model');
const AuditLog = require('./audit-log.model');

// Note: Relationships are defined in individual model files
// This ensures proper loading order regardless of import order

module.exports = {
  User,
  CalendarToken,
  AvailabilityRule,
  Booking,
  Notification,
  UserSettings,
  AuditLog
};
