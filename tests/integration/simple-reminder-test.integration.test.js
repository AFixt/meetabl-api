/**
 * Simple integration test for reminder system
 *
 * @author meetabl Team
 */

const { sequelize } = require('../../src/config/database');
const { User, UserSettings, Booking, Notification } = require('../../src/models');
const { scheduleReminders, cancelReminders } = require('../../src/services/notification.service');

describe('Simple Reminder System Test', () => {
  let testUser;

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

  test('should schedule reminders for a future booking', async () => {
    // Create a booking 2 hours in the future
    const booking = await Booking.create({
      userId: testUser.id,
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
      status: 'confirmed'
    });

    // Schedule reminders
    const reminders = await scheduleReminders(booking.id);

    expect(reminders).toHaveLength(2); // One for customer, one for host
    
    // Check that reminders were created in database
    const savedReminders = await Notification.findAll({
      where: {
        bookingId: booking.id,
        type: 'reminder'
      }
    });

    expect(savedReminders).toHaveLength(2);

    // Check customer reminder
    const customerReminder = savedReminders.find(r => r.recipient === 'john@example.com');
    expect(customerReminder).toBeDefined();
    expect(customerReminder.channel).toBe('email');
    expect(customerReminder.status).toBe('pending');
    expect(customerReminder.scheduledFor).toBeDefined();

    // Check that reminder is scheduled for 30 minutes before booking
    const bookingStart = booking.startTime;
    const expectedReminderTime = new Date(bookingStart.getTime() - (30 * 60 * 1000));
    
    expect(Math.abs(customerReminder.scheduledFor.getTime() - expectedReminderTime.getTime()))
      .toBeLessThan(2000); // Within 2 seconds

    // Check host reminder
    const hostReminder = savedReminders.find(r => r.recipient === 'test@example.com');
    expect(hostReminder).toBeDefined();
    expect(hostReminder.channel).toBe('email');
    expect(hostReminder.status).toBe('pending');
  });

  test('should not schedule reminders when disabled', async () => {
    // Update user settings to disable reminders
    await UserSettings.update(
      { reminderTime: 'none' },
      { where: { userId: testUser.id } }
    );

    // Create booking
    const booking = await Booking.create({
      userId: testUser.id,
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      status: 'confirmed'
    });

    // Try to schedule reminders
    const reminders = await scheduleReminders(booking.id);

    expect(reminders).toHaveLength(0);

    // Verify no reminders in database
    const savedReminders = await Notification.findAll({
      where: {
        bookingId: booking.id,
        type: 'reminder'
      }
    });

    expect(savedReminders).toHaveLength(0);
  });

  test('should cancel scheduled reminders', async () => {
    // Create booking
    const booking = await Booking.create({
      userId: testUser.id,
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      status: 'confirmed'
    });

    // Schedule reminders
    await scheduleReminders(booking.id);

    // Verify reminders were created
    let reminders = await Notification.findAll({
      where: {
        bookingId: booking.id,
        type: 'reminder',
        status: 'pending'
      }
    });
    expect(reminders).toHaveLength(2);

    // Cancel reminders
    const cancelledCount = await cancelReminders(booking.id);
    expect(cancelledCount).toBe(2);

    // Verify reminders were cancelled
    reminders = await Notification.findAll({
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

  test('should handle different reminder time settings', async () => {
    const testCases = [
      { setting: '15_minutes', expectedMinutes: 15 },
      { setting: '1_hour', expectedMinutes: 60 },
      { setting: '2_hours', expectedMinutes: 120 }
    ];

    for (const testCase of testCases) {
      // Update user settings
      await UserSettings.update(
        { reminderTime: testCase.setting },
        { where: { userId: testUser.id } }
      );

      // Create booking far enough in the future
      const hoursFromNow = Math.max(3, testCase.expectedMinutes / 60 + 1);
      const booking = await Booking.create({
        userId: testUser.id,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        startTime: new Date(Date.now() + hoursFromNow * 60 * 60 * 1000),
        endTime: new Date(Date.now() + (hoursFromNow + 1) * 60 * 60 * 1000),
        status: 'confirmed'
      });

      // Schedule reminders
      const reminders = await scheduleReminders(booking.id);
      expect(reminders).toHaveLength(2);

      // Check reminder timing
      const reminder = await Notification.findOne({
        where: {
          bookingId: booking.id,
          type: 'reminder',
          recipient: 'john@example.com'
        }
      });

      const expectedReminderTime = new Date(booking.startTime.getTime() - (testCase.expectedMinutes * 60 * 1000));
      expect(Math.abs(reminder.scheduledFor.getTime() - expectedReminderTime.getTime()))
        .toBeLessThan(2000); // Within 2 seconds

      // Clean up for next iteration
      await Notification.destroy({ where: { bookingId: booking.id } });
      await Booking.destroy({ where: { id: booking.id } });
    }
  });
});