/**
 * Test Data Factory
 * 
 * Generates realistic test data for various testing scenarios
 * Provides consistent, repeatable data for E2E and integration tests
 */

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { faker } = require('@faker-js/faker');

class TestDataFactory {
  constructor() {
    // Set seed for reproducible test data
    faker.seed(12345);
  }

  /**
   * Generate a test user with realistic data
   */
  async generateUser(overrides = {}) {
    const hashedPassword = await bcrypt.hash(overrides.password || 'TestPass123!', 10);
    
    return {
      email: overrides.email || faker.internet.email(),
      password: hashedPassword,
      firstName: overrides.firstName || faker.person.firstName(),
      lastName: overrides.lastName || faker.person.lastName(),
      username: overrides.username || faker.internet.userName(),
      role: overrides.role || 'user',
      status: overrides.status || 'active',
      emailVerified: overrides.emailVerified !== undefined ? overrides.emailVerified : true,
      publicProfileEnabled: overrides.publicProfileEnabled !== undefined ? overrides.publicProfileEnabled : true,
      created: new Date(),
      updated: new Date(),
      ...overrides
    };
  }

  /**
   * Generate user settings with realistic preferences
   */
  generateUserSettings(userId, overrides = {}) {
    const timezones = [
      'America/New_York',
      'America/Los_Angeles', 
      'America/Chicago',
      'America/Denver',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Australia/Sydney'
    ];

    return {
      userId,
      meetingDuration: overrides.meetingDuration || faker.helpers.arrayElement([15, 30, 45, 60]),
      bufferTime: overrides.bufferTime || faker.helpers.arrayElement([0, 5, 10, 15]),
      timezone: overrides.timezone || faker.helpers.arrayElement(timezones),
      language: overrides.language || 'en',
      notificationPreferences: JSON.stringify(overrides.notificationPreferences || {
        email: faker.datatype.boolean(),
        sms: faker.datatype.boolean(),
        push: faker.datatype.boolean(),
        bookingConfirmation: true,
        bookingReminder: faker.datatype.boolean(),
        bookingCancellation: true
      }),
      bookingHorizon: overrides.bookingHorizon || faker.number.int({ min: 7, max: 180 }),
      googleAnalyticsId: overrides.googleAnalyticsId || (faker.datatype.boolean() ? `GA-${faker.number.int({ min: 100000, max: 999999 })}` : null),
      logoUrl: overrides.logoUrl || null,
      logoPublicId: overrides.logoPublicId || null,
      phoneNumber: overrides.phoneNumber || (faker.datatype.boolean() ? faker.phone.number() : null),
      created: new Date(),
      updated: new Date(),
      ...overrides
    };
  }

  /**
   * Generate availability rules for a user
   */
  generateAvailabilityRules(userId, pattern = 'standard') {
    const rules = [];
    
    switch (pattern) {
      case 'standard': // Monday-Friday, 9-5
        for (let day = 1; day <= 5; day++) {
          rules.push({
            userId,
            dayOfWeek: day,
            startTime: '09:00:00',
            endTime: '17:00:00',
            isAvailable: true,
            created: new Date(),
            updated: new Date()
          });
        }
        break;
        
      case 'extended': // Monday-Saturday, 8-6
        for (let day = 1; day <= 6; day++) {
          rules.push({
            userId,
            dayOfWeek: day,
            startTime: '08:00:00',
            endTime: '18:00:00',
            isAvailable: true,
            created: new Date(),
            updated: new Date()
          });
        }
        break;
        
      case 'flexible': // Tuesday, Thursday, Saturday with varying hours
        [
          { day: 2, start: '10:00:00', end: '14:00:00' },
          { day: 4, start: '13:00:00', end: '17:00:00' },
          { day: 6, start: '09:00:00', end: '12:00:00' }
        ].forEach(({ day, start, end }) => {
          rules.push({
            userId,
            dayOfWeek: day,
            startTime: start,
            endTime: end,
            isAvailable: true,
            created: new Date(),
            updated: new Date()
          });
        });
        break;
        
      case '24-7': // All week, all day
        for (let day = 1; day <= 7; day++) {
          rules.push({
            userId,
            dayOfWeek: day,
            startTime: '00:00:00',
            endTime: '23:59:59',
            isAvailable: true,
            created: new Date(),
            updated: new Date()
          });
        }
        break;
        
      default:
        // Random pattern
        const availableDays = faker.helpers.arrayElements([1, 2, 3, 4, 5, 6, 7], { min: 2, max: 6 });
        availableDays.forEach(day => {
          const startHour = faker.number.int({ min: 7, max: 10 });
          const endHour = faker.number.int({ min: 16, max: 20 });
          
          rules.push({
            userId,
            dayOfWeek: day,
            startTime: `${startHour.toString().padStart(2, '0')}:00:00`,
            endTime: `${endHour.toString().padStart(2, '0')}:00:00`,
            isAvailable: true,
            created: new Date(),
            updated: new Date()
          });
        });
    }
    
    return rules;
  }

  /**
   * Generate a booking with realistic data
   */
  generateBooking(userId, overrides = {}) {
    const now = new Date();
    const startTime = overrides.startTime || faker.date.future({ years: 0.5, refDate: now });
    const durationMinutes = overrides.duration || faker.helpers.arrayElement([15, 30, 45, 60]);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    const statuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    const locations = [
      'Zoom Meeting',
      'Microsoft Teams',
      'Google Meet',
      'Phone Call',
      'In-Person Office',
      'Conference Room A',
      'Client Office'
    ];

    const titles = [
      'Initial Consultation',
      'Follow-up Meeting',
      'Project Review',
      'Strategy Session',
      'Technical Discussion',
      'Requirement Gathering',
      'Progress Update',
      'Final Presentation'
    ];

    return {
      userId,
      guestEmail: overrides.guestEmail || faker.internet.email(),
      guestName: overrides.guestName || faker.person.fullName(),
      title: overrides.title || faker.helpers.arrayElement(titles),
      description: overrides.description || faker.lorem.sentences(2),
      startTime,
      endTime,
      status: overrides.status || faker.helpers.arrayElement(statuses),
      location: overrides.location || faker.helpers.arrayElement(locations),
      meetingLink: overrides.meetingLink || (faker.datatype.boolean() ? faker.internet.url() : null),
      confirmationToken: uuidv4(),
      cancellationReason: overrides.status === 'cancelled' ? faker.lorem.sentence() : null,
      isRecurring: overrides.isRecurring || false,
      recurrencePattern: overrides.isRecurring ? faker.helpers.arrayElement(['daily', 'weekly', 'monthly']) : null,
      created: new Date(),
      updated: new Date(),
      ...overrides
    };
  }

  /**
   * Generate multiple bookings for stress testing
   */
  generateBookings(userId, count = 10, options = {}) {
    const bookings = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      // Create bookings spread over the next 90 days
      const daysOffset = faker.number.int({ min: 1, max: 90 });
      const startTime = new Date(now);
      startTime.setDate(startTime.getDate() + daysOffset);
      startTime.setHours(faker.number.int({ min: 9, max: 17 }), faker.helpers.arrayElement([0, 15, 30, 45]), 0, 0);
      
      bookings.push(this.generateBooking(userId, {
        startTime,
        ...options
      }));
    }
    
    return bookings;
  }

  /**
   * Generate conflicting bookings for testing conflict resolution
   */
  generateConflictingBookings(userId, baseStartTime, overrides = {}) {
    const baseEndTime = new Date(baseStartTime.getTime() + 30 * 60000); // 30 minutes
    
    return [
      // Original booking
      this.generateBooking(userId, {
        startTime: baseStartTime,
        endTime: baseEndTime,
        status: 'confirmed',
        title: 'Original Booking',
        ...overrides
      }),
      
      // Overlapping booking (starts 15 minutes later)
      this.generateBooking(userId, {
        startTime: new Date(baseStartTime.getTime() + 15 * 60000),
        endTime: new Date(baseStartTime.getTime() + 45 * 60000),
        status: 'pending',
        title: 'Conflicting Booking',
        ...overrides
      })
    ];
  }

  /**
   * Generate team data
   */
  generateTeam(ownerId, overrides = {}) {
    return {
      name: overrides.name || faker.company.name() + ' Team',
      description: overrides.description || faker.lorem.sentence(),
      ownerId,
      settings: JSON.stringify(overrides.settings || {
        allowMemberBookings: faker.datatype.boolean(),
        requireApproval: faker.datatype.boolean(),
        defaultMeetingDuration: faker.helpers.arrayElement([15, 30, 45, 60])
      }),
      created: new Date(),
      updated: new Date(),
      ...overrides
    };
  }

  /**
   * Generate team member
   */
  generateTeamMember(teamId, userId, role = 'member', overrides = {}) {
    const permissions = {
      owner: {
        canManageTeam: true,
        canManageMembers: true,
        canViewAllBookings: true,
        canCreateBookings: true
      },
      admin: {
        canManageTeam: false,
        canManageMembers: true,
        canViewAllBookings: true,
        canCreateBookings: true
      },
      member: {
        canManageTeam: false,
        canManageMembers: false,
        canViewAllBookings: false,
        canCreateBookings: true
      }
    };

    return {
      teamId,
      userId,
      role,
      permissions: JSON.stringify(overrides.permissions || permissions[role]),
      joinedAt: overrides.joinedAt || faker.date.past(),
      created: new Date(),
      updated: new Date(),
      ...overrides
    };
  }

  /**
   * Generate notification
   */
  generateNotification(userId, bookingId, overrides = {}) {
    const types = ['booking_confirmation', 'booking_reminder', 'booking_cancellation', 'booking_update'];
    const channels = ['email', 'sms', 'push'];
    const statuses = ['pending', 'sent', 'failed'];

    return {
      userId,
      bookingId,
      type: overrides.type || faker.helpers.arrayElement(types),
      channel: overrides.channel || faker.helpers.arrayElement(channels),
      recipient: overrides.recipient || faker.internet.email(),
      subject: overrides.subject || faker.lorem.sentence(),
      content: overrides.content || faker.lorem.paragraphs(2),
      status: overrides.status || faker.helpers.arrayElement(statuses),
      sentAt: overrides.status === 'sent' ? new Date() : null,
      scheduledFor: overrides.scheduledFor || faker.date.future(),
      created: new Date(),
      updated: new Date(),
      ...overrides
    };
  }

  /**
   * Generate calendar token for testing integrations
   */
  generateCalendarToken(userId, provider = 'google', overrides = {}) {
    const providers = {
      google: {
        scope: 'https://www.googleapis.com/auth/calendar',
        accessToken: 'fake_google_access_token',
        refreshToken: 'fake_google_refresh_token'
      },
      microsoft: {
        scope: 'https://graph.microsoft.com/calendars.readwrite',
        accessToken: 'fake_microsoft_access_token',
        refreshToken: 'fake_microsoft_refresh_token'
      }
    };

    return {
      userId,
      provider,
      accessToken: overrides.accessToken || providers[provider].accessToken + '_' + faker.string.alphanumeric(20),
      refreshToken: overrides.refreshToken || providers[provider].refreshToken + '_' + faker.string.alphanumeric(20),
      expiresAt: overrides.expiresAt || new Date(Date.now() + 3600000), // 1 hour from now
      scope: overrides.scope || providers[provider].scope,
      created: new Date(),
      updated: new Date(),
      ...overrides
    };
  }

  /**
   * Generate audit log entry
   */
  generateAuditLog(userId, overrides = {}) {
    const actions = [
      'user_login',
      'user_logout',
      'booking_created',
      'booking_updated',
      'booking_cancelled',
      'settings_updated',
      'team_created',
      'team_member_added'
    ];

    const resourceTypes = ['User', 'Booking', 'Team', 'Settings'];

    return {
      userId,
      action: overrides.action || faker.helpers.arrayElement(actions),
      resourceType: overrides.resourceType || faker.helpers.arrayElement(resourceTypes),
      resourceId: overrides.resourceId || faker.number.int({ min: 1, max: 9999 }).toString(),
      details: JSON.stringify(overrides.details || {
        ip: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        timestamp: new Date().toISOString()
      }),
      created: new Date(),
      ...overrides
    };
  }

  /**
   * Generate a complete test scenario with related data
   */
  async generateCompleteScenario(scenarioType = 'standard') {
    const scenarios = {
      standard: async () => {
        const user = await this.generateUser({ email: 'test-standard@example.com' });
        const settings = this.generateUserSettings(user.id);
        const availability = this.generateAvailabilityRules(user.id, 'standard');
        const bookings = this.generateBookings(user.id, 5);
        
        return { user, settings, availability, bookings };
      },

      teamCollaboration: async () => {
        const owner = await this.generateUser({ email: 'team-owner@example.com', role: 'user' });
        const members = await Promise.all([
          this.generateUser({ email: 'team-member1@example.com' }),
          this.generateUser({ email: 'team-member2@example.com' })
        ]);
        
        const team = this.generateTeam(owner.id);
        const teamMembers = [
          this.generateTeamMember(team.id, owner.id, 'owner'),
          ...members.map(member => this.generateTeamMember(team.id, member.id, 'member'))
        ];
        
        return { owner, members, team, teamMembers };
      },

      calendarIntegration: async () => {
        const user = await this.generateUser({ email: 'calendar-user@example.com' });
        const googleToken = this.generateCalendarToken(user.id, 'google');
        const microsoftToken = this.generateCalendarToken(user.id, 'microsoft');
        
        return { user, tokens: [googleToken, microsoftToken] };
      },

      conflictScenario: async () => {
        const user = await this.generateUser({ email: 'conflict-user@example.com' });
        const baseTime = new Date();
        baseTime.setDate(baseTime.getDate() + 1);
        baseTime.setHours(10, 0, 0, 0);
        
        const conflictingBookings = this.generateConflictingBookings(user.id, baseTime);
        
        return { user, bookings: conflictingBookings };
      }
    };

    return scenarios[scenarioType] ? await scenarios[scenarioType]() : await scenarios.standard();
  }

  /**
   * Reset faker seed for reproducible tests
   */
  resetSeed(seed = 12345) {
    faker.seed(seed);
  }
}

module.exports = new TestDataFactory();