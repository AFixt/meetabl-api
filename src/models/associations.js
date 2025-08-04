/**
 * Model associations
 *
 * Defines all Sequelize model relationships in one place
 * to avoid circular dependency issues
 *
 * @author meetabl Team
 */

// Import all models
const User = require('./user.model');
const Booking = require('./booking.model');
const BookingRequest = require('./bookingRequest.model');
const CalendarToken = require('./calendar-token.model');
const AvailabilityRule = require('./availability-rule.model');
const Notification = require('./notification.model');
const UserSettings = require('./user-settings.model');
const AuditLog = require('./audit-log.model');
const JwtBlacklist = require('./jwt-blacklist.model');
const Team = require('./team.model');
const TeamMember = require('./team-member.model');
const Payment = require('./payment.model');
const PricingRule = require('./pricing-rule.model');
const Invoice = require('./invoice.model');
const EventType = require('./event-type.model');

/**
 * Define all model associations
 */
function defineAssociations() {
  // User associations
  User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
  User.hasMany(BookingRequest, { foreignKey: 'userId', as: 'bookingRequests' });
  User.hasMany(CalendarToken, { foreignKey: 'userId', as: 'calendarTokens' });
  User.hasMany(AvailabilityRule, { foreignKey: 'userId', as: 'availabilityRules' });
  User.hasMany(EventType, { foreignKey: 'userId', as: 'eventTypes' });
  // Notifications are linked to users through bookings, not directly
  User.hasOne(UserSettings, { foreignKey: 'userId', as: 'settings' });
  User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
  User.hasMany(TeamMember, { foreignKey: 'user_id', as: 'memberships' }); // Fixed field name and alias
  User.hasMany(Team, { foreignKey: 'owner_id', as: 'ownedTeams' }); // Added owned teams
  User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });

  // Booking associations
  Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Booking.hasMany(Notification, { foreignKey: 'bookingId', as: 'notifications' });

  // BookingRequest associations
  BookingRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // CalendarToken associations
  CalendarToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // AvailabilityRule associations
  AvailabilityRule.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // Notification associations
  // Notifications are linked to users through bookings, not directly
  Notification.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

  // UserSettings associations
  UserSettings.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // AuditLog associations
  AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // Team associations
  Team.hasMany(TeamMember, { foreignKey: 'team_id', as: 'members' });
  Team.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

  // TeamMember associations
  TeamMember.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });
  TeamMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // Payment associations
  Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Payment.hasMany(Invoice, { foreignKey: 'paymentId', as: 'invoices' });

  // PricingRule associations - if there are specific relationships needed

  // Invoice associations
  Invoice.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });

  // EventType associations
  EventType.belongsTo(User, { foreignKey: 'userId', as: 'user' });
}

module.exports = {
  defineAssociations
};