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
const EventType = require('./event-type.model');
const Poll = require('./poll.model');
const PollTimeSlot = require('./poll-time-slot.model');
const PollVote = require('./poll-vote.model');

// Initialize associations after all models are loaded
const { defineAssociations } = require('./associations');
defineAssociations();

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
  Invoice,
  EventType,
  Poll,
  PollTimeSlot,
  PollVote
};
