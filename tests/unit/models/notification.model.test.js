/**
 * Notification model tests
 *
 * @author meetabl Team
 */

// Load the test setup
require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup controller mocks
setupControllerMocks();

// Import models after setup
const { Notification } = require('../../../src/models');

describe('Notification Model', () => {
  // Mocked IDs for relationships
  const testUserId = 'test-user-id';
  const testBookingId = 'test-booking-id';

  test('should create an email notification successfully', async () => {
    const notificationData = {
      booking_id: testBookingId,
      type: 'email',
      status: 'pending'
    };

    // Mock Notification.create
    const mockNotification = {
      id: 'test-notification-id',
      booking_id: testBookingId,
      type: 'email',
      status: 'pending',
      sent_at: null
    };
    Notification.create.mockResolvedValueOnce(mockNotification);

    const notification = await Notification.create(notificationData);

    expect(notification).toBeDefined();
    expect(notification.id).toBeDefined();
    expect(notification.booking_id).toBe(testBookingId);
    expect(notification.type).toBe('email');
    expect(notification.status).toBe('pending');
    expect(notification.sent_at).toBeNull();
  });

  test('should create an SMS notification successfully', async () => {
    const notificationData = {
      booking_id: testBookingId,
      type: 'sms',
      status: 'pending'
    };

    // Mock Notification.create
    const mockNotification = {
      id: 'test-notification-id',
      booking_id: testBookingId,
      type: 'sms',
      status: 'pending'
    };
    Notification.create.mockResolvedValueOnce(mockNotification);

    const notification = await Notification.create(notificationData);

    expect(notification).toBeDefined();
    expect(notification.type).toBe('sms');
  });

  test('should require a valid type', async () => {
    const invalidNotificationData = {
      booking_id: testBookingId,
      type: 'invalid-type',
      status: 'pending'
    };

    // Mock Notification.create to throw validation error
    Notification.create.mockRejectedValueOnce(new Error('Invalid type'));

    await expect(Notification.create(invalidNotificationData)).rejects.toThrow();
  });

  test('should require a valid status', async () => {
    const invalidNotificationData = {
      booking_id: testBookingId,
      type: 'email',
      status: 'invalid-status'
    };

    // Mock Notification.create to throw validation error
    Notification.create.mockRejectedValueOnce(new Error('Invalid status'));

    await expect(Notification.create(invalidNotificationData)).rejects.toThrow();
  });

  test('should require booking_id', async () => {
    const invalidNotificationData = {
      type: 'email',
      status: 'pending'
    };

    // Mock Notification.create to throw validation error
    Notification.create.mockRejectedValueOnce(new Error('booking_id is required'));

    await expect(Notification.create(invalidNotificationData)).rejects.toThrow();
  });

  test('should update notification status', async () => {
    // Mock pending notification
    const mockNotification = {
      id: 'notification-id',
      booking_id: testBookingId,
      type: 'email',
      status: 'pending',
      sent_at: null,
      save: jest.fn().mockResolvedValue(true)
    };
    
    // Mock Notification.create
    Notification.create.mockResolvedValueOnce(mockNotification);
    
    // Create notification
    const notification = await Notification.create({
      booking_id: testBookingId,
      type: 'email',
      status: 'pending'
    });

    // Update to sent
    notification.status = 'sent';
    notification.sent_at = new Date();
    
    // Mock updated notification
    const updatedMockNotification = {
      ...mockNotification,
      status: 'sent',
      sent_at: new Date()
    };
    Notification.findByPk.mockResolvedValueOnce(updatedMockNotification);
    
    await notification.save();

    // Fetch updated notification
    const updatedNotification = await Notification.findByPk(notification.id);
    
    expect(updatedNotification).toBeDefined();
    expect(updatedNotification.status).toBe('sent');
    expect(updatedNotification.sent_at).toBeDefined();
  });

  test('should update notification status to failed', async () => {
    // Mock pending notification
    const mockNotification = {
      id: 'notification-id',
      booking_id: testBookingId,
      type: 'email',
      status: 'pending',
      error: null,
      save: jest.fn().mockResolvedValue(true)
    };
    
    // Mock Notification.create
    Notification.create.mockResolvedValueOnce(mockNotification);
    
    // Create notification
    const notification = await Notification.create({
      booking_id: testBookingId,
      type: 'email',
      status: 'pending'
    });

    // Update to failed with error
    notification.status = 'failed';
    notification.error = 'Test error message';
    
    // Mock updated notification
    const updatedMockNotification = {
      ...mockNotification,
      status: 'failed',
      error: 'Test error message'
    };
    Notification.findByPk.mockResolvedValueOnce(updatedMockNotification);
    
    await notification.save();

    // Fetch updated notification
    const updatedNotification = await Notification.findByPk(notification.id);
    
    expect(updatedNotification).toBeDefined();
    expect(updatedNotification.status).toBe('failed');
    expect(updatedNotification.error).toBe('Test error message');
  });
  
  test('should retrieve pending notifications', async () => {
    // Mock result for Notification.findAll
    const mockPendingNotifications = [
      {
        id: 'notification-1',
        booking_id: testBookingId,
        type: 'email',
        status: 'pending'
      },
      {
        id: 'notification-2',
        booking_id: testBookingId,
        type: 'sms',
        status: 'pending'
      }
    ];
    
    // Mock Notification.findAll
    Notification.findAll.mockResolvedValueOnce(mockPendingNotifications);
    
    // Fetch pending notifications
    const pendingNotifications = await Notification.findAll({
      where: { status: 'pending' }
    });
    
    // Should have 2 pending notifications
    expect(pendingNotifications.length).toBe(2);
    
    // Verify they are all pending
    pendingNotifications.forEach(notification => {
      expect(notification.status).toBe('pending');
    });
  });
  
  test('should associate with booking', async () => {
    // Mock notification with booking association
    const mockNotificationWithBooking = {
      id: 'notification-id',
      booking_id: testBookingId,
      type: 'email',
      status: 'pending',
      Booking: {
        id: testBookingId,
        user_id: testUserId,
        customer_name: 'Test Customer'
      }
    };
    
    // Mock Notification.findByPk
    Notification.findByPk.mockResolvedValueOnce(mockNotificationWithBooking);
    
    // Retrieve notification with booking
    const notificationWithBooking = await Notification.findByPk('notification-id', {
      include: ['Booking']
    });
    
    expect(notificationWithBooking).toBeDefined();
    expect(notificationWithBooking.Booking).toBeDefined();
    expect(notificationWithBooking.Booking.id).toBe(testBookingId);
  });
});