/**
 * E2E Test Data Seeder
 * 
 * This seeder creates consistent test data for E2E testing scenarios
 * It includes realistic test users, bookings, and configurations
 */

'use strict';
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    const now = new Date();
    
    // Helper function to create dates for testing
    function createTestDate(daysOffset, hour = 9, minute = 0) {
      const date = new Date(now);
      date.setDate(date.getDate() + daysOffset);
      date.setHours(hour, minute, 0, 0);
      return date;
    }

    // Insert E2E test users with specific roles and configurations
    await queryInterface.bulkInsert('Users', [
      {
        id: 1001,
        email: 'e2e-admin@test.com',
        password: hashedPassword,
        firstName: 'E2E Admin',
        lastName: 'User',
        username: 'e2eadmin',
        role: 'admin',
        status: 'active',
        emailVerified: true,
        publicProfileEnabled: true,
        created: new Date(),
        updated: new Date()
      },
      {
        id: 1002,
        email: 'e2e-host@test.com',
        password: hashedPassword,
        firstName: 'E2E Host',
        lastName: 'User',
        username: 'e2ehost',
        role: 'user',
        status: 'active',
        emailVerified: true,
        publicProfileEnabled: true,
        created: new Date(),
        updated: new Date()
      },
      {
        id: 1003,
        email: 'e2e-guest@test.com',
        password: hashedPassword,
        firstName: 'E2E Guest',
        lastName: 'User',
        username: 'e2eguest',
        role: 'user',
        status: 'active',
        emailVerified: true,
        publicProfileEnabled: false,
        created: new Date(),
        updated: new Date()
      },
      {
        id: 1004,
        email: 'e2e-pending@test.com',
        password: hashedPassword,
        firstName: 'E2E Pending',
        lastName: 'User',
        username: 'e2epending',
        role: 'user',
        status: 'pending',
        emailVerified: false,
        publicProfileEnabled: false,
        created: new Date(),
        updated: new Date()
      },
      {
        id: 1005,
        email: 'e2e-teamlead@test.com',
        password: hashedPassword,
        firstName: 'E2E Team Lead',
        lastName: 'User',
        username: 'e2eteamlead',
        role: 'user',
        status: 'active',
        emailVerified: true,
        publicProfileEnabled: true,
        created: new Date(),
        updated: new Date()
      }
    ]);

    // Insert user settings for E2E test users
    await queryInterface.bulkInsert('UserSettings', [
      {
        userId: 1001,
        meetingDuration: 60,
        bufferTime: 15,
        timezone: 'America/New_York',
        language: 'en',
        notificationPreferences: JSON.stringify({ 
          email: true, 
          sms: true,
          push: true,
          bookingConfirmation: true,
          bookingReminder: true,
          bookingCancellation: true
        }),
        bookingHorizon: 90,
        googleAnalyticsId: 'GA-TEST-123456',
        logoUrl: null,
        logoPublicId: null,
        phoneNumber: '+1234567890',
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 1002,
        meetingDuration: 30,
        bufferTime: 10,
        timezone: 'America/Los_Angeles',
        language: 'en',
        notificationPreferences: JSON.stringify({ 
          email: true, 
          sms: false,
          push: true,
          bookingConfirmation: true,
          bookingReminder: true,
          bookingCancellation: false
        }),
        bookingHorizon: 60,
        googleAnalyticsId: null,
        logoUrl: null,
        logoPublicId: null,
        phoneNumber: '+1987654321',
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 1003,
        meetingDuration: 45,
        bufferTime: 5,
        timezone: 'Europe/London',
        language: 'en',
        notificationPreferences: JSON.stringify({ 
          email: true, 
          sms: false,
          push: false,
          bookingConfirmation: true,
          bookingReminder: false,
          bookingCancellation: true
        }),
        bookingHorizon: 30,
        googleAnalyticsId: null,
        logoUrl: null,
        logoPublicId: null,
        phoneNumber: null,
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 1005,
        meetingDuration: 30,
        bufferTime: 15,
        timezone: 'America/Chicago',
        language: 'en',
        notificationPreferences: JSON.stringify({ 
          email: true, 
          sms: true,
          push: true,
          bookingConfirmation: true,
          bookingReminder: true,
          bookingCancellation: true
        }),
        bookingHorizon: 45,
        googleAnalyticsId: 'GA-TEAM-789012',
        logoUrl: null,
        logoPublicId: null,
        phoneNumber: '+1555123456',
        created: new Date(),
        updated: new Date()
      }
    ]);

    // Insert comprehensive availability rules for testing
    const availabilityRules = [];
    
    // Admin user: Full week availability (Monday-Sunday)
    for (let day = 1; day <= 7; day++) {
      availabilityRules.push({
        userId: 1001,
        dayOfWeek: day,
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      });
    }
    
    // Host user: Weekday availability (Monday-Friday)
    for (let day = 1; day <= 5; day++) {
      availabilityRules.push({
        userId: 1002,
        dayOfWeek: day,
        startTime: '09:00:00',
        endTime: '17:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      });
    }
    
    // Guest user: Limited availability (Tuesday, Thursday, Saturday)
    [2, 4, 6].forEach(day => {
      availabilityRules.push({
        userId: 1003,
        dayOfWeek: day,
        startTime: '10:00:00',
        endTime: '15:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      });
    });
    
    // Team lead: Extended weekday hours
    for (let day = 1; day <= 5; day++) {
      availabilityRules.push({
        userId: 1005,
        dayOfWeek: day,
        startTime: '07:00:00',
        endTime: '19:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      });
    }

    await queryInterface.bulkInsert('AvailabilityRules', availabilityRules);

    // Insert comprehensive booking scenarios for E2E testing
    await queryInterface.bulkInsert('Bookings', [
      // Confirmed future booking
      {
        id: 2001,
        userId: 1002,
        guestEmail: 'e2e-client1@test.com',
        guestName: 'E2E Test Client One',
        title: 'Initial Consultation - E2E Test',
        description: 'Testing booking creation and confirmation flow',
        startTime: createTestDate(1, 10, 0), // Tomorrow at 10 AM
        endTime: createTestDate(1, 10, 30), // Tomorrow at 10:30 AM
        status: 'confirmed',
        location: 'Zoom Meeting Room',
        meetingLink: 'https://zoom.us/j/123456789',
        confirmationToken: uuidv4(),
        created: new Date(),
        updated: new Date()
      },
      
      // Pending booking awaiting confirmation
      {
        id: 2002,
        userId: 1002,
        guestEmail: 'e2e-client2@test.com',
        guestName: 'E2E Test Client Two',
        title: 'Follow-up Meeting - E2E Test',
        description: 'Testing pending booking status and confirmation flow',
        startTime: createTestDate(2, 14, 0), // Day after tomorrow at 2 PM
        endTime: createTestDate(2, 14, 30), // Day after tomorrow at 2:30 PM
        status: 'pending',
        location: 'Microsoft Teams',
        meetingLink: null,
        confirmationToken: uuidv4(),
        created: new Date(),
        updated: new Date()
      },
      
      // Cancelled booking for testing cancellation flow
      {
        id: 2003,
        userId: 1003,
        guestEmail: 'e2e-client3@test.com',
        guestName: 'E2E Test Client Three',
        title: 'Cancelled Meeting - E2E Test',
        description: 'Testing booking cancellation flow',
        startTime: createTestDate(3, 11, 0), // In 3 days at 11 AM
        endTime: createTestDate(3, 11, 45), // In 3 days at 11:45 AM
        status: 'cancelled',
        location: 'Google Meet',
        meetingLink: 'https://meet.google.com/xyz-abc-def',
        confirmationToken: uuidv4(),
        cancellationReason: 'Client requested cancellation for testing',
        created: new Date(),
        updated: new Date()
      },
      
      // Past completed booking
      {
        id: 2004,
        userId: 1001,
        guestEmail: 'e2e-client4@test.com',
        guestName: 'E2E Test Client Four',
        title: 'Completed Meeting - E2E Test',
        description: 'Testing completed booking status',
        startTime: createTestDate(-1, 15, 0), // Yesterday at 3 PM
        endTime: createTestDate(-1, 16, 0), // Yesterday at 4 PM
        status: 'completed',
        location: 'In-Person Office',
        meetingLink: null,
        confirmationToken: uuidv4(),
        created: new Date(),
        updated: new Date()
      },
      
      // Booking with conflict for testing conflict resolution
      {
        id: 2005,
        userId: 1002,
        guestEmail: 'e2e-conflict@test.com',
        guestName: 'E2E Conflict Test',
        title: 'Conflict Test Meeting',
        description: 'Testing booking conflict scenarios',
        startTime: createTestDate(1, 10, 15), // Tomorrow at 10:15 AM (overlaps with booking 2001)
        endTime: createTestDate(1, 10, 45), // Tomorrow at 10:45 AM
        status: 'pending',
        location: 'Phone Call',
        meetingLink: null,
        confirmationToken: uuidv4(),
        created: new Date(),
        updated: new Date()
      },
      
      // Recurring booking series for testing recurring bookings
      {
        id: 2006,
        userId: 1005,
        guestEmail: 'e2e-recurring@test.com',
        guestName: 'E2E Recurring Test',
        title: 'Weekly Team Standup - E2E Test',
        description: 'Testing recurring booking functionality',
        startTime: createTestDate(7, 9, 0), // Next week at 9 AM
        endTime: createTestDate(7, 9, 30), // Next week at 9:30 AM
        status: 'confirmed',
        location: 'Conference Room A',
        meetingLink: null,
        confirmationToken: uuidv4(),
        isRecurring: true,
        recurrencePattern: 'weekly',
        created: new Date(),
        updated: new Date()
      }
    ]);

    // Insert calendar tokens for testing calendar integration
    await queryInterface.bulkInsert('CalendarTokens', [
      {
        userId: 1001,
        provider: 'google',
        accessToken: 'fake_google_access_token_for_testing',
        refreshToken: 'fake_google_refresh_token_for_testing',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        scope: 'https://www.googleapis.com/auth/calendar',
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 1002,
        provider: 'microsoft',
        accessToken: 'fake_microsoft_access_token_for_testing',
        refreshToken: 'fake_microsoft_refresh_token_for_testing',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        scope: 'https://graph.microsoft.com/calendars.readwrite',
        created: new Date(),
        updated: new Date()
      }
    ]);

    // Insert notifications for testing notification system
    await queryInterface.bulkInsert('Notifications', [
      {
        userId: 1002,
        bookingId: 2001,
        type: 'booking_confirmation',
        channel: 'email',
        recipient: 'e2e-host@test.com',
        subject: 'Booking Confirmed - E2E Test',
        content: 'Your booking has been confirmed for testing purposes.',
        status: 'sent',
        sentAt: new Date(),
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 1002,
        bookingId: 2002,
        type: 'booking_reminder',
        channel: 'email',
        recipient: 'e2e-host@test.com',
        subject: 'Booking Reminder - E2E Test',
        content: 'Reminder: You have a booking coming up for testing.',
        status: 'pending',
        scheduledFor: createTestDate(2, 9, 0), // Day before booking
        created: new Date(),
        updated: new Date()
      }
    ]);

    // Insert team data for testing team collaboration features
    await queryInterface.bulkInsert('Teams', [
      {
        id: 3001,
        name: 'E2E Test Team',
        description: 'Team created for E2E testing purposes',
        ownerId: 1005,
        settings: JSON.stringify({
          allowMemberBookings: true,
          requireApproval: false,
          defaultMeetingDuration: 30
        }),
        created: new Date(),
        updated: new Date()
      }
    ]);

    await queryInterface.bulkInsert('TeamMembers', [
      {
        teamId: 3001,
        userId: 1005,
        role: 'owner',
        permissions: JSON.stringify({
          canManageTeam: true,
          canManageMembers: true,
          canViewAllBookings: true,
          canCreateBookings: true
        }),
        joinedAt: new Date(),
        created: new Date(),
        updated: new Date()
      },
      {
        teamId: 3001,
        userId: 1002,
        role: 'member',
        permissions: JSON.stringify({
          canManageTeam: false,
          canManageMembers: false,
          canViewAllBookings: false,
          canCreateBookings: true
        }),
        joinedAt: new Date(),
        created: new Date(),
        updated: new Date()
      }
    ]);

    // Insert audit logs for testing audit functionality
    await queryInterface.bulkInsert('AuditLogs', [
      {
        userId: 1001,
        action: 'user_login',
        resourceType: 'User',
        resourceId: '1001',
        details: JSON.stringify({
          ip: '127.0.0.1',
          userAgent: 'E2E Test Browser',
          timestamp: new Date().toISOString()
        }),
        created: new Date()
      },
      {
        userId: 1002,
        action: 'booking_created',
        resourceType: 'Booking',
        resourceId: '2001',
        details: JSON.stringify({
          bookingTitle: 'Initial Consultation - E2E Test',
          guestEmail: 'e2e-client1@test.com',
          timestamp: new Date().toISOString()
        }),
        created: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Remove E2E test data in reverse order to maintain referential integrity
    await queryInterface.bulkDelete('AuditLogs', { userId: { [Sequelize.Op.in]: [1001, 1002, 1003, 1004, 1005] } });
    await queryInterface.bulkDelete('TeamMembers', { teamId: 3001 });
    await queryInterface.bulkDelete('Teams', { id: 3001 });
    await queryInterface.bulkDelete('Notifications', { userId: { [Sequelize.Op.in]: [1001, 1002, 1003, 1004, 1005] } });
    await queryInterface.bulkDelete('CalendarTokens', { userId: { [Sequelize.Op.in]: [1001, 1002, 1003, 1004, 1005] } });
    await queryInterface.bulkDelete('Bookings', { id: { [Sequelize.Op.in]: [2001, 2002, 2003, 2004, 2005, 2006] } });
    await queryInterface.bulkDelete('AvailabilityRules', { userId: { [Sequelize.Op.in]: [1001, 1002, 1003, 1004, 1005] } });
    await queryInterface.bulkDelete('UserSettings', { userId: { [Sequelize.Op.in]: [1001, 1002, 1003, 1004, 1005] } });
    await queryInterface.bulkDelete('Users', { id: { [Sequelize.Op.in]: [1001, 1002, 1003, 1004, 1005] } });
  }
};