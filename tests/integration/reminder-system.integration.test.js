/**
 * Integration tests for reminder system
 *
 * @author meetabl Team
 */

const request = require('supertest');
const app = require('../../src/app');
const { sequelize } = require('../../src/config/database');
const { User, UserSettings, Booking, Notification } = require('../../src/models');
const { generateJWT } = require('../../src/utils/crypto');
const logger = require('../../src/config/logger');

describe('Reminder System Integration', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Ensure database is connected
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    // Clean up test data
    await Notification.destroy({ where: {}, force: true });
    await Booking.destroy({ where: {}, force: true });
    await UserSettings.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // Create test user with settings
    testUser = await User.create({
      email: 'test@example.com',
      password: 'hashedpassword123',
      firstName: 'Test',
      lastName: 'User',
      status: 'active',
      role: 'user'
    });

    await UserSettings.create({
      userId: testUser.id,
      reminderTime: '30_minutes',
      meetingDuration: 60,
      bufferMinutes: 15
    });

    // Generate auth token
    authToken = generateJWT({
      id: testUser.id,
      email: testUser.email,
      role: testUser.role
    });
  });

  afterEach(async () => {
    // Clean up test data
    await Notification.destroy({ where: {}, force: true });
    await Booking.destroy({ where: {}, force: true });
    await UserSettings.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Booking Creation with Reminders', () => {
    test('should schedule reminders when booking is created', async () => {
      const bookingData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '+1234567890',
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
        notes: 'Test booking with reminders'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      const bookingId = response.body.data.id;

      // Check that reminder notifications were created
      const reminders = await Notification.findAll({
        where: {
          bookingId,
          type: 'reminder',
          status: 'pending'
        }
      });

      expect(reminders).toHaveLength(2); // One for customer, one for host

      // Check customer reminder
      const customerReminder = reminders.find(r => r.recipient === 'john@example.com');
      expect(customerReminder).toBeDefined();
      expect(customerReminder.channel).toBe('email');
      expect(customerReminder.scheduledFor).toBeDefined();

      // Check host reminder
      const hostReminder = reminders.find(r => r.recipient === 'test@example.com');
      expect(hostReminder).toBeDefined();
      expect(hostReminder.channel).toBe('email');
      expect(hostReminder.scheduledFor).toBeDefined();

      // Check that scheduled time is 30 minutes before booking start
      const bookingStart = new Date(bookingData.startTime);
      const expectedReminderTime = new Date(bookingStart.getTime() - (30 * 60 * 1000));
      
      expect(Math.abs(customerReminder.scheduledFor.getTime() - expectedReminderTime.getTime()))
        .toBeLessThan(1000); // Within 1 second
    });

    test('should not schedule reminders when disabled', async () => {
      // Update user settings to disable reminders
      await UserSettings.update(
        { reminderTime: 'none' },
        { where: { userId: testUser.id } }
      );

      const bookingData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookingData)
        .expect(201);

      const bookingId = response.body.data.id;

      // Check that no reminder notifications were created
      const reminders = await Notification.findAll({
        where: {
          bookingId,
          type: 'reminder'
        }
      });

      expect(reminders).toHaveLength(0);
    });

    test('should not schedule reminders for bookings too soon', async () => {
      const bookingData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
        endTime: new Date(Date.now() + 75 * 60 * 1000).toISOString() // 75 minutes from now
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookingData)
        .expect(201);

      const bookingId = response.body.data.id;

      // Check that no reminder notifications were created (30-minute reminder time has passed)
      const reminders = await Notification.findAll({
        where: {
          bookingId,
          type: 'reminder'
        }
      });

      expect(reminders).toHaveLength(0);
    });
  });

  describe('Booking Cancellation with Reminders', () => {
    test('should cancel reminders when booking is cancelled', async () => {
      // Create booking first
      const booking = await Booking.create({
        userId: testUser.id,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        status: 'confirmed'
      });

      // Create reminder notifications
      await Notification.bulkCreate([
        {
          bookingId: booking.id,
          type: 'reminder',
          channel: 'email',
          recipient: 'john@example.com',
          status: 'pending',
          scheduledFor: new Date(Date.now() + 2.5 * 60 * 60 * 1000)
        },
        {
          bookingId: booking.id,
          type: 'reminder',
          channel: 'email',
          recipient: 'test@example.com',
          status: 'pending',
          scheduledFor: new Date(Date.now() + 2.5 * 60 * 60 * 1000)
        }
      ]);

      // Cancel the booking
      await request(app)
        .patch(`/api/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Check that reminders were cancelled
      const reminders = await Notification.findAll({
        where: {
          bookingId: booking.id,
          type: 'reminder'
        }
      });

      expect(reminders).toHaveLength(2);
      reminders.forEach(reminder => {
        expect(reminder.status).toBe('failed');
        expect(reminder.errorMessage).toBe('Booking cancelled');
      });
    });
  });

  describe('Notification Processing', () => {
    test('should process scheduled reminders when time arrives', async () => {
      const { processNotificationQueue } = require('../../src/services/notification.service');

      // Create booking
      const booking = await Booking.create({
        userId: testUser.id,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        status: 'confirmed'
      });

      // Create reminder scheduled for past (should be processed)
      await Notification.create({
        bookingId: booking.id,
        type: 'reminder',
        channel: 'email',
        recipient: 'john@example.com',
        status: 'pending',
        scheduledFor: new Date(Date.now() - 1000) // 1 second ago
      });

      // Create reminder scheduled for future (should not be processed)
      await Notification.create({
        bookingId: booking.id,
        type: 'reminder',
        channel: 'email',
        recipient: 'test@example.com',
        status: 'pending',
        scheduledFor: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      });

      // Process notifications
      await processNotificationQueue();

      // Check notification statuses
      const notifications = await Notification.findAll({
        where: { bookingId: booking.id, type: 'reminder' },
        order: [['scheduledFor', 'ASC']]
      });

      expect(notifications).toHaveLength(2);
      
      // Past scheduled notification should be processed (failed in test env due to missing email config)
      expect(['sent', 'failed']).toContain(notifications[0].status);
      
      // Future scheduled notification should still be pending
      expect(notifications[1].status).toBe('pending');
    });
  });

  describe('Different Reminder Settings', () => {
    const reminderSettings = [
      { setting: '15_minutes', expectedMinutes: 15 },
      { setting: '1_hour', expectedMinutes: 60 },
      { setting: '2_hours', expectedMinutes: 120 },
      { setting: '24_hours', expectedMinutes: 1440 }
    ];

    reminderSettings.forEach(({ setting, expectedMinutes }) => {
      test(`should schedule reminders correctly for ${setting} setting`, async () => {
        // Update user settings
        await UserSettings.update(
          { reminderTime: setting },
          { where: { userId: testUser.id } }
        );

        const startTime = new Date(Date.now() + (expectedMinutes + 60) * 60 * 1000); // Reminder time + 1 hour
        const bookingData = {
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          startTime: startTime.toISOString(),
          endTime: new Date(startTime.getTime() + 60 * 60 * 1000).toISOString()
        };

        const response = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${authToken}`)
          .send(bookingData)
          .expect(201);

        const bookingId = response.body.data.id;

        const reminders = await Notification.findAll({
          where: { bookingId, type: 'reminder' }
        });

        expect(reminders).toHaveLength(2);

        const expectedReminderTime = new Date(startTime.getTime() - (expectedMinutes * 60 * 1000));
        
        reminders.forEach(reminder => {
          expect(Math.abs(reminder.scheduledFor.getTime() - expectedReminderTime.getTime()))
            .toBeLessThan(1000); // Within 1 second
        });
      });
    });
  });
});