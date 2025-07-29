/**
 * Models index file
 *
 * Exports all models and establishes relationships
 *
 * @author meetabl Team
 */

const User = require('./user.model');
const CalendarToken = require('./calendar-token.model');
const AvailabilityRule = require('./availability-rule.model');
const Booking = require('./booking.model');
const BookingRequest = require('./bookingRequest.model');
const Notification = require('./notification.model');
const UserSettings = require('./user-settings.model');
const AuditLog = require('./audit-log.model');
const JwtBlacklist = require('./jwt-blacklist.model');
const Team = require('./team.model');
const TeamMember = require('./team-member.model');
const Payment = require('./payment.model');
const PricingRule = require('./pricing-rule.model');
const Invoice = require('./invoice.model');

// Note: Relationships are defined in individual model files
// This ensures proper loading order regardless of import order

module.exports = {
  User,
  CalendarToken,
  AvailabilityRule,
  Booking,
  BookingRequest,
  Notification,
  UserSettings,
  AuditLog,
  JwtBlacklist,
  Team,
  TeamMember,
  Payment,
  PricingRule,
  Invoice
};
