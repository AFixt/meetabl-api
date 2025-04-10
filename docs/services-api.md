# meetabl API Services

This document describes the internal services available in the meetabl API.

## Notification Service

The notification service is responsible for sending email and SMS notifications to users and customers.

### Methods

#### `queueNotification(bookingId, type)`

Queues a notification for a booking.

- **bookingId** (string, required): The ID of the booking
- **type** (string, required): The notification type ('email' or 'sms')
- **Returns**: Promise<Object> - The created notification

#### `processNotificationQueue()`

Processes all pending notifications in the queue.

- **Returns**: Promise<void>

## Calendar Service

The calendar service is responsible for integrating with external calendar providers.

### Methods

#### `createCalendarEvent(booking)`

Creates a calendar event for a booking.

- **booking** (object, required): The booking object
- **Returns**: Promise<Object> - The created calendar event

#### `getGoogleAuthClient(userId)`

Gets a Google OAuth2 client for a user.

- **userId** (string, required): The user ID
- **Returns**: Promise<OAuth2Client> - The Google OAuth2 client

#### `getMicrosoftGraphClient(userId)`

Gets a Microsoft Graph client for a user.

- **userId** (string, required): The user ID
- **Returns**: Promise<Client> - The Microsoft Graph client

## Background Jobs

### Notification Processor

The notification processor is a background job that processes pending notifications.

#### Running manually

```bash
node src/jobs/notification-processor.js
```

This could be scheduled with cron or a task scheduler in production.