/**
 * Demo data seeder
 */

'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Insert demo users
    const users = await queryInterface.bulkInsert('Users', [
      {
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        status: 'active',
        created: new Date(),
        updated: new Date()
      },
      {
        email: 'user@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        status: 'active',
        created: new Date(),
        updated: new Date()
      }
    ], { returning: true });
    
    // Insert user settings
    await queryInterface.bulkInsert('UserSettings', [
      {
        userId: 1,
        meetingDuration: 30,
        bufferTime: 15,
        timezone: 'America/New_York',
        notificationPreferences: JSON.stringify({ email: true, sms: false }),
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 2,
        meetingDuration: 45,
        bufferTime: 10,
        timezone: 'America/Los_Angeles',
        notificationPreferences: JSON.stringify({ email: true, sms: false }),
        created: new Date(),
        updated: new Date()
      }
    ]);
    
    // Insert availability rules
    await queryInterface.bulkInsert('AvailabilityRules', [
      // For first user (Monday-Friday, 9AM-5PM)
      {
        userId: 1,
        dayOfWeek: 1, // Monday
        startTime: '09:00:00',
        endTime: '17:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 1,
        dayOfWeek: 2, // Tuesday
        startTime: '09:00:00',
        endTime: '17:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 1,
        dayOfWeek: 3, // Wednesday
        startTime: '09:00:00',
        endTime: '17:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 1,
        dayOfWeek: 4, // Thursday
        startTime: '09:00:00',
        endTime: '17:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 1,
        dayOfWeek: 5, // Friday
        startTime: '09:00:00',
        endTime: '17:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      },
      
      // For second user (Monday-Wednesday, 10AM-4PM)
      {
        userId: 2,
        dayOfWeek: 1, // Monday
        startTime: '10:00:00',
        endTime: '16:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 2,
        dayOfWeek: 2, // Tuesday
        startTime: '10:00:00',
        endTime: '16:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 2,
        dayOfWeek: 3, // Wednesday
        startTime: '10:00:00',
        endTime: '16:00:00',
        isAvailable: true,
        created: new Date(),
        updated: new Date()
      }
    ]);
    
    // Sample bookings - using current date + offset
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // 10 AM
    
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(14, 0, 0, 0); // 2 PM
    
    await queryInterface.bulkInsert('Bookings', [
      {
        userId: 1,
        guestEmail: 'client1@example.com',
        guestName: 'Client One',
        title: 'Initial Consultation',
        description: 'Discuss project requirements',
        startTime: tomorrow,
        endTime: new Date(tomorrow.getTime() + 30 * 60000), // 30 minutes
        status: 'confirmed',
        location: 'Zoom Meeting',
        created: new Date(),
        updated: new Date()
      },
      {
        userId: 2,
        guestEmail: 'client2@example.com',
        guestName: 'Client Two',
        title: 'Follow-up Meeting',
        description: 'Review progress and next steps',
        startTime: nextWeek,
        endTime: new Date(nextWeek.getTime() + 45 * 60000), // 45 minutes
        status: 'confirmed',
        location: 'Microsoft Teams',
        created: new Date(),
        updated: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Remove seeded data in reverse order
    await queryInterface.bulkDelete('Bookings', null, {});
    await queryInterface.bulkDelete('AvailabilityRules', null, {});
    await queryInterface.bulkDelete('UserSettings', null, {});
    await queryInterface.bulkDelete('Users', null, {});
  }
};