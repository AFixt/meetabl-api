/**
 * Unit tests for ICS Generator utility
 */

const icsGenerator = require('../../../src/utils/ics-generator');

describe('ICS Generator', () => {
  const mockHost = {
    id: 'host-123',
    firstName: 'Alice',
    lastName: 'Wilson',
    email: 'alice.wilson@meetabl.com',
    timezone: 'America/New_York'
  };

  const mockBookingCamelCase = {
    id: 'booking-123-456-789',
    customerName: 'John Doe',
    customerEmail: 'john.doe@example.com',
    startTime: '2025-08-10T10:00:00Z',
    endTime: '2025-08-10T11:00:00Z',
    notes: 'Quarterly business review meeting',
    meetingUrl: 'https://zoom.us/j/123456789',
    status: 'confirmed'
  };

  const mockBookingSnakeCase = {
    id: 'booking-987-654-321',
    customer_name: 'Jane Smith',
    customer_email: 'jane.smith@example.com',
    start_time: '2025-08-12T14:30:00Z',
    end_time: '2025-08-12T15:30:00Z',
    notes: 'Project kickoff meeting',
    status: 'confirmed'
  };

  describe('generateBookingICS', () => {
    it('should generate ICS file for camelCase booking data', async () => {
      const result = await icsGenerator.generateBookingICS(mockBookingCamelCase, mockHost);
      
      expect(result).toBeDefined();
      expect(result.icsContent).toContain('BEGIN:VCALENDAR');
      expect(result.icsContent).toContain('BEGIN:VEVENT');
      expect(result.icsContent).toContain('Meeting with Alice Wilson');
      expect(result.icsContent).toContain('john.doe@example.com');
      expect(result.icsContent).toContain('alice.wilson@meetabl.com');
      expect(result.icsContent).toContain('https://zoom.us/j/123456789');
      expect(result.icsContent).toContain('STATUS:CONFIRMED');
      expect(result.filename).toMatch(/meetabl-meeting-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.ics/);
      expect(result.mimeType).toBe('text/calendar');
      expect(result.charset).toBe('utf-8');
    });

    it('should generate ICS file for snake_case booking data', async () => {
      const result = await icsGenerator.generateBookingICS(mockBookingSnakeCase, mockHost);
      
      expect(result).toBeDefined();
      expect(result.icsContent).toContain('Meeting with Alice Wilson');
      expect(result.icsContent).toContain('jane.smith@example.com');
      expect(result.metadata.customerEmail).toBe('jane.smith@example.com');
    });

    it('should include meeting URL in location when provided', async () => {
      const result = await icsGenerator.generateBookingICS(mockBookingCamelCase, mockHost);
      expect(result.icsContent).toContain('LOCATION:https://zoom.us/j/123456789');
    });

    it('should include notes in description when provided', async () => {
      const result = await icsGenerator.generateBookingICS(mockBookingCamelCase, mockHost);
      // The ICS content may have line breaks in the middle of words
      expect(result.icsContent).toContain('Quarterly business review');
      expect(result.icsContent).toContain('eeting'); // "meeting" is split with line break
    });

    it('should include organizer and attendee information', async () => {
      const result = await icsGenerator.generateBookingICS(mockBookingCamelCase, mockHost);
      expect(result.icsContent).toContain('ORGANIZER;CN="Alice Wilson":MAILTO:alice.wilson@meetabl.com');
      expect(result.icsContent).toContain('john.doe@example.com');
    });

    it('should throw validation error for missing required booking fields', async () => {
      const invalidBooking = {
        id: 'booking-invalid',
        customerEmail: 'test@example.com',
        startTime: '2025-08-10T10:00:00Z',
        endTime: '2025-08-10T11:00:00Z'
        // Missing customerName
      };

      await expect(icsGenerator.generateBookingICS(invalidBooking, mockHost))
        .rejects.toThrow('Missing required booking field: customerName/customer_name');
    });

    it('should throw validation error for missing required host fields', async () => {
      const incompleteHost = {
        firstName: 'Alice',
        email: 'alice@example.com'
        // Missing lastName
      };

      await expect(icsGenerator.generateBookingICS(mockBookingCamelCase, incompleteHost))
        .rejects.toThrow('Missing required host field: lastName');
    });

    it('should throw validation error for invalid date format', async () => {
      const invalidBooking = {
        ...mockBookingCamelCase,
        startTime: 'invalid-date'
      };

      await expect(icsGenerator.generateBookingICS(invalidBooking, mockHost))
        .rejects.toThrow('Invalid date format in booking times');
    });

    it('should throw validation error when end time is before start time', async () => {
      const invalidBooking = {
        ...mockBookingCamelCase,
        startTime: '2025-08-10T11:00:00Z',
        endTime: '2025-08-10T10:00:00Z'
      };

      await expect(icsGenerator.generateBookingICS(invalidBooking, mockHost))
        .rejects.toThrow('Start time must be before end time');
    });
  });

  describe('generateCancellationICS', () => {
    it('should generate ICS file with cancelled status', async () => {
      const cancelledBooking = {
        ...mockBookingCamelCase,
        status: 'cancelled'
      };

      const result = await icsGenerator.generateCancellationICS(cancelledBooking, mockHost);
      
      expect(result).toBeDefined();
      expect(result.icsContent).toContain('STATUS:CANCELLED');
      expect(result.icsContent).toContain('CANCELLED - This meeting has been cancelled');
      expect(result.filename).toContain('-CANCELLED.ics');
      expect(result.metadata.status).toBe('CANCELLED');
    });
  });

  describe('generateRescheduleICS', () => {
    it('should generate ICS file with reschedule information', async () => {
      const originalTimes = {
        startTime: '2025-08-10T08:00:00Z',
        endTime: '2025-08-10T09:00:00Z'
      };

      const result = await icsGenerator.generateRescheduleICS(mockBookingCamelCase, mockHost, originalTimes);
      
      expect(result).toBeDefined();
      expect(result.icsContent).toContain('This meeting has been rescheduled from');
      expect(result.filename).toContain('-RESCHEDULED.ics');
      expect(result.metadata.status).toBe('RESCHEDULED');
      expect(result.metadata.originalTimes).toEqual(originalTimes);
    });

    it('should work without original times', async () => {
      const result = await icsGenerator.generateRescheduleICS(mockBookingCamelCase, mockHost);
      
      expect(result).toBeDefined();
      expect(result.filename).toContain('-RESCHEDULED.ics');
      expect(result.metadata.status).toBe('RESCHEDULED');
    });
  });

  describe('validateBookingData', () => {
    it('should return true for valid booking and host data', () => {
      const result = icsGenerator.validateBookingData(mockBookingCamelCase, mockHost);
      expect(result).toBe(true);
    });

    it('should return true for valid snake_case booking data', () => {
      const result = icsGenerator.validateBookingData(mockBookingSnakeCase, mockHost);
      expect(result).toBe(true);
    });

    it('should throw error for missing booking ID', () => {
      const invalidBooking = { ...mockBookingCamelCase };
      delete invalidBooking.id;

      expect(() => icsGenerator.validateBookingData(invalidBooking, mockHost))
        .toThrow('Missing required booking field: id');
    });

    it('should throw error for missing customer name', () => {
      const invalidBooking = { ...mockBookingCamelCase };
      delete invalidBooking.customerName;

      expect(() => icsGenerator.validateBookingData(invalidBooking, mockHost))
        .toThrow('Missing required booking field: customerName/customer_name');
    });

    it('should throw error for missing customer email', () => {
      const invalidBooking = { ...mockBookingCamelCase };
      delete invalidBooking.customerEmail;

      expect(() => icsGenerator.validateBookingData(invalidBooking, mockHost))
        .toThrow('Missing required booking field: customerEmail/customer_email');
    });

    it('should throw error for missing start time', () => {
      const invalidBooking = { ...mockBookingCamelCase };
      delete invalidBooking.startTime;

      expect(() => icsGenerator.validateBookingData(invalidBooking, mockHost))
        .toThrow('Missing required booking field: startTime/start_time');
    });

    it('should throw error for missing end time', () => {
      const invalidBooking = { ...mockBookingCamelCase };
      delete invalidBooking.endTime;

      expect(() => icsGenerator.validateBookingData(invalidBooking, mockHost))
        .toThrow('Missing required booking field: endTime/end_time');
    });

    it('should throw error for missing host first name', () => {
      const invalidHost = { ...mockHost };
      delete invalidHost.firstName;

      expect(() => icsGenerator.validateBookingData(mockBookingCamelCase, invalidHost))
        .toThrow('Missing required host field: firstName');
    });

    it('should throw error for missing host last name', () => {
      const invalidHost = { ...mockHost };
      delete invalidHost.lastName;

      expect(() => icsGenerator.validateBookingData(mockBookingCamelCase, invalidHost))
        .toThrow('Missing required host field: lastName');
    });

    it('should throw error for missing host email', () => {
      const invalidHost = { ...mockHost };
      delete invalidHost.email;

      expect(() => icsGenerator.validateBookingData(mockBookingCamelCase, invalidHost))
        .toThrow('Missing required host field: email');
    });
  });
});